import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

import YAML from 'yaml';

import type { Rutter } from './Rutter';
import type { HelmChartMeta } from './HelmChartWriter';

export interface SubchartSpec {
  name: string;
  rutter: Rutter;
  version?: string;
  condition?: string;
  tags?: string[];
  repository?: string;
}

export interface UmbrellaRutterProps {
  meta: HelmChartMeta;
  subcharts: SubchartSpec[];
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
}

/**
 * UmbrellaRutter manages multiple Rutter instances as subcharts
 * to create Helm umbrella charts with dependencies.
 */
export class UmbrellaRutter {
  private readonly props: UmbrellaRutterProps;

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
   */
  write(outDir: string): void {
    // Sanitize paths to prevent directory traversal

    const path = require('path');
    const sanitizedOutDir = path.normalize(path.resolve(outDir));
    const cwd = process.cwd();
    if (!sanitizedOutDir.startsWith(cwd)) {
      throw new Error('Output directory must be within current working directory');
    }

    // Create output directory structure
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(sanitizedOutDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(sanitizedOutDir, 'charts'), { recursive: true });

    // Write each subchart to charts/ directory
    for (const subchart of this.props.subcharts) {
      const subchartDir = join(sanitizedOutDir, 'charts', subchart.name);
      subchart.rutter.write(subchartDir);
    }

    // Generate parent Chart.yaml with dependencies
    this.writeParentChart(sanitizedOutDir);

    // Generate parent values.yaml
    this.writeParentValues(sanitizedOutDir);

    // Generate empty templates directory (umbrella charts typically don't have templates)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(sanitizedOutDir, 'templates'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    writeFileSync(join(sanitizedOutDir, 'templates', 'NOTES.txt'), this.generateNotesTemplate());
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
      dependencies: this.props.subcharts.map((subchart) => ({
        name: subchart.name,
        version: subchart.version || '0.1.0',
        repository: subchart.repository || `file://./charts/${subchart.name}`,
        condition: subchart.condition,
        tags: subchart.tags,
      })),
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
        const envValues = this.deepMerge(values, envVals);
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
        writeFileSync(join(outDir, `values-${env}.yaml`), YAML.stringify(envValues));
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
