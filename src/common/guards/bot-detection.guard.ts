import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';

@Injectable()
export class BotDetectionGuard implements CanActivate {
  private readonly logger = new StructuredLoggerService(BotDetectionGuard.name);

  // Known bot user agents (malicious/scrapers)
  private readonly suspiciousPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python-requests/i,
    /go-http-client/i,
    /java/i,
    /selenium/i,
    /phantomjs/i,
    /headless/i,
  ];

  // Whitelist for legitimate bots
  private readonly whitelistedBots = [
    /googlebot/i,
    /bingbot/i,
    /slackbot/i,
    /twitterbot/i,
    /facebookexternalhit/i,
    /linkedinbot/i,
    /whatsapp/i,
  ];

  // Check request patterns
  private readonly requestPatterns = new Map<
    string,
    { timestamps: number[]; paths: Set<string> }
  >();
  private readonly PATTERN_WINDOW = 60 * 1000; // 1 minute
  private readonly SUSPICIOUS_REQUEST_RATE = 30; // 30 requests per minute

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const userAgent = request.headers['user-agent'] || '';
    const ip = this.getClientIp(request);

    // Check if the agent is suspicious
    if (!userAgent || userAgent.trim() === '') {
      this.logger.logSecurityEvent('suspicious_activity', ip, {
        reason: 'missing_user_agent',
        path: request.path,
      });
      throw new ForbiddenException('Invalid request');
    }

    // Check if it's a whitelisted agent
    if (this.isWhitelistedBot(userAgent)) {
      return true;
    }

    // Check for suspicious agent behavior
    if (this.isSuspiciousUserAgent(userAgent)) {
      this.logger.logSecurityEvent('bot_detected', ip, {
        userAgent,
        path: request.path,
      });
      throw new ForbiddenException('Bot detected');
    }

    // Check for bot-like behavior
    if (this.hasBotLikeBehavior(ip)) {
      this.logger.logSecurityEvent('bot_detected', ip, {
        reason: 'bot_like_behavior',
        userAgent,
        path: request.path,
      });
      throw new ForbiddenException('Suspicious activity detected');
    }

    // Track request for pattern analysis
    this.trackRequest(ip, request.path);

    return true;
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded)
        ? forwarded[0]
        : forwarded.split(',')[0];
      return ips.trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip || request.socket.remoteAddress || 'unknown';
  }

  private isWhitelistedBot(userAgent: string): boolean {
    return this.whitelistedBots.some((pattern) => pattern.test(userAgent));
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const isSuspicious = this.suspiciousPatterns.some((pattern) =>
      pattern.test(userAgent),
    );

    if (!isSuspicious) return false;

    return !this.isWhitelistedBot(userAgent);
  }

  private hasBotLikeBehavior(ip: string): boolean {
    const pattern = this.requestPatterns.get(ip);
    if (!pattern) return false;

    const now = Date.now();

    // Filter out the old timestamps
    pattern.timestamps = pattern.timestamps.filter(
      (ts) => now - ts < this.PATTERN_WINDOW,
    );

    // Check if request rate exceeds threshold
    if (pattern.timestamps.length >= this.SUSPICIOUS_REQUEST_RATE) {
      this.logger.warn(
        `High request rate detected from IP ${ip}: ${pattern.timestamps.length} requests in ${this.PATTERN_WINDOW / 1000}s`,
      );
      return true;
    }

    // Check for path enumeration
    if (pattern.paths.size > 20) {
      this.logger.warn(
        `Path enumeration detected from IP ${ip}: ${pattern.paths.size} unique paths`,
      );
      return true;
    }

    return false;
  }

  private trackRequest(ip: string, path: string): void {
    const now = Date.now();
    let pattern = this.requestPatterns.get(ip);

    if (!pattern) {
      pattern = { timestamps: [], paths: new Set() };
      this.requestPatterns.set(ip, pattern);
    }

    // Add current request
    pattern.timestamps.push(now);
    pattern.paths.add(path);

    // Cleanup up to prevent memory leaks
    if (pattern.timestamps.length > 100) {
      const cutoff = now - this.PATTERN_WINDOW;
      pattern.timestamps = pattern.timestamps.filter((ts) => ts > cutoff);
    }

    // Cleanup paths set if too large
    if (pattern.paths.size > 50) {
      pattern.paths.clear();
    }

    // Cleanup entire entry if no recent activity
    if (
      pattern.timestamps.length > 0 &&
      now - pattern.timestamps[pattern.timestamps.length - 1] >
      this.PATTERN_WINDOW * 5
    ) {
      this.requestPatterns.delete(ip);
    }
  }

  // Cleanup method to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    const ipsToDelete: string[] = [];

    for (const [ip, pattern] of this.requestPatterns.entries()) {
      pattern.timestamps = pattern.timestamps.filter(
        (ts) => now - ts < this.PATTERN_WINDOW * 5,
      );

      if (pattern.timestamps.length === 0) {
        ipsToDelete.push(ip);
      }
    }

    ipsToDelete.forEach((ip) => this.requestPatterns.delete(ip));

    if (ipsToDelete.length > 0) {
      this.logger.log(`Cleaned up ${ipsToDelete.length} inactive IP patterns`);
    }
  }
}
