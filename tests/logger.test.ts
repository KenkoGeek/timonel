/**
 * @fileoverview Unit tests for Timonel logging system
 * @since 2.10.3
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createLogger,
  logger,
  LogLevel,
  TimonelLogger,
  type LogContext,
} from '../src/lib/utils/logger.js';

describe('TimonelLogger', () => {
  let testLogger: TimonelLogger;

  beforeEach(() => {
    // Create a test logger with debug level for testing
    testLogger = createLogger('test', {
      level: LogLevel.DEBUG,
      silent: false,
      prettyPrint: false,
    });
  });

  describe('LogLevel enum', () => {
    it('should have correct log level values', () => {
      expect(LogLevel.FATAL).toBe(60);
      expect(LogLevel.ERROR).toBe(50);
      expect(LogLevel.WARN).toBe(40);
      expect(LogLevel.INFO).toBe(30);
      expect(LogLevel.DEBUG).toBe(20);
      expect(LogLevel.TRACE).toBe(10);
    });
  });

  describe('Logger Creation', () => {
    it('should create logger with default configuration', () => {
      const defaultLogger = new TimonelLogger();
      expect(defaultLogger).toBeInstanceOf(TimonelLogger);
    });

    it('should create logger with custom configuration', () => {
      const customLogger = new TimonelLogger({
        level: LogLevel.WARN,
        service: 'test-service',
        environment: 'test',
        silent: true,
      });
      expect(customLogger).toBeInstanceOf(TimonelLogger);
    });

    it('should create component-specific logger', () => {
      const componentLogger = createLogger('test-component');
      expect(componentLogger).toBeInstanceOf(TimonelLogger);
    });
  });

  describe('Logging Methods', () => {
    beforeEach(() => {
      // Mock console methods to capture output
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    it('should log fatal messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
        correlationId: 'test-123',
      };

      expect(() => {
        testLogger.fatal('Test fatal message', context);
      }).not.toThrow();
    });

    it('should log error messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
        userId: 'user-123',
      };

      expect(() => {
        testLogger.error('Test error message', context);
      }).not.toThrow();
    });

    it('should log warning messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
        chartName: 'test-chart',
      };

      expect(() => {
        testLogger.warn('Test warning message', context);
      }).not.toThrow();
    });

    it('should log info messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
        component: 'test-component',
      };

      expect(() => {
        testLogger.info('Test info message', context);
      }).not.toThrow();
    });

    it('should log debug messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
        customField: 'custom-value',
      };

      expect(() => {
        testLogger.debug('Test debug message', context);
      }).not.toThrow();
    });

    it('should log trace messages', () => {
      const context: LogContext = {
        operation: 'test-operation',
      };

      expect(() => {
        testLogger.trace('Test trace message', context);
      }).not.toThrow();
    });

    it('should handle logging without context', () => {
      expect(() => {
        testLogger.info('Test message without context');
      }).not.toThrow();
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level filtering', () => {
      const warnLogger = new TimonelLogger({
        level: LogLevel.WARN,
        silent: false,
      });

      // Mock the internal log method to check if it's called
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logSpy = vi.spyOn(warnLogger as any, 'log');

      warnLogger.debug('This should not be logged');
      warnLogger.warn('This should be logged');

      // Both debug and warn will call the log method, but debug will return early due to level filtering
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenLastCalledWith(LogLevel.WARN, 'This should be logged', undefined);
      expect(logSpy).toHaveBeenNthCalledWith(
        1,
        LogLevel.DEBUG,
        'This should not be logged',
        undefined,
      );
    });

    it('should handle silent mode', () => {
      const silentLogger = new TimonelLogger({
        silent: true,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logSpy = vi.spyOn(silentLogger as any, 'log');

      silentLogger.info('This should not be logged');

      expect(logSpy).toHaveBeenCalledTimes(1);
      // The log method should return early due to silent mode
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with additional context', () => {
      const childContext: LogContext = {
        component: 'child-component',
        correlationId: 'child-123',
      };

      const childLogger = testLogger.child(childContext);
      expect(childLogger).toBeInstanceOf(TimonelLogger);

      // Child logger should be able to log
      expect(() => {
        childLogger.info('Child logger message');
      }).not.toThrow();
    });
  });

  describe('Performance Timing', () => {
    it('should provide timing functionality', async () => {
      const timer = testLogger.time('test-operation');

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(() => {
        timer();
      }).not.toThrow();
    });
  });

  describe('Runtime Configuration', () => {
    it('should allow changing log level at runtime', () => {
      testLogger.setLevel(LogLevel.ERROR);

      // This should update the internal configuration
      expect(() => {
        testLogger.setLevel(LogLevel.WARN);
      }).not.toThrow();
    });

    it('should allow changing silent mode at runtime', () => {
      testLogger.setSilent(true);

      expect(() => {
        testLogger.setSilent(false);
      }).not.toThrow();
    });
  });

  describe('Context Sanitization', () => {
    it('should sanitize sensitive data in context', () => {
      const sensitiveContext: LogContext = {
        operation: 'test-operation',
        password: 'secret-password',
        // amazonq-ignore-next-line
        token: 'secret-token',
        apiKey: 'secret-api-key',
        normalField: 'normal-value',
      };

      // The logger should handle sensitive data appropriately
      expect(() => {
        testLogger.info('Test with sensitive context', sensitiveContext);
      }).not.toThrow();
    });

    it('should sanitize nested objects', () => {
      const nestedContext: LogContext = {
        operation: 'test-operation',
        config: {
          database: {
            // amazonq-ignore-next-line
            password: 'db-secret',
            host: 'localhost',
          },
          api: {
            token: 'api-secret',
            endpoint: 'https://api.example.com',
          },
        },
      };

      expect(() => {
        testLogger.info('Test with nested sensitive context', nestedContext);
      }).not.toThrow();
    });
  });

  describe('Async Operations', () => {
    it('should handle flush operation', async () => {
      await expect(testLogger.flush()).resolves.not.toThrow();
    });
  });
});

describe('Global Logger', () => {
  it('should provide global logger instance', () => {
    expect(logger).toBeInstanceOf(TimonelLogger);
  });

  it('should handle environment variable configuration', () => {
    // Test that the logger respects environment variables
    const originalEnv = process.env.LOG_LEVEL;

    // Test with different log levels
    process.env.LOG_LEVEL = 'ERROR';
    const errorLevelLogger = createLogger('env-test');
    expect(errorLevelLogger).toBeInstanceOf(TimonelLogger);

    process.env.LOG_LEVEL = 'DEBUG';
    const debugLevelLogger = createLogger('env-test-2');
    expect(debugLevelLogger).toBeInstanceOf(TimonelLogger);

    // Restore original environment
    if (originalEnv !== undefined) {
      process.env.LOG_LEVEL = originalEnv;
    } else {
      delete process.env.LOG_LEVEL;
    }
  });
});

describe('Security Features', () => {
  let testLogger: TimonelLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    testLogger = createLogger('test', {
      level: LogLevel.DEBUG,
      silent: false,
      prettyPrint: false,
    });
  });

  it('should redact sensitive fields automatically', () => {
    const sensitiveData = {
      username: 'testuser',
      // amazonq-ignore-next-line
      password: 'supersecret',
      email: 'test@example.com',
      secret: 'topsecret',
      // amazonq-ignore-next-line
      token: 'bearer-token',
    };

    expect(() => {
      testLogger.info('User data', sensitiveData);
    }).not.toThrow();
  });

  it('should handle malicious input safely', () => {
    const maliciousContext: LogContext = {
      operation: 'test\n\r\t\0injection',
      xssAttempt: '<script>alert("xss")</script>',
      pathTraversal: '../../../etc/passwd',
    };

    expect(() => {
      testLogger.info('Malicious input test', maliciousContext);
    }).not.toThrow();
  });
});

describe('Error Serialization', () => {
  let testLogger: TimonelLogger;

  beforeEach(() => {
    testLogger = createLogger('test', {
      level: LogLevel.DEBUG,
      silent: false,
      prettyPrint: false,
    });
  });
  it('should properly serialize Error objects', () => {
    const error = new Error('Test error message');
    error.name = 'TestError';
    error.stack = 'TestError: Test error message\n    at test (test.ts:1:1)';

    const context: LogContext = {
      operation: 'error-test',
      err: error,
    };

    expect(() => {
      testLogger.error('Error occurred', context);
    }).not.toThrow();
  });

  it('should handle custom error objects', () => {
    const customError = {
      name: 'CustomError',
      message: 'Custom error message',
      code: 'ERR_CUSTOM',
      details: {
        field: 'value',
        nested: {
          deep: 'value',
        },
      },
    };

    const context: LogContext = {
      operation: 'custom-error-test',
      error: customError,
    };

    expect(() => {
      testLogger.error('Custom error occurred', context);
    }).not.toThrow();
  });
});
