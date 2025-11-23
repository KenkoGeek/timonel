/**
 * @fileoverview UmbrellaRutter class for managing Helm umbrella charts with multiple subcharts
 * @since 2.8.0+
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

import type { HelmChartMeta } from './helmChartWriter.js';
import type { Rutter } from './rutter.js';
import { createLogger, type TimonelLogger } from './utils/logger.js';
import { SecurityUtils } from './security.js';
import { dumpHelmAwareYaml } from './utils/helmYamlSerializer.js';

/**
 * Configuration for a subchart within an umbrella chart
 *
 * @since 2.8.0+
 */
export interface SubchartSpec {
  /** Name of the subchart */
  name: string;
  /** Rutter instance that generates the subchart */
  rutter: Rutter;
  /** Version of the subchart (optional) */
  version?: string;
  /** Helm condition for enabling/disabling the subchart */
  condition?: string;
  /** Tags for grouping subcharts */
  tags?: string[];
  /** Repository URL for the subchart */
  repository?: string;
}

/**
 * Configuration properties for UmbrellaRutter
 *
 * @since 2.8.0+
 */
export interface UmbrellaRutterProps {
  /** Metadata for the umbrella chart */
  meta: HelmChartMeta;
  /** Array of subchart specifications */
  subcharts: SubchartSpec[];
  /** Default values for the umbrella chart */
  defaultValues?: Record<string, unknown>;
  /**
   * Custom logger instance
   * @since 2.13.0
   */
  logger?: TimonelLogger;
  /** Environment-specific values */
  envValues?: Record<string, Record<string, unknown>>;
}

/**
 * UmbrellaRutter manages multiple Rutter instances as subcharts
 * to create Helm umbrella charts with dependencies.
 *
 * @example
 * ```typescript
 * const umbrella = new UmbrellaRutter({
 *   meta: { name: 'my-app', version: '1.0.0' },
 *   subcharts: [
 *     { name: 'frontend', rutter: frontendChart },
 *     { name: 'backend', rutter: backendChart }
 *   ]
 * });
 *
 * await umbrella.write('./my-app');
 * ```
 *
 * @since 2.8.0+
 */
export class UmbrellaRutter {
  private readonly props: UmbrellaRutterProps;
  private readonly logger: TimonelLogger;

  /**
   * Creates a new UmbrellaRutter instance
   *
   * @param props - Configuration properties for the umbrella chart
   * @throws {Error} If chart metadata is invalid
   *
   * @since 2.8.0+
   */
  constructor(props: UmbrellaRutterProps) {
    this.logger = props.logger ?? createLogger('umbrella-rutter');
    this.logger.info('Initializing umbrella chart', {
      name: props.meta.name,
      version: props.meta.version,
      subchartsCount: props.subcharts.length,
    });

    // Validate chart metadata
    this.validateMetadata(props.meta);
    this.props = props;
  }

  private validateMetadata(meta: HelmChartMeta): void {
    // Validate chart name follows Helm conventions
    // eslint-disable-next-line security/detect-unsafe-regex -- Safe regex for chart name validation
    if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(meta.name)) {
      throw new Error('Chart name must contain only lowercase letters, numbers, and dashes');
    }

    // Validate semantic versioning
    // eslint-disable-next-line security/detect-unsafe-regex -- Safe regex for semver validation
    if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(meta.version)) {
      throw new Error('Chart version must follow semantic versioning (e.g., 1.0.0)');
    }
  }

  /**
   * Write the umbrella chart with all subcharts to the output directory
   *
   * Creates the complete umbrella chart structure including:
   * - Parent Chart.yaml with dependencies
   * - Parent values.yaml with global and subchart values
   * - Individual subchart directories under charts/
   * - NOTES.txt template
   *
   * @param outDir - Output directory path for the umbrella chart
   * @throws {Error} If output directory path is invalid
   *
   * @example
   * ```typescript
   * await umbrella.write('./dist/my-umbrella-chart');
   * ```
   *
   * @since 2.8.0+
   */
  async write(outDir: string): Promise<void> {
    // Validate output directory path
    const validatedOutDir = SecurityUtils.validatePath(outDir, process.cwd(), {
      allowAbsolute: true,
    });

    // Create output directory structure
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    await mkdir(validatedOutDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    await mkdir(join(validatedOutDir, 'charts'), { recursive: true });

    // Write each subchart to charts/ directory in parallel
    const subchartPromises = this.props.subcharts.map(async (subchart) => {
      // Validate subchart name using centralized validation
      if (!SecurityUtils.isValidSubchartName(subchart.name)) {
        throw new Error(
          `Invalid subchart name: ${SecurityUtils.sanitizeLogMessage(subchart.name)}`,
        );
      }
      const sanitizedName = subchart.name; // Already validated by SecurityUtils
      const subchartDir = join(validatedOutDir, 'charts', sanitizedName);
      await subchart.rutter.write(subchartDir);
    });

    await Promise.all(subchartPromises);

    // Generate parent Chart.yaml with dependencies
    await this.writeParentChart(validatedOutDir);

    // Generate parent values.yaml
    await this.writeParentValues(validatedOutDir);

    // Generate empty templates directory (umbrella charts typically don't have templates)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    await mkdir(join(validatedOutDir, 'templates'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    await writeFile(join(validatedOutDir, 'templates', 'NOTES.txt'), this.generateNotesTemplate());
  }

  private async writeParentChart(outDir: string): Promise<void> {
    const chartYaml = {
      apiVersion: 'v2',
      name: this.props.meta.name,
      description: this.props.meta.description || `${this.props.meta.name} umbrella chart`,
      type: 'application',
      version: this.props.meta.version,
      appVersion: this.props.meta.appVersion,
      keywords: this.props.meta.keywords || [],
      home: this.props.meta.home,
      sources: this.props.meta.sources,
      maintainers: this.props.meta.maintainers,
      dependencies: this.props.subcharts.map((subchart) => {
        // Subchart name already validated in write() method
        return {
          name: subchart.name,
          version: subchart.version || '0.1.0',
          repository: subchart.repository || `file://./charts/${subchart.name}`,
          ...(subchart.condition && { condition: subchart.condition }),
          ...(subchart.tags && { tags: subchart.tags }),
        };
      }),
    };

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    await writeFile(join(outDir, 'Chart.yaml'), dumpHelmAwareYaml(chartYaml));
  }

  private async writeParentValues(outDir: string): Promise<void> {
    const values: Record<string, unknown> = {
      // Global values that can be shared across subcharts
      global: {},
      // Individual subchart values
      ...this.props.defaultValues,
    };

    // Add subchart-specific value sections
    for (const subchart of this.props.subcharts) {
      if (!(subchart.name in values)) {
        values[subchart.name] = {
          enabled: true,
        };
      }
    }

    const promises: Promise<void>[] = [];

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    promises.push(writeFile(join(outDir, 'values.yaml'), dumpHelmAwareYaml(values)));

    // Write environment-specific values files
    if (this.props.envValues) {
      for (const [env, envVals] of Object.entries(this.props.envValues)) {
        // Use centralized environment name sanitization
        const sanitizedEnv = SecurityUtils.sanitizeEnvironmentName(env);
        const envValues = this.deepMerge(values, envVals);

        promises.push(
          writeFile(join(outDir, `values-${sanitizedEnv}.yaml`), dumpHelmAwareYaml(envValues)),
        );
      }
    }

    await Promise.all(promises);
  }

  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ): Record<string, unknown> {
    const result = { ...target };
    for (const [key, value] of Object.entries(source)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // eslint-disable-next-line security/detect-object-injection -- Safe object property access in deep merge
        result[key] = this.deepMerge(
          // eslint-disable-next-line security/detect-object-injection -- Safe object property access in deep merge
          (result[key] as Record<string, unknown>) || {},
          value as Record<string, unknown>,
        );
      } else {
        // eslint-disable-next-line security/detect-object-injection -- Safe object property access in deep merge
        result[key] = value;
      }
    }
    return result;
  }

  private generateNotesTemplate(): string {
    return `1. Get the application URLs by running these commands:
{{- range $subchart := .Values }}
{{- if and (hasKey $subchart "enabled") $subchart.enabled }}
  {{ $subchart | quote }} is enabled
{{- end }}
{{- end }}

2. Check the status of subcharts:
  helm list -A

3. For more information about each subchart, check:
${this.props.subcharts.map((s) => `  - charts/${s.name}/README.md`).join('\n')}
`;
  }
}
