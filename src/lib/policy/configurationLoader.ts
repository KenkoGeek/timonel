/**
 * Configuration Loader
 *
 * This module provides configuration loading and validation for policy plugins.
 * It supports environment-specific configuration, schema validation, and
 * configuration inheritance.
 *
 * @since 3.0.0
 */

import { createLogger, type TimonelLogger } from '../utils/logger.js';

import type { JSONSchema, PolicyPlugin, ConfigurationLoaderOptions } from './types.js';
import { PluginConfigurationError } from './errors.js';

/**
 * Configuration source types
 */
export type ConfigurationSource = 'environment' | 'file' | 'inline' | 'default';

/**
 * Configuration entry with metadata
 */
export interface ConfigurationEntry {
  /** Configuration value */
  readonly value: unknown;

  /** Source of the configuration */
  readonly source: ConfigurationSource;

  /** Environment this configuration applies to */
  readonly environment?: string;

  /** Priority for configuration merging (higher wins) */
  readonly priority: number;

  /** Validation schema for this configuration */
  readonly schema?: JSONSchema;
}

/**
 * Plugin configuration with validation
 */
export interface PluginConfiguration {
  /** Plugin name */
  readonly pluginName: string;

  /** Merged configuration value */
  readonly config: Record<string, unknown>;

  /** Configuration entries that were merged */
  readonly entries: ConfigurationEntry[];

  /** Whether configuration was validated */
  readonly validated: boolean;

  /** Validation errors if any */
  readonly validationErrors?: string[];
}

/**
 * Environment-specific configuration
 */
export interface EnvironmentConfiguration {
  /** Environment name (e.g., 'development', 'production') */
  readonly environment: string;

  /** Plugin configurations for this environment */
  readonly plugins: Record<string, unknown>;

  /** Global configuration options */
  readonly global?: Record<string, unknown>;
}

/**
 * Default configuration loader options
 */
const DEFAULT_LOADER_OPTIONS: Required<ConfigurationLoaderOptions> = {
  defaultEnvironment: 'development',
  validateSchemas: true,
  allowUnknownProperties: false,
  configurationFiles: [],
  environmentPrefix: 'TIMONEL_POLICY',
};

/**
 * Configuration priority levels
 */
const CONFIGURATION_PRIORITIES = {
  default: 0,
  file: 10,
  environment: 20,
  inline: 30,
} as const;

/**
 * Configuration loader for policy plugins
 */
export class ConfigurationLoader {
  private readonly options: Required<ConfigurationLoaderOptions>;
  private readonly logger: TimonelLogger;
  private readonly configurations = new Map<string, ConfigurationEntry[]>();
  private readonly environmentConfigs = new Map<string, EnvironmentConfiguration>();

  constructor(options: ConfigurationLoaderOptions = {}) {
    this.options = { ...DEFAULT_LOADER_OPTIONS, ...options };
    this.logger = createLogger('policy-config-loader');

    this.logger.debug('ConfigurationLoader initialized', {
      options: this.options,
      operation: 'config_loader_init',
    });
  }

  /**
   * Loads configuration for a plugin
   * @param plugin - Plugin to load configuration for
   * @param environment - Target environment
   * @param inlineConfig - Inline configuration to merge
   * @returns Plugin configuration
   */
  async loadPluginConfiguration(
    plugin: PolicyPlugin,
    environment?: string,
    inlineConfig?: Record<string, unknown>,
  ): Promise<PluginConfiguration> {
    const targetEnvironment = environment || this.options.defaultEnvironment;

    this.logger.debug('Loading plugin configuration', {
      pluginName: plugin.name,
      environment: targetEnvironment,
      hasInlineConfig: inlineConfig !== undefined,
      operation: 'load_plugin_config',
    });

    // Collect configuration entries from all sources
    const entries = await this.collectConfigurationEntries(plugin, targetEnvironment, inlineConfig);

    // Merge configurations by priority
    const mergedConfig = this.mergeConfigurations(entries);

    // Validate configuration if schema is provided
    const validationResult = this.validatePluginConfiguration(plugin, mergedConfig);

    const result: PluginConfiguration = {
      pluginName: plugin.name,
      config: mergedConfig,
      entries,
      validated: validationResult.validated,
      ...(validationResult.validationErrors && {
        validationErrors: validationResult.validationErrors,
      }),
    };

    this.logger.info('Plugin configuration loaded', {
      pluginName: plugin.name,
      environment: targetEnvironment,
      entryCount: entries.length,
      validated: validationResult.validated,
      hasErrors: validationResult.validationErrors !== undefined,
      operation: 'plugin_config_loaded',
    });

    return result;
  }

  /**
   * Collects configuration entries from all sources
   * @private
   */
  private async collectConfigurationEntries(
    plugin: PolicyPlugin,
    targetEnvironment: string,
    inlineConfig?: Record<string, unknown>,
  ): Promise<ConfigurationEntry[]> {
    const entries: ConfigurationEntry[] = [];

    // 1. Default configuration (if plugin provides it)
    if (plugin.metadata?.defaultConfig) {
      entries.push({
        value: plugin.metadata.defaultConfig,
        source: 'default',
        priority: CONFIGURATION_PRIORITIES.default,
        ...(plugin.configSchema && { schema: plugin.configSchema }),
      });
    }

    // 2. File-based configuration
    const fileConfig = await this.loadFileConfiguration(plugin.name, targetEnvironment);
    if (fileConfig) {
      entries.push({
        value: fileConfig,
        source: 'file',
        environment: targetEnvironment,
        priority: CONFIGURATION_PRIORITIES.file,
        ...(plugin.configSchema && { schema: plugin.configSchema }),
      });
    }

    // 3. Environment variable configuration
    const envConfig = this.loadEnvironmentVariableConfiguration(plugin.name);
    if (envConfig) {
      entries.push({
        value: envConfig,
        source: 'environment',
        priority: CONFIGURATION_PRIORITIES.environment,
        ...(plugin.configSchema && { schema: plugin.configSchema }),
      });
    }

    // 4. Inline configuration (highest priority)
    if (inlineConfig) {
      entries.push({
        value: inlineConfig,
        source: 'inline',
        priority: CONFIGURATION_PRIORITIES.inline,
        ...(plugin.configSchema && { schema: plugin.configSchema }),
      });
    }

    return entries;
  }

  /**
   * Validates plugin configuration
   * @private
   */
  private validatePluginConfiguration(
    plugin: PolicyPlugin,
    mergedConfig: Record<string, unknown>,
  ): { validated: boolean; validationErrors?: string[] } {
    let validated = false;
    let validationErrors: string[] | undefined;

    if (this.options.validateSchemas && plugin.configSchema) {
      try {
        this.validateConfiguration(mergedConfig, plugin.configSchema, plugin.name);
        validated = true;
      } catch (error) {
        validationErrors = [error instanceof Error ? error.message : String(error)];

        this.logger.warn('Plugin configuration validation failed', {
          pluginName: plugin.name,
          errors: validationErrors,
          operation: 'config_validation_failed',
        });
      }
    }

    return { validated, ...(validationErrors && { validationErrors }) };
  }

  /**
   * Loads environment-specific configuration
   * @param environment - Environment name
   * @returns Environment configuration
   */
  async loadEnvironmentConfiguration(
    environment: string,
  ): Promise<EnvironmentConfiguration | undefined> {
    if (this.environmentConfigs.has(environment)) {
      return this.environmentConfigs.get(environment);
    }

    this.logger.debug('Loading environment configuration', {
      environment,
      operation: 'load_env_config',
    });

    // Load from configuration files
    const envConfig = await this.loadEnvironmentFromFiles(environment);

    if (envConfig) {
      this.environmentConfigs.set(environment, envConfig);

      this.logger.info('Environment configuration loaded', {
        environment,
        pluginCount: Object.keys(envConfig.plugins).length,
        hasGlobal: envConfig.global !== undefined,
        operation: 'env_config_loaded',
      });
    }

    return envConfig;
  }

  /**
   * Validates configuration against a JSON schema
   * @param config - Configuration to validate
   * @param schema - JSON schema to validate against
   * @param pluginName - Plugin name for error reporting
   * @throws {PluginConfigurationError} When validation fails
   */
  validateConfiguration(
    config: Record<string, unknown>,
    schema: JSONSchema,
    pluginName: string,
  ): void {
    try {
      this.validateAgainstSchema(config, schema, []);
    } catch (error) {
      throw new PluginConfigurationError(
        `Configuration validation failed for plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`,
        pluginName,
        undefined,
        { config, schema, validationError: error },
      );
    }
  }

  /**
   * Adds a configuration entry for a plugin
   * @param pluginName - Plugin name
   * @param entry - Configuration entry to add
   */
  addConfigurationEntry(pluginName: string, entry: ConfigurationEntry): void {
    if (!this.configurations.has(pluginName)) {
      this.configurations.set(pluginName, []);
    }

    const entries = this.configurations.get(pluginName)!;
    entries.push(entry);

    // Sort by priority (highest first)
    entries.sort((a, b) => b.priority - a.priority);

    this.logger.debug('Configuration entry added', {
      pluginName,
      source: entry.source,
      priority: entry.priority,
      operation: 'config_entry_added',
    });
  }

  /**
   * Gets all configuration entries for a plugin
   * @param pluginName - Plugin name
   * @returns Array of configuration entries
   */
  getConfigurationEntries(pluginName: string): ConfigurationEntry[] {
    return this.configurations.get(pluginName) || [];
  }

  /**
   * Clears all cached configurations
   */
  clearCache(): void {
    this.configurations.clear();
    this.environmentConfigs.clear();

    this.logger.debug('Configuration cache cleared', {
      operation: 'config_cache_cleared',
    });
  }

  /**
   * Loads file-based configuration for a plugin
   * @param _pluginName - Plugin name (unused)
   * @param _environment - Target environment (unused)
   * @returns Configuration object or undefined
   * @private
   */
  private async loadFileConfiguration(
    _pluginName: string,
    _environment: string,
  ): Promise<Record<string, unknown> | undefined> {
    // For now, return undefined as file loading is not implemented
    // This would typically load from JSON/YAML files
    return undefined;
  }

  /**
   * Loads environment variable configuration for a plugin
   * @param pluginName - Plugin name
   * @returns Configuration object or undefined
   * @private
   */
  private loadEnvironmentVariableConfiguration(
    pluginName: string,
  ): Record<string, unknown> | undefined {
    if (!pluginName) {
      return undefined;
    }

    const prefix = `${this.options.environmentPrefix}_${pluginName.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const config: Record<string, unknown> = Object.create(null);
    let hasConfig = false;

    // Scan environment variables with the plugin prefix
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix + '_')) {
        const configKey = key.substring(prefix.length + 1).toLowerCase();
        // eslint-disable-next-line security/detect-object-injection
        config[configKey] = this.parseEnvironmentValue(value);
        hasConfig = true;
      }
    }

    return hasConfig ? config : undefined;
  }

  /**
   * Loads environment configuration from files
   * @param _environment - Environment name (unused)
   * @returns Environment configuration or undefined
   * @private
   */
  private async loadEnvironmentFromFiles(
    _environment: string,
  ): Promise<EnvironmentConfiguration | undefined> {
    // For now, return undefined as file loading is not implemented
    // This would typically load from configuration files
    return undefined;
  }

  /**
   * Merges configuration entries by priority
   * @param entries - Configuration entries to merge
   * @returns Merged configuration
   * @private
   */
  private mergeConfigurations(entries: ConfigurationEntry[]): Record<string, unknown> {
    // Sort by priority (lowest first for proper merging)
    const sortedEntries = [...entries].sort((a, b) => a.priority - b.priority);

    let merged: Record<string, unknown> = {};

    for (const entry of sortedEntries) {
      if (entry.value && typeof entry.value === 'object' && !Array.isArray(entry.value)) {
        merged = { ...merged, ...(entry.value as Record<string, unknown>) };
      }
    }

    return merged;
  }

  /**
   * Parses environment variable value to appropriate type
   * @param value - Environment variable value
   * @returns Parsed value
   * @private
   */
  private parseEnvironmentValue(value: string | undefined): unknown {
    if (!value) return undefined;

    // Try to parse as JSON first
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if not valid JSON
      return value;
    }
  }

  /**
   * Validates a configuration object against a JSON schema
   * @param config - Configuration to validate
   * @param schema - JSON schema
   * @param path - Current path for error reporting
   * @throws {Error} When validation fails
   * @private
   */
  private validateAgainstSchema(config: unknown, schema: JSONSchema, path: string[]): void {
    this.validateBasicType(config, schema, path);
    this.validateObjectProperties(config, schema, path);
  }

  /**
   * Validates basic type constraints
   * @private
   */
  private validateBasicType(config: unknown, schema: JSONSchema, path: string[]): void {
    if (schema.type) {
      const actualType = Array.isArray(config) ? 'array' : typeof config;
      if (actualType !== schema.type) {
        throw new Error(`Expected ${schema.type} at ${path.join('.')}, got ${actualType}`);
      }
    }
  }

  /**
   * Validates object properties
   * @private
   */
  private validateObjectProperties(config: unknown, schema: JSONSchema, path: string[]): void {
    if (
      schema.type === 'object' &&
      schema.properties &&
      typeof config === 'object' &&
      config !== null
    ) {
      const configObj = config as Record<string, unknown>;

      this.validateRequiredProperties(configObj, schema, path);
      this.validateEachProperty(configObj, schema, path);
    }
  }

  /**
   * Validates required properties
   * @private
   */
  private validateRequiredProperties(
    configObj: Record<string, unknown>,
    schema: JSONSchema,
    path: string[],
  ): void {
    if (schema.required) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in configObj)) {
          throw new Error(`Missing required property '${requiredProp}' at ${path.join('.')}`);
        }
      }
    }
  }

  /**
   * Validates each property in the object
   * @private
   */
  private validateEachProperty(
    configObj: Record<string, unknown>,
    schema: JSONSchema,
    path: string[],
  ): void {
    for (const [propName, propValue] of Object.entries(configObj)) {
      // eslint-disable-next-line security/detect-object-injection
      const propSchema = schema.properties?.[propName];
      if (propSchema) {
        this.validateAgainstSchema(propValue, propSchema, [...path, propName]);
      } else if (!this.options.allowUnknownProperties && !schema.additionalProperties) {
        throw new Error(`Unknown property '${propName}' at ${path.join('.')}`);
      }
    }
  }
}
