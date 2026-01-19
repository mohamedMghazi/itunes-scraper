import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';

@Injectable()
export class IpBlockGuard implements CanActivate {
  private readonly logger = new StructuredLoggerService(IpBlockGuard.name);
  private readonly blockedIps = new Set<string>([]);

  // Track failed attempts for auto-blocking
  private readonly failedAttempts = new Map<
    string,
    { count: number; firstAttempt: number }
  >();
  private readonly MAX_FAILED_ATTEMPTS = 10;
  private readonly ATTEMPT_WINDOW = 5 * 60 * 1000; // 5 minutes
  private readonly AUTO_BLOCK_DURATION = 30 * 60 * 1000; // 30 minutes

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.getClientIp(request);

    // Check if IP is in blocked list
    if (this.blockedIps.has(ip)) {
      this.logger.logSecurityEvent('ip_blocked', ip, {
        userAgent: request.headers['user-agent'],
        path: request.path,
      });
      throw new ForbiddenException('Access denied');
    }

    // Check if IP is temporarily blocked due to abuse
    if (this.isTemporarilyBlocked(ip)) {
      this.logger.logSecurityEvent('suspicious_activity', ip, {
        reason: 'temporary_block',
        userAgent: request.headers['user-agent'],
        path: request.path,
      });
      throw new ForbiddenException('Too many failed requests. Try again later');
    }

    return true;
  }

  private getClientIp(request: Request): string {
    // Check for proxies/load balancers
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // Get first IP if multiple are present
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

  private isTemporarilyBlocked(ip: string): boolean {
    const record = this.failedAttempts.get(ip);
    if (!record) return false;

    const now = Date.now();
    const timeSinceFirst = now - record.firstAttempt;

    if (timeSinceFirst > this.ATTEMPT_WINDOW) {
      this.failedAttempts.delete(ip);
      return false;
    }

    return record.count >= this.MAX_FAILED_ATTEMPTS;
  }

  recordFailedAttempt(ip: string): void {
    const now = Date.now();
    const record = this.failedAttempts.get(ip);

    if (!record) {
      this.failedAttempts.set(ip, { count: 1, firstAttempt: now });
      return;
    }

    const timeSinceFirst = now - record.firstAttempt;

    if (timeSinceFirst > this.ATTEMPT_WINDOW) {
      this.failedAttempts.set(ip, { count: 1, firstAttempt: now });
      return;
    }

    record.count++;

    if (record.count >= this.MAX_FAILED_ATTEMPTS - 2) {
      this.logger.warn(
        `IP ${ip} has ${record.count} failed attempts in ${Math.round(timeSinceFirst / 1000)}s`,
      );
    }

    if (record.count >= this.MAX_FAILED_ATTEMPTS) {
      this.logger.error(
        `Auto-blocking IP ${ip} for ${this.AUTO_BLOCK_DURATION / 1000}s`,
      );
      this.addTemporaryBlock(ip);
    }
  }

  private addTemporaryBlock(ip: string): void {
    this.blockedIps.add(ip);
    setTimeout(() => {
      this.blockedIps.delete(ip);
      this.failedAttempts.delete(ip);
      this.logger.log(`Temporary block lifted for IP ${ip}`);
    }, this.AUTO_BLOCK_DURATION);
  }

  // Manual block methods for admin use
  blockIp(ip: string): void {
    this.blockedIps.add(ip);
    this.logger.warn(`Manually blocked IP: ${ip}`);
  }

  unblockIp(ip: string): void {
    this.blockedIps.delete(ip);
    this.failedAttempts.delete(ip);
    this.logger.log(`Unblocked IP: ${ip}`);
  }
}
