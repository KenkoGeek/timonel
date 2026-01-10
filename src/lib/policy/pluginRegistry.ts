/**
 * Plugin Registry
 *
 * This module manages the lifecycle of policy plugins including registration,
 * validation, and configuration management.
 *
 * @since 3.0.0
 */

import type { PolicyPlugin } from './types.js';
import { PluginRegistrationError } from './errors.js';

/**
 * Registry for managing policy plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, PolicyPlugin>();
  private pluginConfigs = new Map<string, unknown>();

  /**
   * Registers a policy plugin with optional configuration
   * @param plugin - The policy plugin to register
   * @param config - Optional plugin-specific configuration
   * @throws {PluginRegistrationError} When plugin validation fails
   */
  register(plugin: PolicyPlugin, config?: unknown): void {
    this.validatePlugin(plugin);

    // Check for duplicate plugin names
    if (this.plugins.has(plugin.name)) {
      throw new PluginRegistrationError(
        `Plugin with name '${plugin.name}' is already registered`,
        plugin.name,
      );
    }

    this.plugins.set(plugin.name, plugin);

    if (config !== undefined) {
      this.pluginConfigs.set(plugin.name, config);
    }
  }

  /**
   * Gets a plugin by name
   * @param name - Plugin name
   * @returns Plugin instance or undefined if not found
   */
  getPlugin(name: string): PolicyPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Gets all registered plugins
   * @returns Array of all registered plugins
   */
  getAllPlugins(): PolicyPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Gets plugin configuration
   * @param pluginName - Name of the plugin
   * @returns Plugin configuration or undefined if not set
   */
  getPluginConfig(pluginName: string): unknown {
    return this.pluginConfigs.get(pluginName);
  }

  /**
   * Checks if a plugin is registered
   * @param name - Plugin name
   * @returns True if plugin is registered
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Gets the number of registered plugins
   * @returns Number of registered plugins
   */
  getPluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Unregisters a plugin
   * @param name - Plugin name to unregister
   * @returns True if plugin was removed, false if not found
   */
  unregister(name: string): boolean {
    const removed = this.plugins.delete(name);
    if (removed) {
      this.pluginConfigs.delete(name);
    }
    return removed;
  }

  /**
   * Clears all registered plugins
   */
  clear(): void {
    this.plugins.clear();
    this.pluginConfigs.clear();
  }

  /**
   * Validates that a plugin implements the required interface
   * @param plugin - Plugin to validate
   * @throws {PluginRegistrationError} When plugin is invalid
   * @private
   */
  private validatePlugin(plugin: PolicyPlugin): void {
    if (!plugin) {
      throw new PluginRegistrationError('Plugin cannot be null or undefined');
    }

    if (typeof plugin !== 'object') {
      throw new PluginRegistrationError('Plugin must be an object');
    }

    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new PluginRegistrationError('Plugin must have a non-empty string name');
    }

    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new PluginRegistrationError('Plugin must have a non-empty string version', plugin.name);
    }

    if (typeof plugin.validate !== 'function') {
      throw new PluginRegistrationError('Plugin must implement validate method', plugin.name);
    }

    // Validate optional fields if present
    if (plugin.description !== undefined && typeof plugin.description !== 'string') {
      throw new PluginRegistrationError('Plugin description must be a string', plugin.name);
    }

    if (plugin.configSchema !== undefined && typeof plugin.configSchema !== 'object') {
      throw new PluginRegistrationError('Plugin configSchema must be an object', plugin.name);
    }

    if (plugin.metadata !== undefined && typeof plugin.metadata !== 'object') {
      throw new PluginRegistrationError('Plugin metadata must be an object', plugin.name);
    }
  }
}
