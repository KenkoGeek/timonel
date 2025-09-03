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
    this.props = props;
  }

  /**
   * Write the umbrella chart with all subcharts to the output directory
   */
  write(outDir: string): void {
    // Create output directory structure
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(outDir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(outDir, 'charts'), { recursive: true });

    // Write each subchart to charts/ directory
    for (const subchart of this.props.subcharts) {
      const subchartDir = join(outDir, 'charts', subchart.name);
      subchart.rutter.write(subchartDir);
    }

    // Generate parent Chart.yaml with dependencies
    this.writeParentChart(outDir);

    // Generate parent values.yaml
    this.writeParentValues(outDir);

    // Generate empty templates directory (umbrella charts typically don't have templates)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    mkdirSync(join(outDir, 'templates'), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    writeFileSync(join(outDir, 'templates', 'NOTES.txt'), this.generateNotesTemplate());
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
        const envValues = { ...values, ...envVals };
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
        writeFileSync(join(outDir, `values-${env}.yaml`), YAML.stringify(envValues));
      }
    }
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
