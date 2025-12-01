import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { createHelmExpression } from './helmControlStructures.js';

/**
 * Environment variable configuration
 */
export interface EnvVarConfig {
  name: string;
  type: 'value' | 'secret';
  scope?: string;
  defaultValue?: string;
  secretName?: string;
}

/**
 * Options for loading environment variables
 */
export interface LoadEnvVarsOptions {
  configPath?: string;
  defaultScope?: string;
  fallbackConfig?: EnvVarConfig[];
}

/**
 * Load environment variables from YAML or JSON file
 * 
 * @param options - Configuration options
 * @returns Array of environment variable configurations
 * 
 * @example
 * ```typescript
 * const envVars = loadEnvVarsConfig({
 *   configPath: './env-config.yaml',
 *   defaultScope: 'global.env'
 * });
 * ```
 */
export function loadEnvVarsConfig(options: LoadEnvVarsOptions = {}): EnvVarConfig[] {
  const { configPath, fallbackConfig = [] } = options;
  
  try {
    // If specific path provided, use it
    if (configPath) {
      if (existsSync(configPath)) {
        const data = readFileSync(configPath, 'utf-8');
        return configPath.endsWith('.yaml') || configPath.endsWith('.yml')
          ? parseYaml(data)
          : JSON.parse(data);
      }
    }
    
    // Try default locations
    const yamlPath = join(process.cwd(), 'env-config.yaml');
    if (existsSync(yamlPath)) {
      const data = readFileSync(yamlPath, 'utf-8');
      return parseYaml(data);
    }
    
    const jsonPath = join(process.cwd(), 'env-config.json');
    if (existsSync(jsonPath)) {
      const data = readFileSync(jsonPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    // Fall through to fallback
  }
  
  return fallbackConfig;
}

/**
 * Generate Kubernetes environment variables from configuration
 * 
 * @param config - Array of environment variable configurations
 * @param options - Generation options
 * @returns Array of Kubernetes env var objects
 * 
 * @example
 * ```typescript
 * const envVars = generateEnvVars(config, { defaultScope: 'global.env' });
 * ```
 */
export function generateEnvVars(
  config: EnvVarConfig[],
  options: { defaultScope?: string } = {}
): Array<Record<string, unknown>> {
  const { defaultScope = 'global.env' } = options;
  
  return config.map(item => {
    const scope = item.scope || defaultScope;
    
    if (item.type === 'value') {
      return {
        name: item.name,
        value: createHelmExpression(
          `{{ .Values.${scope}.${item.name} | default "${item.defaultValue || ''}" }}`
        ),
      };
    } else {
      // Secret reference
      return {
        name: item.name,
        valueFrom: {
          secretKeyRef: {
            name: item.secretName || createHelmExpression('{{ .Values.secretName }}'),
            key: item.name,
            optional: true,
          },
        },
      };
    }
  });
}

/**
 * Convenience function to load and generate env vars in one step
 * 
 * @param options - Combined load and generate options
 * @returns Array of Kubernetes env var objects
 * 
 * @example
 * ```typescript
 * const envVars = loadAndGenerateEnvVars({
 *   configPath: './env-config.yaml',
 *   defaultScope: 'global.env',
 *   fallbackConfig: [
 *     { name: 'VERSION', type: 'value', defaultValue: '1.0.0' }
 *   ]
 * });
 * ```
 */
export function loadAndGenerateEnvVars(
  options: LoadEnvVarsOptions & { defaultScope?: string } = {}
): Array<Record<string, unknown>> {
  const config = loadEnvVarsConfig(options);
  const genOptions = options.defaultScope ? { defaultScope: options.defaultScope } : {};
  return generateEnvVars(config, genOptions);
}
