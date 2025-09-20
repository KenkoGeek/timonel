import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import type { App } from 'cdk8s';
import { Chart, ApiObject } from 'cdk8s';

import type { ChartProps } from '../types.js';
import type { UmbrellaRutter } from '../umbrellaRutter.js';
import { dumpHelmAwareYaml } from '../utils/helmYamlSerializer.js';
import { generateHelpersTemplate } from '../utils/helmHelpers.js';

import { createFlexibleSubchart } from './flexible-subchart.js';

// Interface for charts that support Helm generation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  private _addSubchart(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    index: number,
  ) {
    try {
      let _subchartInstance: Chart;

      // Create a flexible subchart that can handle any type of input
      const {
        name: _name,
        version: _version,
        description: _description,
        ...subchartProps
      } = subchart;
      const flexibleSubchart = createFlexibleSubchart(this, `${subchart.name}-${index}`, {
        name: subchart.name,
        version: (subchart.version as string) || '1.0.0',
        description: (subchart.description as string) || `${subchart.name} subchart`,
        ...subchartProps,
      });

      // Handle different types of chart inputs
      if (typeof subchart.chart === 'function') {
        try {
          // Try calling with scope and id parameters
          _subchartInstance = (subchart.chart as (scope: Chart, id: string) => Chart)(
            this,
            `${subchart.name}-${index}`,
          );
        } catch {
          // If that fails, try calling without parameters
          _subchartInstance = (subchart.chart as () => Chart)();
        }
      } else if (subchart.chart && typeof subchart.chart === 'object') {
        // If it's an object, try to use it as a construct
        if (subchart.chart.constructor && subchart.chart.constructor.name !== 'Object') {
          // It's a cdk8s construct, add it to the flexible subchart
          flexibleSubchart.addConstruct(subchart.chart);
        } else {
          // It's a manifest object, add it as a manifest
          flexibleSubchart.addManifest(subchart.chart);
        }
        _subchartInstance = flexibleSubchart;
      } else {
        // Use the flexible subchart as fallback
        _subchartInstance = flexibleSubchart;
      }

      // Note: Don't add dependency to avoid circular dependencies
      // The subchart is already a child of this umbrella chart

      console.log(`Added flexible subchart: ${subchart.name}`);
    } catch (_error) {
      console.warn(`Failed to add subchart ${subchart.name}:`, _error);
      // Create a basic flexible subchart as fallback
      const _fallbackSubchart = createFlexibleSubchart(this, `${subchart.name}-fallback-${index}`, {
        name: subchart.name,
        version: (subchart.version as string) || '1.0.0',
        description: `${subchart.name} subchart (fallback)`,
      });
      // Note: Don't add dependency to avoid circular dependencies
      console.log(`Created fallback subchart: ${subchart.name}`);
    }
  }

  /**
   * Create a basic Helm chart structure for subcharts that don't have writeHelmChart
   * @since 2.8.4
   * @param subchartName - Name of the subchart
   * @param subchartDir - Directory to write the subchart files
   * @private
   */
  private _createBasicSubchart(subchartName: string, subchartDir: string) {
    // Create Chart.yaml for the subchart
    const subchartYaml = {
      apiVersion: 'v2',
      name: subchartName,
      description: `${subchartName} subchart`,
      type: 'application',
      version: '1.0.0',
      appVersion: '1.0.0',
    };
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(subchartDir, 'Chart.yaml'), dumpHelmAwareYaml(subchartYaml));

    // Create values.yaml for the subchart
    const subchartValues = {
      enabled: true,
      replicas: 1,
      image: {
        repository: 'nginx',
        tag: 'latest',
      },
    };
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(subchartDir, 'values.yaml'), dumpHelmAwareYaml(subchartValues));

    // Create templates directory
    const templatesDir = join(subchartDir, 'templates');
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(templatesDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(templatesDir, { recursive: true });
    }

    // Create _helpers.tpl for the subchart
    const helpersTpl = generateHelpersTemplate('aws', undefined, {
      includeKubernetes: true,
      includeSprig: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(templatesDir, '_helpers.tpl'), helpersTpl);

    console.log(`Created basic Helm chart structure for subchart: ${subchartName}`);
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
    // eslint-disable-next-line sonarjs/cognitive-complexity
    this.config.subcharts?.forEach((subchart) => {
      const subchartDir = join(chartsDir, subchart.name);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (!existsSync(subchartDir)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        mkdirSync(subchartDir, { recursive: true });
      }

      // Create a flexible subchart that can handle any type of input
      const {
        name: _name,
        version: _version,
        description: _description,
        ...subchartProps
      } = subchart;
      const flexibleSubchart = createFlexibleSubchart(this, `${subchart.name}-chart`, {
        name: subchart.name,
        version: (subchart.version as string) || '1.0.0',
        description: (subchart.description as string) || `${subchart.name} subchart`,
        ...subchartProps,
      });

      // Handle different types of chart inputs
      if (typeof subchart.chart === 'function') {
        try {
          // Try calling with scope and id parameters
          const chartInstance = (subchart.chart as (scope: Chart, id: string) => Chart)(
            this,
            `${subchart.name}-chart`,
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (chartInstance && typeof (chartInstance as any).writeHelmChart === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (chartInstance as any).writeHelmChart(subchartDir);
          } else {
            flexibleSubchart.writeHelmChart(subchartDir);
          }
        } catch {
          // If that fails, try calling without parameters
          try {
            const chartInstance = (subchart.chart as () => Chart)();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (chartInstance && typeof (chartInstance as any).writeHelmChart === 'function') {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (chartInstance as any).writeHelmChart(subchartDir);
            } else {
              flexibleSubchart.writeHelmChart(subchartDir);
            }
          } catch (fallbackError) {
            console.warn(`Failed to create subchart ${subchart.name}:`, fallbackError);
            flexibleSubchart.writeHelmChart(subchartDir);
          }
        }
      } else if (subchart.chart && typeof subchart.chart === 'object') {
        // If it's an object, try to use it as a construct or manifest
        if (subchart.chart.constructor && subchart.chart.constructor.name !== 'Object') {
          // It's a cdk8s construct, add it to the flexible subchart
          flexibleSubchart.addConstruct(subchart.chart);
        } else {
          // It's a manifest object, add it as a manifest
          flexibleSubchart.addManifest(subchart.chart);
        }
        flexibleSubchart.writeHelmChart(subchartDir);
      } else {
        // Use the flexible subchart as fallback
        flexibleSubchart.writeHelmChart(subchartDir);
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
          'app.kubernetes.io/name': '{{ .Chart.Name }}',
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
          'app.kubernetes.io/version': '{{ .Chart.AppVersion }}',
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
        },
      },
    };

    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(templatesDir, 'namespace.yaml'), dumpHelmAwareYaml(namespaceYaml));

    // Create _helpers.tpl using programmatic generation
    const helpersTpl = generateHelpersTemplate('aws', undefined, {
      includeKubernetes: true,
      includeSprig: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(templatesDir, '_helpers.tpl'), helpersTpl);
  }
}
