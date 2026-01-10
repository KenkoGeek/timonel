/**
 * Validation Result Cache Implementation
 *
 * This module provides caching functionality for policy validation results to optimize
 * performance for repeated manifest validations. It implements cache invalidation
 * strategies and optimizations for large chart processing.
 *
 * @since 3.0.0
 */

import { createLogger, type TimonelLogger } from '../utils/logger.js';

import type { PolicyResult } from './types.js';

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  /** Cached validation result */
  readonly result: PolicyResult;

  /** Timestamp when entry was created */
  readonly timestamp: number;

  /** Hash of the manifests that were validated */
  readonly manifestHash: string;

  /** Hash of the plugin configuration used */
  readonly pluginHash: string;

  /** Number of times this entry has been accessed */
  accessCount: number;

  /** Last access timestamp */
  lastAccessed: number;
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Maximum number of entries to store */
  maxEntries?: number;

  /** Maximum age of cache entries in milliseconds */
  maxAge?: number;

  /** Whether to enable cache compression */
  enableCompression?: boolean;

  /** Cache eviction strategy */
  evictionStrategy?: 'lru' | 'lfu' | 'ttl';

  /** Whether to cache results with violations */
  cacheFailures?: boolean;

  /** Minimum execution time to cache (avoid caching very fast validations) */
  minExecutionTimeToCache?: number;
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;

  /** Total number of cache misses */
  misses: number;

  /** Current number of entries in cache */
  entries: number;

  /** Total memory usage estimate in bytes */
  memoryUsage: number;

  /** Cache hit ratio (0-1) */
  hitRatio: number;

  /** Average access count per entry */
  averageAccessCount: number;
}

/**
 * Default cache configuration
 */
const DEFAULT_CACHE_OPTIONS: Required<CacheOptions> = {
  maxEntries: 1000,
  maxAge: 30 * 60 * 1000, // 30 minutes
  enableCompression: false,
  evictionStrategy: 'lru',
  cacheFailures: true,
  minExecutionTimeToCache: 10, // 10ms
};

/**
 * Validation result cache implementation
 */
export class ValidationCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly options: Required<CacheOptions>;
  private readonly logger: TimonelLogger;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    entries: 0,
    memoryUsage: 0,
    hitRatio: 0,
    averageAccessCount: 0,
  };

  constructor(options: CacheOptions = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
    this.logger = createLogger('validation-cache');

    this.logger.debug('ValidationCache initialized', {
      options: this.options,
      operation: 'cache_init',
    });

    // Set up periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Gets a cached validation result if available
   * @param manifestHash - Hash of the manifests
   * @param pluginHash - Hash of the plugin configuration
   * @returns Cached result or undefined if not found
   */
  get(manifestHash: string, pluginHash: string): PolicyResult | undefined {
    const cacheKey = this.generateCacheKey(manifestHash, pluginHash);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.stats.misses++;
      this.updateStats();

      this.logger.debug('Cache miss', {
        manifestHash: manifestHash.substring(0, 8),
        pluginHash: pluginHash.substring(0, 8),
        operation: 'cache_miss',
      });

      return undefined;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(cacheKey);
      this.stats.misses++;
      this.updateStats();

      this.logger.debug('Cache entry expired', {
        manifestHash: manifestHash.substring(0, 8),
        pluginHash: pluginHash.substring(0, 8),
        age: Date.now() - entry.timestamp,
        operation: 'cache_expired',
      });

      return undefined;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    this.updateStats();

    this.logger.debug('Cache hit', {
      manifestHash: manifestHash.substring(0, 8),
      pluginHash: pluginHash.substring(0, 8),
      accessCount: entry.accessCount,
      age: Date.now() - entry.timestamp,
      operation: 'cache_hit',
    });

    return entry.result;
  }

  /**
   * Stores a validation result in the cache
   * @param manifestHash - Hash of the manifests
   * @param pluginHash - Hash of the plugin configuration
   * @param result - Validation result to cache
   */
  set(manifestHash: string, pluginHash: string, result: PolicyResult): void {
    // Check if we should cache this result
    if (!this.shouldCache(result)) {
      this.logger.debug('Skipping cache storage', {
        manifestHash: manifestHash.substring(0, 8),
        pluginHash: pluginHash.substring(0, 8),
        executionTime: result.metadata.executionTime,
        hasViolations: result.violations.length > 0,
        operation: 'cache_skip',
      });
      return;
    }

    const cacheKey = this.generateCacheKey(manifestHash, pluginHash);

    // Check if we need to evict entries
    if (this.cache.size >= this.options.maxEntries) {
      this.evictEntries();
    }

    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      manifestHash,
      pluginHash,
      accessCount: 0,
      lastAccessed: Date.now(),
    };

    this.cache.set(cacheKey, entry);
    this.updateStats();

    this.logger.debug('Cache entry stored', {
      manifestHash: manifestHash.substring(0, 8),
      pluginHash: pluginHash.substring(0, 8),
      executionTime: result.metadata.executionTime,
      violationCount: result.violations.length,
      warningCount: result.warnings.length,
      operation: 'cache_store',
    });
  }

  /**
   * Invalidates cache entries based on criteria
   * @param criteria - Invalidation criteria
   */
  invalidate(criteria: {
    manifestHash?: string;
    pluginHash?: string;
    olderThan?: number;
    all?: boolean;
  }): number {
    if (criteria.all) {
      return this.invalidateAll();
    }

    return this.invalidateSelective(criteria);
  }

  /**
   * Invalidates all cache entries
   * @returns Number of invalidated entries
   * @private
   */
  private invalidateAll(): number {
    const invalidatedCount = this.cache.size;
    this.cache.clear();
    this.logger.info('Cache cleared completely', {
      invalidatedCount,
      operation: 'cache_clear_all',
    });
    this.updateStats();
    return invalidatedCount;
  }

  /**
   * Invalidates cache entries based on selective criteria
   * @param criteria - Invalidation criteria
   * @returns Number of invalidated entries
   * @private
   */
  private invalidateSelective(criteria: {
    manifestHash?: string;
    pluginHash?: string;
    olderThan?: number;
  }): number {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (this.shouldInvalidateEntry(entry, criteria)) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    this.logger.debug('Cache entries invalidated', {
      invalidatedCount: keysToDelete.length,
      criteria,
      operation: 'cache_invalidate',
    });

    this.updateStats();
    return keysToDelete.length;
  }

  /**
   * Determines if a cache entry should be invalidated
   * @param entry - Cache entry to check
   * @param criteria - Invalidation criteria
   * @returns True if entry should be invalidated
   * @private
   */
  private shouldInvalidateEntry(
    entry: CacheEntry,
    criteria: {
      manifestHash?: string;
      pluginHash?: string;
      olderThan?: number;
    },
  ): boolean {
    if (criteria.manifestHash && entry.manifestHash === criteria.manifestHash) {
      return true;
    }

    if (criteria.pluginHash && entry.pluginHash === criteria.pluginHash) {
      return true;
    }

    if (criteria.olderThan && entry.timestamp < criteria.olderThan) {
      return true;
    }

    return false;
  }

  /**
   * Gets current cache statistics
   * @returns Cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Clears all cache statistics
   */
  clearStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      entries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      hitRatio: 0,
      averageAccessCount: 0,
    };

    this.logger.debug('Cache statistics cleared', {
      operation: 'cache_stats_clear',
    });
  }

  /**
   * Generates a cache key from manifest and plugin hashes
   * @param manifestHash - Hash of the manifests
   * @param pluginHash - Hash of the plugin configuration
   * @returns Cache key string
   * @private
   */
  private generateCacheKey(manifestHash: string, pluginHash: string): string {
    return `${manifestHash}:${pluginHash}`;
  }

  /**
   * Checks if a cache entry has expired
   * @param entry - Cache entry to check
   * @returns True if expired
   * @private
   */
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > this.options.maxAge;
  }

  /**
   * Determines if a validation result should be cached
   * @param result - Validation result
   * @returns True if should be cached
   * @private
   */
  private shouldCache(result: PolicyResult): boolean {
    // Don't cache if execution time is too short
    if (result.metadata.executionTime < this.options.minExecutionTimeToCache) {
      return false;
    }

    // Don't cache failures if disabled
    if (!this.options.cacheFailures && !result.valid) {
      return false;
    }

    return true;
  }

  /**
   * Evicts cache entries based on the configured strategy
   * @private
   */
  private evictEntries(): void {
    const entriesToEvict = Math.max(1, Math.floor(this.options.maxEntries * 0.1)); // Evict 10%

    switch (this.options.evictionStrategy) {
      case 'lru':
        this.evictLRU(entriesToEvict);
        break;
      case 'lfu':
        this.evictLFU(entriesToEvict);
        break;
      case 'ttl':
        this.evictTTL(entriesToEvict);
        break;
    }

    this.logger.debug('Cache entries evicted', {
      strategy: this.options.evictionStrategy,
      evictedCount: entriesToEvict,
      remainingEntries: this.cache.size,
      operation: 'cache_evict',
    });
  }

  /**
   * Evicts least recently used entries
   * @param count - Number of entries to evict
   * @private
   */
  private evictLRU(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      .slice(0, count);

    for (const [key] of entries) {
      this.cache.delete(key);
    }
  }

  /**
   * Evicts least frequently used entries
   * @param count - Number of entries to evict
   * @private
   */
  private evictLFU(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.accessCount - b.accessCount)
      .slice(0, count);

    for (const [key] of entries) {
      this.cache.delete(key);
    }
  }

  /**
   * Evicts oldest entries (time to live)
   * @param count - Number of entries to evict
   * @private
   */
  private evictTTL(count: number): void {
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, count);

    for (const [key] of entries) {
      this.cache.delete(key);
    }
  }

  /**
   * Updates cache statistics
   * @private
   */
  private updateStats(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.entries = this.cache.size;
    this.stats.memoryUsage = this.estimateMemoryUsage();
    this.stats.hitRatio = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    if (this.cache.size > 0) {
      const totalAccessCount = Array.from(this.cache.values()).reduce(
        (sum, entry) => sum + entry.accessCount,
        0,
      );
      this.stats.averageAccessCount = totalAccessCount / this.cache.size;
    } else {
      this.stats.averageAccessCount = 0;
    }
  }

  /**
   * Estimates memory usage of the cache
   * @returns Estimated memory usage in bytes
   * @private
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;

    for (const entry of this.cache.values()) {
      // Rough estimation of entry size
      totalSize += JSON.stringify(entry.result).length * 2; // UTF-16 encoding
      totalSize += entry.manifestHash.length * 2;
      totalSize += entry.pluginHash.length * 2;
      totalSize += 64; // Overhead for timestamps and counters
    }

    return totalSize;
  }

  /**
   * Starts periodic cleanup of expired entries
   * @private
   */
  private startPeriodicCleanup(): void {
    const cleanupInterval = Math.min(this.options.maxAge / 4, 5 * 60 * 1000); // Every 5 minutes or 1/4 of maxAge

    globalThis.setInterval(() => {
      this.cleanupExpiredEntries();
    }, cleanupInterval);
  }

  /**
   * Removes expired entries from the cache
   * @private
   */
  private cleanupExpiredEntries(): void {
    const keysToDelete: string[] = [];
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.options.maxAge) {
        keysToDelete.push(key);
      }
    }

    if (keysToDelete.length > 0) {
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }

      this.updateStats();

      this.logger.debug('Expired cache entries cleaned up', {
        cleanedCount: keysToDelete.length,
        remainingEntries: this.cache.size,
        operation: 'cache_cleanup',
      });
    }
  }
}

/**
 * Utility function to generate a hash from manifests
 * @param manifests - Array of manifest objects
 * @returns Hash string
 */
export function generateManifestHash(manifests: unknown[]): string {
  const manifestString = JSON.stringify(manifests, Object.keys(manifests).sort());
  return hashString(manifestString);
}

/**
 * Utility function to generate a hash from plugin configuration
 * @param plugins - Array of plugin names
 * @param pluginConfigs - Plugin configurations
 * @returns Hash string
 */
export function generatePluginHash(
  plugins: string[],
  pluginConfigs: Record<string, unknown>,
): string {
  const configString = JSON.stringify(
    {
      plugins: plugins.sort(),
      configs: pluginConfigs,
    },
    Object.keys({ plugins: plugins.sort(), configs: pluginConfigs }).sort(),
  );
  return hashString(configString);
}

/**
 * Simple string hashing function (djb2 algorithm)
 * @param str - String to hash
 * @returns Hash string
 * @private
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}
