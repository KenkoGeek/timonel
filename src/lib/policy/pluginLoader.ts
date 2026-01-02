/**
 * Plugin Loader
 * 
 * This module provides plugin discovery and loading capabilities for the policy engine.
 * It supports loading plugins from npm packages, version compatibility checks, and
 * conditional loading based on environment.
 * 
 * @since 3.0.0
 */

import type { PolicyPlugin, PluginMetadata } from './types.js';
import { PluginError, PluginRegistrationError } from './errors.js';
import { createLogger, type TimonelLogger } from '../utils/logger.js';

/**
 * Plugin loading options
 */
export interface PluginLoaderOptions {
  /** Base directory for plugin discovery */
  baseDirectory?: string;
  
  /** Environment for conditional loading */
  environment?: string;
  
  /** Whether to validate plugin compatibility */
  validateCompatibility?: boolean;
  
  /** Supported Kubernetes versions for compatibility checks */
  supportedKubernetesVersions?: string[];
  
  /** Plugin registry URL for discovery */
  registryUrl?: string;
  
  /** Timeout for plugin loading operations */
  loadTimeout?: number;
}

/**
 * Plugin discovery result
 */
export interface PluginDiscoveryResult {
  /** Plugin package name */
  packageName: string;
  
  /** Plugin version */
  version: string;
  
  /** Plugin metadata */
  metadata?: PluginMetadata;
  
  /** Whether plugin is compatible */
  compatible: boolean;
  
  /** Compatibility issues if any */
  compatibilityIssues?: string[];
  
  /** Plugin source (npm, local, etc.) */
  source: 'npm' | 'local' | 'registry';
}

/**
 * Plugin loading result
 */
export interface PluginLoadingResult {
  /** Loaded plugin instance */
  plugin: PolicyPlugin;
  
  /** Plugin package name */
  packageName: string;
  
  /** Loading source */
  source: 'npm' | 'local' | 'registry';
  
  /** Loading time in milliseconds */
  loadTime: number;
  
  /** Whether plugin passed validation */
  validated: boolean;
  
  /** Validation warnings if any */
  warnings?: string[];
}

/**
 * Default plugin loader options
 */
const DEFAULT_LOADER_OPTIONS: Required<PluginLoaderOptions> = {
  baseDirectory: process.cwd(),
  environment: 'development',
  validateCompatibility: true,
  supportedKubernetesVersions: ['1.25', '1.26', '1.27', '1.28', '1.29'],
  registryUrl: 'https://registry.npmjs.org',
  loadTimeout: 30000, // 30 seconds
};

/**
 * Plugin loader for policy engine
 */
export class PluginLoader {
  private readonly options: Required<PluginLoaderOptions>;
  private readonly logger: TimonelLogger;
  private readonly loadedPlugins = new Map<string, PluginLoadingResult>();
  
  constructor(options: PluginLoaderOptions = {}) {
    this.options = { ...DEFAULT_LOADER_OPTIONS, ...options };
    this.logger = createLogger('policy-plugin-loader');
    
    this.logger.debug('PluginLoader initialized', {
      options: this.options,
      operation: 'plugin_loader_init'
    });
  }
  
  /**
   * Loads a plugin from an npm package
   * @param packageName - NPM package name
   * @param version - Optional version constraint
   * @returns Plugin loading result
   */
  async loadFromPackage(packageName: string, version?: string): Promise<PluginLoadingResult> {
    const startTime = Date.now();
    
    this.logger.info('Loading plugin from package', {
      packageName,
      version,
      operation: 'load_from_package'
    });
    
    try {
      // Check if already loaded
      const cacheKey = `${packageName}@${version || 'latest'}`;
      if (this.loadedPlugins.has(cacheKey)) {
        const cached = this.loadedPlugins.get(cacheKey)!;
        this.logger.debug('Plugin loaded from cache', {
          packageName,
          cacheKey,
          operation: 'load_from_cache'
        });
        return cached;
      }
      
      // Construct module path
      const modulePath = version ? `${packageName}@${version}` : packageName;
      
      // Load the module with timeout
      const plugin = await this.loadModuleWithTimeout(modulePath);
      
      // Validate plugin interface
      this.validatePluginInterface(plugin, packageName);
      
      // Check compatibility if enabled
      const warnings: string[] = [];
      if (this.options.validateCompatibility) {
        const compatibilityIssues = this.checkCompatibility(plugin);
        warnings.push(...compatibilityIssues);
      }
      
      // Check environment conditions
      if (!this.shouldLoadInEnvironment(plugin)) {
        throw new PluginError(
          `Plugin '${packageName}' is not enabled for environment '${this.options.environment}'`,
          packageName
        );
      }
      
      const loadTime = Date.now() - startTime;
      const result: PluginLoadingResult = {
        plugin,
        packageName,
        source: 'npm',
        loadTime,
        validated: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
      
      // Cache the result
      this.loadedPlugins.set(cacheKey, result);
      
      this.logger.info('Plugin loaded successfully', {
        packageName,
        pluginName: plugin.name,
        pluginVersion: plugin.version,
        loadTime,
        hasWarnings: warnings.length > 0,
        operation: 'plugin_loaded'
      });
      
      return result;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      
      this.logger.error('Plugin loading failed', {
        packageName,
        version,
        loadTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'plugin_load_failed'
      });
      
      throw new PluginError(
        `Failed to load plugin from package '${packageName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
        packageName,
        { originalError: error, loadTime }
      );
    }
  }
  
  /**
   * Discovers available plugins in the environment
   * @param searchPattern - Optional search pattern for plugin names
   * @returns Array of discovered plugins
   */
  async discoverPlugins(searchPattern?: string): Promise<PluginDiscoveryResult[]> {
    this.logger.info('Discovering plugins', {
      searchPattern,
      environment: this.options.environment,
      operation: 'discover_plugins'
    });
    
    const discovered: PluginDiscoveryResult[] = [];
    
    try {
      // For now, return empty array as actual discovery would require
      // scanning node_modules, package.json, or registry API calls
      // This is a placeholder for future implementation
      
      this.logger.info('Plugin discovery completed', {
        discoveredCount: discovered.length,
        operation: 'discovery_complete'
      });
      
      return discovered;
    } catch (error) {
      this.logger.error('Plugin discovery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: 'discovery_failed'
      });
      
      throw new PluginError(
        `Plugin discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'discovery'
      );
    }
  }
  
  /**
   * Loads multiple plugins from a list of package names
   * @param packages - Array of package names or package@version strings
   * @returns Array of loading results
   */
  async loadMultiplePlugins(packages: string[]): Promise<PluginLoadingResult[]> {
    this.logger.info('Loading multiple plugins', {
      packageCount: packages.length,
      packages,
      operation: 'load_multiple'
    });
    
    const results: PluginLoadingResult[] = [];
    const errors: Array<{ package: string; error: Error }> = [];
    
    // Load plugins in parallel
    const loadPromises = packages.map(async (pkg) => {
      try {
        const [packageName, version] = pkg.includes('@') && !pkg.startsWith('@') 
          ? pkg.split('@') 
          : [pkg, undefined];
        
        return await this.loadFromPackage(packageName, version);
      } catch (error) {
        errors.push({ 
          package: pkg, 
          error: error instanceof Error ? error : new Error(String(error)) 
        });
        return null;
      }
    });
    
    const loadResults = await Promise.all(loadPromises);
    
    // Collect successful results
    for (const result of loadResults) {
      if (result) {
        results.push(result);
      }
    }
    
    // Log errors but don't throw (graceful degradation)
    if (errors.length > 0) {
      this.logger.warn('Some plugins failed to load', {
        successCount: results.length,
        errorCount: errors.length,
        errors: errors.map(e => ({ package: e.package, error: e.error.message })),
        operation: 'load_multiple_partial_failure'
      });
    }
    
    this.logger.info('Multiple plugin loading completed', {
      totalPackages: packages.length,
      successCount: results.length,
      errorCount: errors.length,
      operation: 'load_multiple_complete'
    });
    
    return results;
  }
  
  /**
   * Validates that a plugin implements the required interface
   * @param plugin - Plugin to validate
   * @param packageName - Package name for error reporting
   * @throws {PluginRegistrationError} When plugin is invalid
   */
  static validatePluginInterface(plugin: unknown, packageName: string): asserts plugin is PolicyPlugin {
    if (!plugin || typeof plugin !== 'object') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' must be an object`,
        packageName
      );
    }
    
    const p = plugin as any;
    
    if (!p.name || typeof p.name !== 'string') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' must have a non-empty string name`,
        packageName
      );
    }
    
    if (!p.version || typeof p.version !== 'string') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' must have a non-empty string version`,
        packageName
      );
    }
    
    if (typeof p.validate !== 'function') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' must implement validate method`,
        packageName
      );
    }
    
    // Validate optional fields if present
    if (p.description !== undefined && typeof p.description !== 'string') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' description must be a string`,
        packageName
      );
    }
    
    if (p.configSchema !== undefined && typeof p.configSchema !== 'object') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' configSchema must be an object`,
        packageName
      );
    }
    
    if (p.metadata !== undefined && typeof p.metadata !== 'object') {
      throw new PluginRegistrationError(
        `Plugin from package '${packageName}' metadata must be an object`,
        packageName
      );
    }
  }
  
  /**
   * Gets all loaded plugins
   * @returns Array of loaded plugin results
   */
  getLoadedPlugins(): PluginLoadingResult[] {
    return Array.from(this.loadedPlugins.values());
  }
  
  /**
   * Clears the plugin cache
   */
  clearCache(): void {
    this.loadedPlugins.clear();
    
    this.logger.debug('Plugin cache cleared', {
      operation: 'cache_cleared'
    });
  }
  
  /**
   * Loads a module with timeout protection
   * @param modulePath - Module path to load
   * @returns Loaded plugin
   * @private
   */
  private async loadModuleWithTimeout(modulePath: string): Promise<PolicyPlugin> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Plugin loading timed out after ${this.options.loadTimeout}ms`));
      }, this.options.loadTimeout);
      
      // Use dynamic import to load the module
      import(modulePath)
        .then((module) => {
          clearTimeout(timeout);
          
          // Handle different export patterns
          const plugin = module.default || module;
          
          if (!plugin) {
            reject(new Error('Plugin module does not export a plugin'));
            return;
          }
          
          resolve(plugin);
        })
        .catch((error) => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  /**
   * Validates plugin interface (instance method)
   * @param plugin - Plugin to validate
   * @param packageName - Package name for error reporting
   * @private
   */
  private validatePluginInterface(plugin: unknown, packageName: string): asserts plugin is PolicyPlugin {
    PluginLoader.validatePluginInterface(plugin, packageName);
  }
  
  /**
   * Checks plugin compatibility with current environment
   * @param plugin - Plugin to check
   * @returns Array of compatibility issues
   * @private
   */
  private checkCompatibility(plugin: PolicyPlugin): string[] {
    const issues: string[] = [];
    
    // Check Kubernetes version compatibility
    if (plugin.metadata?.kubernetesVersions) {
      const supportedVersions = new Set(this.options.supportedKubernetesVersions);
      const pluginVersions = plugin.metadata.kubernetesVersions;
      
      const hasCompatibleVersion = pluginVersions.some(version => 
        supportedVersions.has(version)
      );
      
      if (!hasCompatibleVersion) {
        issues.push(
          `Plugin requires Kubernetes versions [${pluginVersions.join(', ')}] but only [${this.options.supportedKubernetesVersions.join(', ')}] are supported`
        );
      }
    }
    
    // Add more compatibility checks as needed
    
    return issues;
  }
  
  /**
   * Determines if plugin should be loaded in current environment
   * @param plugin - Plugin to check
   * @returns True if plugin should be loaded
   * @private
   */
  private shouldLoadInEnvironment(plugin: PolicyPlugin): boolean {
    // For now, always return true
    // This could be extended to check plugin metadata for environment restrictions
    return true;
  }
}