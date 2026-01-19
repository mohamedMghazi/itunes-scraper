import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { Logger } from 'winston';
import * as winston from 'winston';

export interface LogContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  cacheHit?: boolean;
  cacheLayer?: 'memory' | 'database' | 'miss';
  [key: string]: any;
}

@Injectable()
export class StructuredLoggerService implements NestLoggerService {
  private readonly logger: Logger;

  constructor(private readonly context: string = 'Application') {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'podcast-api', context: this.context },
      transports: [
        new winston.transports.Console({
          format:
            process.env.NODE_ENV === 'production'
              ? winston.format.json()
              : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.printf((info) => {
                    const { timestamp, level, message, context, ...meta } =
                      info;
                    const ts =
                      typeof timestamp === 'string'
                        ? timestamp
                        : JSON.stringify(timestamp);
                    const lvl =
                      typeof level === 'string' ? level : JSON.stringify(level);
                    const msg =
                      typeof message === 'string'
                        ? message
                        : JSON.stringify(message);
                    const ctx =
                      typeof context === 'string'
                        ? context
                        : JSON.stringify(context);
                    const metaStr = Object.keys(meta).length
                      ? `\n${JSON.stringify(meta, null, 2)}`
                      : '';
                    return `${ts} [${ctx}] ${lvl}: ${msg}${metaStr}`;
                  }),
                ),
        }),

        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  log(message: string, context?: LogContext): void {
    this.logger.info(message, { ...context });
  }

  error(message: string, trace?: string, context?: LogContext): void {
    this.logger.error(message, { trace, ...context });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { ...context });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { ...context });
  }

  verbose(message: string, context?: LogContext): void {
    this.logger.verbose(message, { ...context });
  }

  logApiRequest(context: LogContext): void {
    this.log('API Request', {
      event: 'api_request',
      ...context,
    });
  }

  logApiResponse(context: LogContext): void {
    this.log('API Response', {
      event: 'api_response',
      ...context,
    });
  }

  logCacheHit(
    layer: 'memory' | 'database',
    query: string,
    context?: LogContext,
  ): void {
    this.log('Cache Hit', {
      event: 'cache_hit',
      cacheLayer: layer,
      query,
      ...context,
    });
  }

  logCacheMiss(query: string, context?: LogContext): void {
    this.log('Cache Miss', {
      event: 'cache_miss',
      query,
      ...context,
    });
  }

  logExternalApiCall(
    service: string,
    endpoint: string,
    duration: number,
    success: boolean,
    context?: LogContext,
  ): void {
    this.log('External API Call', {
      event: 'external_api_call',
      service,
      endpoint,
      duration,
      success,
      ...context,
    });
  }

  logSecurityEvent(
    eventType:
      | 'ip_blocked'
      | 'bot_detected'
      | 'rate_limited'
      | 'suspicious_activity',
    ip: string,
    context?: LogContext,
  ): void {
    this.warn('Security Event', {
      event: 'security_event',
      eventType,
      ip,
      ...context,
    });
  }

  logDatabaseQuery(
    collection: string,
    operation: string,
    duration: number,
    context?: LogContext,
  ): void {
    this.debug('Database Query', {
      event: 'database_query',
      collection,
      operation,
      duration,
      ...context,
    });
  }

  logPerformanceMetric(
    metricName: string,
    value: number,
    unit: string,
    context?: LogContext,
  ): void {
    this.log('Performance Metric', {
      event: 'performance_metric',
      metricName,
      value,
      unit,
      ...context,
    });
  }
}
