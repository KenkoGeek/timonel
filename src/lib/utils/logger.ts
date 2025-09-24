/**
 * @fileoverview High-performance structured logging system for Timonel using Pino
 * Provides centralized, type-safe logging with performance optimizations and security features
 * @since 2.10.3
 */

import pino, { type Logger, type LoggerOptions } from 'pino';

import { SecurityUtils } from '../security.js';

/**
 * Standard log levels following syslog conventions
 * @since 2.10.3
 */
export enum LogLevel {
  /** System is unusable - immediate action required */
  FATAL = 60,
  /** Error conditions that need immediate attention */
  ERROR = 50,
  /** Warning conditions that should be monitored */
  WARN = 40,
  /** General informational messages */
  INFO = 30,
  /** Debug information for troubleshooting */
  DEBUG = 20,
  /** Detailed trace information */
  TRACE = 10,
}

/**
 * Configuration options for the logging system
 * @since 2.10.3
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Whether to suppress all log output */
  silent: boolean;
  /** Service name for structured logging */
  service: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Whether to enable pretty printing in development */
  prettyPrint: boolean;
  /** Additional base fields to include in all logs */
  base?: Record<string, unknown>;
}

/**
 * Contextual information to include with log entries
 * @since 2.10.3
 */
export interface LogContext {
  /** Unique identifier for request tracing */
  correlationId?: string;
  /** User identifier for audit trails */
  userId?: string;
  /** Operation being performed */
  operation?: string;
  /** Component or module name */
  component?: string;
  /** Chart or resource name */
  chartName?: string;
  /** Additional structured data */
  [key: string]: unknown;
}

/**
 * High-performance structured logger implementation using Pino
 * Provides type-safe logging with security features and performance optimization
 * @since 2.10.3
 */
export class TimonelLogger {
  private readonly logger: Logger;
  private readonly config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: LogLevel.INFO,
      silent: false,
      service: 'timonel',
      environment: process.env.NODE_ENV || 'development',
      prettyPrint: process.env.NODE_ENV !== 'production',
      ...config,
    };

    const pinoOptions: LoggerOptions = {
      level: this.mapLogLevel(this.config.level),
      enabled: !this.config.silent,
      base: {
        service: this.config.service,
        environment: this.config.environment,
        ...this.config.base,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
      // Security: redact sensitive fields
      redact: {
        paths: [
          'password',
          'secret',
          'token',
          'apiKey',
          'authorization',
          'credentials',
          '*.password',
          '*.secret',
          '*.token',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        // Optimized error serialization
        err: pino.stdSerializers.err,
        error: pino.stdSerializers.err,
        // Custom serializers for security
        req: this.requestSerializer,
        res: this.responseSerializer,
      },
    };

    // Pretty printing for development
    if (this.config.prettyPrint && this.config.environment === 'development') {
      this.logger = pino({
        ...pinoOptions,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'pid,hostname',
            messageFormat: '{service}[{component}]: {msg}',
          },
        },
      });
    } else {
      this.logger = pino(pinoOptions);
    }
  }

  /**
   * Maps internal log levels to Pino log levels
   * @param level - Internal log level
   * @returns Pino-compatible log level string
   * @since 2.10.3
   */
  private mapLogLevel(level: LogLevel): string {
    switch (level) {
      case LogLevel.FATAL:
        return 'fatal';
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.TRACE:
        return 'trace';
      default:
        return 'info';
    }
  }

  /**
   * Safe request serializer that removes sensitive data
   * @param req - HTTP request object
   * @returns Sanitized request data
   * @since 2.10.3
   */
  private requestSerializer(req: unknown): Record<string, unknown> {
    if (!req || typeof req !== 'object') return {};

    const request = req as {
      method?: string;
      url?: string;
      headers?: Record<string, string>;
      remoteAddress?: string;
      remotePort?: number;
    };

    return {
      method: request.method,
      url: SecurityUtils.sanitizeLogMessage(request.url || ''),
      headers: {
        'user-agent': request.headers?.['user-agent'],
        'content-type': request.headers?.['content-type'],
        // Exclude sensitive headers
      },
      remoteAddress: request.remoteAddress,
      remotePort: request.remotePort,
    };
  }

  /**
   * Safe response serializer
   * @param res - HTTP response object
   * @returns Sanitized response data
   * @since 2.10.3
   */
  private responseSerializer(res: unknown): Record<string, unknown> {
    if (!res || typeof res !== 'object') return {};

    const response = res as {
      statusCode?: number;
      headers?: Record<string, string>;
    };

    return {
      statusCode: response.statusCode,
      headers: {
        'content-type': response.headers?.['content-type'],
        'content-length': response.headers?.['content-length'],
      },
    };
  }

  /**
   * Log a fatal error - system is unusable
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  fatal(message: string, context?: LogContext): void {
    this.log(LogLevel.FATAL, message, context);
  }

  /**
   * Log an error that needs immediate attention
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning condition
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log general informational message
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log debug information
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log detailed trace information
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  trace(message: string, context?: LogContext): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Internal logging method with security sanitization
   * @param level - Log level
   * @param message - Log message
   * @param context - Additional context data
   * @since 2.10.3
   */
  private log(level: LogLevel, message: string, context?: LogContext): void {
    if (this.config.silent || level < this.config.level) {
      return;
    }

    // Sanitize message for security
    const sanitizedMessage = SecurityUtils.sanitizeLogMessage(message);

    // Sanitize and structure context
    const sanitizedContext = context ? this.sanitizeContext(context) : {};

    // Add performance timing if available
    const logEntry = {
      ...sanitizedContext,
      timestamp: new Date().toISOString(),
    };

    // Use appropriate Pino logging method
    switch (level) {
      case LogLevel.FATAL:
        this.logger.fatal(logEntry, sanitizedMessage);
        break;
      case LogLevel.ERROR:
        this.logger.error(logEntry, sanitizedMessage);
        break;
      case LogLevel.WARN:
        this.logger.warn(logEntry, sanitizedMessage);
        break;
      case LogLevel.INFO:
        this.logger.info(logEntry, sanitizedMessage);
        break;
      case LogLevel.DEBUG:
        this.logger.debug(logEntry, sanitizedMessage);
        break;
      case LogLevel.TRACE:
        this.logger.trace(logEntry, sanitizedMessage);
        break;
    }
  }

  /**
   * Sanitizes context object to prevent data leaks
   * @param context - Context object to sanitize
   * @returns Sanitized context object
   * @since 2.10.3
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitized: LogContext = {};

    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        // Safe assignment - key comes from Object.entries
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = SecurityUtils.sanitizeLogMessage(value);
      } else if (value && typeof value === 'object') {
        // Recursively sanitize nested objects (limited depth)
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = this.sanitizeNestedObject(value, 2);
      } else {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitizes nested objects with depth limiting
   * @param obj - Object to sanitize
   * @param depth - Maximum recursion depth
   * @returns Sanitized object
   * @since 2.10.3
   */
  private sanitizeNestedObject(obj: unknown, depth: number): unknown {
    if (depth <= 0 || !obj || typeof obj !== 'object') {
      return obj;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (typeof value === 'string') {
        // Safe assignment - key comes from Object.entries
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = SecurityUtils.sanitizeLogMessage(value);
      } else if (value && typeof value === 'object') {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = this.sanitizeNestedObject(value, depth - 1);
      } else {
        // eslint-disable-next-line security/detect-object-injection
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Creates a child logger with additional context
   * This is highly optimized in Pino for performance
   * @param context - Additional context to bind to child logger
   * @returns New logger instance with bound context
   * @since 2.10.3
   */
  child(context: LogContext): TimonelLogger {
    const childLogger = new TimonelLogger(this.config);
    const sanitizedContext = this.sanitizeContext(context);

    // Use Pino's efficient child logger
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (childLogger as any).logger = this.logger.child(sanitizedContext);

    return childLogger;
  }

  /**
   * Measures operation duration for performance monitoring
   * @param operation - Operation name
   * @returns Function to call when operation completes
   * @since 2.10.3
   */
  time(operation: string): () => void {
    const start = process.hrtime.bigint();

    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1_000_000; // Convert to milliseconds

      this.info('Operation completed', {
        operation: SecurityUtils.sanitizeLogMessage(operation),
        duration_ms: Math.round(duration * 100) / 100, // Round to 2 decimal places
        performance: 'timing',
      });
    };
  }

  /**
   * Updates the log level at runtime
   * @param level - New log level
   * @since 2.10.3
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.logger.level = this.mapLogLevel(level);
  }

  /**
   * Enables or disables silent mode
   * @param silent - Whether to suppress all output
   * @since 2.10.3
   */
  setSilent(silent: boolean): void {
    this.config.silent = silent;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.logger as any).silent = silent;
  }

  /**
   * Flushes any pending log entries (important for async logging)
   * @since 2.10.3
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof this.logger.flush === 'function') {
        this.logger.flush(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

/**
 * Global logger instance for the Timonel application
 * Configured based on environment variables
 * @since 2.10.3
 */
export const logger = new TimonelLogger({
  level: getLogLevelFromEnv(),
  silent: process.env.TIMONEL_SILENT === 'true',
  service: 'timonel',
  environment: process.env.NODE_ENV || 'development',
});

/**
 * Factory function for creating component-specific loggers
 * @param component - Component name
 * @param additionalConfig - Additional configuration
 * @returns Configured logger instance
 * @since 2.10.3
 */
export function createLogger(
  component: string,
  additionalConfig?: Partial<LoggerConfig>,
): TimonelLogger {
  return new TimonelLogger({
    ...additionalConfig,
    service: 'timonel',
    base: {
      component: SecurityUtils.sanitizeLogMessage(component),
      ...additionalConfig?.base,
    },
  });
}

/**
 * Gets log level from environment variables
 * @returns Log level based on environment
 * @since 2.10.3
 */
function getLogLevelFromEnv(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();

  switch (envLevel) {
    case 'FATAL':
      return LogLevel.FATAL;
    case 'ERROR':
      return LogLevel.ERROR;
    case 'WARN':
    case 'WARNING':
      return LogLevel.WARN;
    case 'INFO':
      return LogLevel.INFO;
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'TRACE':
      return LogLevel.TRACE;
    default:
      // Default to INFO in production, DEBUG in development
      return process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
  }
}
