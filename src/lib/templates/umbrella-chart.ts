import type { App } from 'cdk8s';
import { Chart, ApiObject } from 'cdk8s';

import type { ChartProps } from '../types.js';

/**
 * Generate an umbrella chart template
 * @param name Chart name
 * @returns Template string for umbrella.ts
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
 */
export class UmbrellaChartTemplate extends Chart {
  constructor(
    scope: App,
    id: string,
    private readonly config: ChartProps,
  ) {
    super(scope, id);
    this.configure();
  }

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

  private _addSubchart(_subchart: { name: string; chart: Chart }, _index: number) {
    // Subchart integration will be implemented in future versions
    // For now, we just acknowledge their existence in the ConfigMap
  }

  /**
   * Write the Helm chart to disk
   * @param _outDir Output directory
   */
  public writeHelmChart(_outDir: string) {
    // This method is for future Helm chart generation
    // Currently, cdk8s handles the YAML generation
  }
}
