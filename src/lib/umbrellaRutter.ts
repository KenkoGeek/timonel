/**
 * @fileoverview UmbrellaRutter class for managing Helm umbrella charts with multiple subcharts
 * @since 0.2.0
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import YAML from 'yaml';

import type { Rutter } from './rutter.js';
import type { HelmChartMeta } from './helmChartWriter.js';
import { SecurityUtils } from './security.js';

/**
 * Configuration for a subchart within an umbrella chart
 *
 * @since 0.2.0
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
 * @since 0.2.0
 */
export interface UmbrellaRutterProps {
  /** Metadata for the umbrella chart */
  meta: HelmChartMeta;
  /** Array of subchart specifications */
  subcharts: SubchartSpec[];
  /** Default values for the umbrella chart */
  defaultValues?: Record<string, unknown>;
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
 * umbrella.write('./charts/my-app');
 * ```
 *
 * @since 0.2.0
 */
export class UmbrellaRutter {
  private readonly props: UmbrellaRutterProps;

  /**
   * Creates a new UmbrellaRutter instance
   *
   * @param props - Configuration properties for the umbrella chart
   * @throws {Error} If chart metadata is invalid
   *
   * @since 0.2.0
   */
  constructor(props: UmbrellaRutterProps) {
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
   * umbrella.write('./dist/my-umbrella-chart');
   * ```
   *
   * @since 0.2.0
   */
  write(outDir: string): void {
    // Validate output directory path
    const validatedOutDir = SecurityUtils.validatePath(outDir, process.cwd());

    // Create output directory structure
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(validatedOutDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(validatedOutDir, 'charts'), { recursive: true });

    // Write each subchart to charts/ directory
    for (const subchart of this.props.subcharts) {
      // Validate subchart name using centralized validation
      if (!SecurityUtils.isValidSubchartName(subchart.name)) {
        throw new Error(
          `Invalid subchart name: ${SecurityUtils.sanitizeLogMessage(subchart.name)}`,
        );
      }
      const sanitizedName = subchart.name; // Already validated by SecurityUtils
      const subchartDir = join(validatedOutDir, 'charts', sanitizedName);
      subchart.rutter.write(subchartDir);
    }

    // Generate parent Chart.yaml with dependencies
    this.writeParentChart(validatedOutDir);

    // Generate parent values.yaml
    this.writeParentValues(validatedOutDir);

    // Generate empty templates directory (umbrella charts typically don't have templates)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(validatedOutDir, 'templates'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    writeFileSync(join(validatedOutDir, 'templates', 'NOTES.txt'), this.generateNotesTemplate());
  }

  private writeParentChart(outDir: string): void {
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
    writeFileSync(join(outDir, 'Chart.yaml'), YAML.stringify(chartYaml));
  }

  private writeParentValues(outDir: string): void {
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

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    writeFileSync(join(outDir, 'values.yaml'), YAML.stringify(values));

    // Write environment-specific values files
    if (this.props.envValues) {
      for (const [env, envVals] of Object.entries(this.props.envValues)) {
        // Use centralized environment name sanitization
        const sanitizedEnv = SecurityUtils.sanitizeEnvironmentName(env);
        const envValues = this.deepMerge(values, envVals);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
        writeFileSync(join(outDir, `values-${sanitizedEnv}.yaml`), YAML.stringify(envValues));
      }
    }
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
