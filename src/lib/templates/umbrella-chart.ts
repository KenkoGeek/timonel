import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import type { App } from 'cdk8s';
import { Chart, ApiObject } from 'cdk8s';

import type { ChartProps } from '../types.js';
import type { UmbrellaRutter } from '../umbrellaRutter.js';
import { dumpHelmAwareYaml } from '../utils/helmYamlSerializer.js';

// Interface for charts that support Helm generation
interface HelmChart extends Chart {
  writeHelmChart(outputDir: string): void;
}

/**
 * Generate an umbrella chart template
 * @param name Chart name
 * @returns Template string for umbrella.ts
 * @since 2.8.4
 */
export function generateUmbrellaChart(name: string): string {
  return `import { App } from 'cdk8s';
import { UmbrellaChart } from 'timonel';

export function synth(outDir: string) {
  const app = new App({
    outdir: outDir,
    outputFileExtension: '.yaml',
    yamlOutputType: 'FILE_PER_RESOURCE'
  });

  const chart = new UmbrellaChart(app, '${name}', {
    name: '${name}',
    version: '0.1.0',
    description: '${name} umbrella chart',
    services: [],
    subcharts: []
  });

  // Generate Helm chart files
  chart.writeHelmChart(outDir);
  
  // Also generate CDK8s YAML files
  app.synth();
}

// Auto-execute when run directly
if (import.meta.url === new URL(import.meta.url).href) {
  synth(process.argv[2] || 'dist');
}

export default synth;`;
}

/**
 * UmbrellaChart class for managing multiple subcharts
 * @since 2.8.4
 */
export class UmbrellaChartTemplate extends Chart {
  private _umbrellaRutter?: UmbrellaRutter;

  constructor(
    scope: App,
    id: string,
    private readonly config: ChartProps,
  ) {
    super(scope, id);
    this.configure();
  }

  /**
   * Configure the umbrella chart with basic resources and prepare UmbrellaRutter
   * @since 2.8.4
   * @private
   */
  private configure() {
    // Create a basic ConfigMap to indicate the umbrella chart is working
    new ApiObject(this, 'umbrella-info', {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${this.config.name}-info`,
        labels: {
          'app.kubernetes.io/name': this.config.name,
          'app.kubernetes.io/component': 'umbrella-chart',
          'app.kubernetes.io/version': this.config.version,
        },
      },
      data: {
        'chart.name': this.config.name,
        'chart.version': this.config.version,
        'chart.description': this.config.description || '',
        'subcharts.count': String(this.config.subcharts?.length || 0),
      },
    });

    // Note: Namespace is handled by writeHelmChart() method in templates/namespace.yaml

    // Add services
    this.config.services?.forEach((svc, index) => {
      this._addService(svc, index);
    });

    // Add subcharts
    this.config.subcharts?.forEach((subchart, index) => {
      this._addSubchart(subchart, index);
    });
  }

  private _addService(svc: { name: string; port: number; targetPort: number }, index: number) {
    new ApiObject(this, `service-${index}`, {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: svc.name,
        labels: {
          'app.kubernetes.io/name': this.config.name,
          'app.kubernetes.io/component': 'service',
        },
      },
      spec: {
        ports: [
          {
            port: svc.port,
            targetPort: svc.targetPort,
          },
        ],
        selector: {
          'app.kubernetes.io/name': svc.name,
        },
      },
    });
  }

  private _addSubchart(_subchart: { name: string; chart: Chart | (() => Chart) }, _index: number) {
    // Subchart integration will be implemented in future versions
    // For now, we just acknowledge their existence in the ConfigMap
  }

  /**
   * Write Helm chart files using basic Helm structure
   * @since 2.8.4
   * @param outputDir - Directory to write the Helm chart files
   */
  writeHelmChart(outputDir: string): void {
    // Ensure output directory exists
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(outputDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(outputDir, { recursive: true });
    }

    // Create Chart.yaml
    const chartYaml = {
      apiVersion: 'v2',
      name: this.config.name,
      description: this.config.description || 'A Helm umbrella chart',
      type: 'application',
      version: this.config.version,
      appVersion: this.config.version,
      dependencies:
        this.config.subcharts?.map((subchart) => ({
          name: subchart.name,
          version: '1.0.0',
          repository: 'file://./charts/' + subchart.name,
        })) || [],
    };
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(outputDir, 'Chart.yaml'), dumpHelmAwareYaml(chartYaml));

    // Create values.yaml
    const valuesYaml = {
      global: {
        namespace: this.config.name,
      },
      // Add subchart values
      ...Object.fromEntries(
        this.config.subcharts?.map((subchart) => [
          subchart.name,
          {
            enabled: true,
          },
        ]) || [],
      ),
    };
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(outputDir, 'values.yaml'), dumpHelmAwareYaml(valuesYaml));

    // Create charts directory
    const chartsDir = join(outputDir, 'charts');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(chartsDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(chartsDir, { recursive: true });
    }

    // Generate Helm charts for each subchart
    this.config.subcharts?.forEach((subchart) => {
      const subchartDir = join(chartsDir, subchart.name);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!existsSync(subchartDir)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(subchartDir, { recursive: true });
      }

      // Handle both function exports and direct chart instances
      let subchartInstance: HelmChart | null = null;

      if (typeof subchart.chart === 'function') {
        // If it's a function (createChart), call it to get the instance
        try {
          subchartInstance = subchart.chart() as HelmChart;
        } catch (error) {
          console.warn(`Failed to create subchart ${subchart.name}:`, error);
          return;
        }
      } else {
        // If it's already an instance, use it directly
        subchartInstance = subchart.chart as HelmChart;
      }

      // Call writeHelmChart on the subchart instance
      if (subchartInstance && typeof subchartInstance.writeHelmChart === 'function') {
        subchartInstance.writeHelmChart(subchartDir);
      }
    });

    // Create templates directory
    const templatesDir = join(outputDir, 'templates');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(templatesDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(templatesDir, { recursive: true });
    }

    // Create shared namespace.yaml in templates
    const namespaceYaml = {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: '{{ .Values.global.namespace | default .Release.Name }}',
        labels: {
          'app.kubernetes.io/name': '{{ include "chart.name" . }}',
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
          'app.kubernetes.io/version': '{{ .Chart.AppVersion }}',
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
        },
      },
    };

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(templatesDir, 'namespace.yaml'), dumpHelmAwareYaml(namespaceYaml));

    // Create _helpers.tpl
    const helpersTpl = `{{/*
Expand the name of the chart.
*/}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "chart.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
`;
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(templatesDir, '_helpers.tpl'), helpersTpl);
  }
}
