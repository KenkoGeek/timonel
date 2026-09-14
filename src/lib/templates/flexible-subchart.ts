/**
 * @fileoverview Flexible subchart template that supports any cdk8s/cdk8s-plus-33 construct
 * @since 2.8.4
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { Chart } from 'cdk8s';

import { SecurityUtils } from '../security.js';
import { dumpHelmAwareYaml } from '../utils/helmYamlSerializer.js';
import { generateHelpersTemplate } from '../utils/helmHelpers.js';

/**
 * Flexible subchart that can accept any cdk8s construct or function
 * @since 2.8.4
 */
export class FlexibleSubchart extends Chart {
  private _constructs: unknown[] = [];

  constructor(
    scope: Chart,
    id: string,
    private readonly config: {
      name: string;
      version?: string;
      description?: string;
      construct?: unknown;
      [key: string]: unknown;
    },
  ) {
    super(scope, id);
    this.configure();
  }

  /**
   * Add any cdk8s construct
   * @param construct - Any cdk8s construct
   * @param id - Unique identifier
   */
  addConstruct(construct: unknown, id?: string) {
    if (construct) {
      this._constructs.push({ construct, id: id || `construct-${this._constructs.length}` });
    }
  }

  /**
   * Configure the subchart with any provided construct or manifest
   * @private
   */
  private configure() {
    // Add any provided construct
    if (this.config.construct) {
      this.addConstruct(this.config.construct);
    }

    // Add any additional properties as constructs
    Object.entries(this.config).forEach(([key, value]) => {
      if (
        key !== 'name' &&
        key !== 'version' &&
        key !== 'description' &&
        key !== 'construct' &&
        value
      ) {
        this.addConstruct(value, key);
      }
    });
  }

  /**
   * Write Helm chart files for this subchart
   * @param outputDir - Directory to write the Helm chart files
   */
  writeHelmChart(outputDir: string): void {
    // Ensure output directory exists
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    if (!existsSync(outputDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      mkdirSync(outputDir, { recursive: true });
    }

    // Create Chart.yaml for the subchart
    const subchartYaml = {
      apiVersion: 'v2',
      name: this.config.name,
      description: this.config.description || `${this.config.name} subchart`,
      type: 'application',
      version: this.config.version || '1.0.0',
      appVersion: this.config.version || '1.0.0',
    };
    const chartYamlPath = SecurityUtils.validatePath(join(outputDir, 'Chart.yaml'), process.cwd(), {
      allowAbsolute: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated path
    writeFileSync(chartYamlPath, dumpHelmAwareYaml(subchartYaml));

    // Create values.yaml for the subchart (filter out functions and non-serializable objects)
    const subchartValues = {
      enabled: true,
      ...Object.fromEntries(
        Object.entries(this.config).filter(
          ([key, value]) =>
            key !== 'chart' && typeof value !== 'function' && value !== null && value !== undefined,
        ),
      ),
    };
    const valuesYamlPath = SecurityUtils.validatePath(
      join(outputDir, 'values.yaml'),
      process.cwd(),
      { allowAbsolute: true },
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated path
    writeFileSync(valuesYamlPath, dumpHelmAwareYaml(subchartValues));

    // Create templates directory
    const templatesDir = SecurityUtils.validatePath(join(outputDir, 'templates'), process.cwd(), {
      allowAbsolute: true,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated path
    if (!existsSync(templatesDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated path
      mkdirSync(templatesDir, { recursive: true });
    }

    // Create _helpers.tpl for the subchart
    const helpersTpl = generateHelpersTemplate('aws', undefined, {
      includeKubernetes: true,
      includeSprig: true,
    });
    const helpersTplPath = SecurityUtils.validatePath(
      join(templatesDir, '_helpers.tpl'),
      process.cwd(),
      { allowAbsolute: true },
    );
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- validated path
    writeFileSync(helpersTplPath, helpersTpl);

    console.log(`Created flexible Helm chart for subchart: ${this.config.name}`);
  }

  getConstructs() {
    return this._constructs;
  }
}

/**
 * Create a flexible subchart that can accept any construct
 * @param scope - Parent chart scope
 * @param id - Unique identifier
 * @param config - Subchart configuration
 * @returns FlexibleSubchart instance
 */
export function createFlexibleSubchart(
  scope: Chart,
  id: string,
  config: {
    name: string;
    version?: string;
    description?: string;
    [key: string]: unknown;
  },
): FlexibleSubchart {
  return new FlexibleSubchart(scope, id, config);
}

/**
/**
 * Generate a typed subchart template using cdk8s-plus resources and ValuesRef bindings.
 * @param name Subchart name
 * @returns Template string for chart.ts
 * @since 2.11.0
 */
export function generateFlexibleSubchartTemplate(name: string): string {
  return `import { App } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';
import { Rutter, valuesRef } from 'timonel';

interface Values {
  enabled: boolean;
  replicas: number;
}

export default function createChart() {
  const app = new App({ outdir: 'dist' });
  const values = valuesRef<Values>();
  const rutter = new Rutter({
    meta: {
      name: '${name}',
      version: '1.0.0',
      description: '${name} subchart',
    },
    scope: app,
    defaultValues: {
      enabled: true,
      replicas: 1,
    },
  });

  const deployment = new kplus.Deployment(rutter.getChart(), 'Deployment', {
    metadata: { name: '${name}' },
    replicas: 1,
    containers: [
      {
        name: '${name}',
        image: 'nginx:latest',
        portNumber: 80,
      },
    ],
  });
  deployment.exposeViaService();

  rutter.bindHelmValue(deployment, '/spec/replicas', values.replicas);
  rutter.when(values.enabled, deployment);

  return rutter;
}

if (import.meta.url === new URL(import.meta.url).href) {
  (async () => {
    const chart = createChart();
    await chart.write('dist');
  })();
}
`;
}
