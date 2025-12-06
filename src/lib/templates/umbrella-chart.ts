import { writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

import { parse } from 'yaml';
import { App, Chart, ApiObject } from 'cdk8s';

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
 * Generate an umbrella chart template with direct subchart imports
 * @param name Chart name
 * @returns Template string for umbrella.ts
 * @since 2.11.0
 */
export function generateUmbrellaChart(name: string): string {
  return `import { App } from 'cdk8s';
import { Rutter, helmInclude, helmIf, helmWith, createHelmExpression as helm } from 'timonel';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse, stringify } from 'yaml';
// Import subcharts - add your subchart imports here

type SynthMode = 'dependencies' | 'inline';

interface SynthOptions {
  mode?: SynthMode;
}

const DEFAULT_MODE: SynthMode = 'dependencies';

const SUBCHARTS: Array<{ name: string; factory: () => Rutter }> = [
  // Add your subcharts here:
  // { name: 'my-subchart', factory: mySubchart },
];

function resolveMode(options?: SynthOptions): SynthMode {
  const explicit = options?.mode;
  if (explicit === 'dependencies' || explicit === 'inline') {
    return explicit;
  }
  const envMode = process.env.TIMONEL_UMBRELLA_MODE;
  if (envMode === 'dependencies' || envMode === 'inline') {
    return envMode;
  }
  return DEFAULT_MODE;
}

function readYamlFile(filePath: string): Record<string, unknown> {
  if (!existsSync(filePath)) {
    return {};
  }
  const content = parse(readFileSync(filePath, 'utf8'));
  return content && typeof content === 'object' ? (content as Record<string, unknown>) : {};
}

export function synth(outDir: string, options?: SynthOptions) {
  const mode = resolveMode(options);
  const app = new App({
    outdir: outDir,
    outputFileExtension: '.yaml',
    yamlOutputType: 'FILE_PER_RESOURCE',
  });

  const umbrella = new Rutter({
    meta: {
      name: '${name}',
      version: '0.1.0',
      description: '${name} umbrella chart',
      appVersion: '1.0.0',
      type: 'application',
    },
    scope: app,
    defaultValues: {
      namespace: 'default',
      createNamespace: false,
    },
  });

  umbrella.addConditionalManifest(
    {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: {
        name: '{{ .Values.namespace | default .Release.Namespace }}',
      },
    },
    'createNamespace',
    'namespace',
  );

  umbrella.write(outDir);

  const chartPath = join(outDir, 'Chart.yaml');
  const valuesPath = join(outDir, 'values.yaml');
  const templatesDir = join(outDir, 'templates');
  mkdirSync(templatesDir, { recursive: true });

  const chartDoc = readYamlFile(chartPath);
  const valuesDoc = readYamlFile(valuesPath);

  if (mode === 'dependencies') {
    const chartsDir = join(outDir, 'charts');
    mkdirSync(chartsDir, { recursive: true });

    const dependencies: Array<{ name: string; version: string; repository: string }> = [];

    SUBCHARTS.forEach((subchart) => {
      const instance = subchart.factory();
      const targetDir = join(chartsDir, subchart.name);
      rmSync(targetDir, { recursive: true, force: true });
      instance.write(targetDir);
      const meta = instance.getMeta();
      const version = meta.version ?? '0.1.0';
      dependencies.push({
        name: subchart.name,
        version,
        repository: 'file://./charts/' + subchart.name,
      });
      const subchartValues = readYamlFile(join(targetDir, 'values.yaml'));
      if (Object.keys(subchartValues).length > 0) {
        valuesDoc[subchart.name] = subchartValues;
      }
    });

    chartDoc.dependencies = dependencies;
  } else {
    const chartsDir = join(outDir, 'charts');
    if (existsSync(chartsDir)) {
      rmSync(chartsDir, { recursive: true, force: true });
    }
    delete chartDoc.dependencies;

    SUBCHARTS.forEach((subchart) => {
      const instance = subchart.factory();
      const tempDir = join(outDir, '.timonel-inline-' + subchart.name);
      rmSync(tempDir, { recursive: true, force: true });
      instance.write(tempDir);

      const subTemplatesDir = join(tempDir, 'templates');
      if (existsSync(subTemplatesDir)) {
        const targetTemplatesDir = join(templatesDir, subchart.name);
        mkdirSync(targetTemplatesDir, { recursive: true });
        for (const file of readdirSync(subTemplatesDir)) {
          copyFileSync(join(subTemplatesDir, file), join(targetTemplatesDir, file));
        }
      }

      const subchartValues = readYamlFile(join(tempDir, 'values.yaml'));
      if (Object.keys(subchartValues).length > 0) {
        valuesDoc[subchart.name] = subchartValues;
      }

      rmSync(tempDir, { recursive: true, force: true });
    });
  }

  writeFileSync(chartPath, stringify(chartDoc));
  writeFileSync(valuesPath, stringify(valuesDoc));

  app.synth();

  console.log('✅ Umbrella chart generated in ' + mode + ' mode!');
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
      const flexibleSubchart = this._createFlexibleSubchart(subchart, index);

      if (typeof subchart.chart === 'function') {
        this._handleFunctionChart(subchart, index, flexibleSubchart);
      } else if (subchart.chart && typeof subchart.chart === 'object') {
        this._handleObjectChart(subchart, flexibleSubchart);
      }

      // Sanitize subchart name for logging to prevent log injection
      const sanitizedName = subchart.name.replace(/[\r\n]/g, '');
      console.log(`Added flexible subchart: ${sanitizedName}`);
    } catch (_error) {
      // Sanitize subchart name for logging to prevent log injection
      const sanitizedName = subchart.name.replace(/[\r\n]/g, '');
      console.warn(`Failed to add subchart ${sanitizedName}:`, _error);
      this._createFallbackSubchart(subchart, index);
    }
  }

  private _createFlexibleSubchart(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    index: number,
  ) {
    const {
      name: _name,
      version: _version,
      description: _description,
      ...subchartProps
    } = subchart;

    return createFlexibleSubchart(this, `${subchart.name}-${index}`, {
      name: subchart.name,
      version: (subchart.version as string) || '1.0.0',
      description: (subchart.description as string) || `${subchart.name} subchart`,
      ...subchartProps,
    });
  }

  private _createFallbackSubchart(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    index: number,
  ) {
    const _fallbackSubchart = createFlexibleSubchart(this, `${subchart.name}-fallback-${index}`, {
      name: subchart.name,
      version: (subchart.version as string) || '1.0.0',
      description: `${subchart.name} subchart (fallback)`,
    });
    // Sanitize subchart name for logging to prevent log injection
    const sanitizedName = subchart.name.replace(/[\r\n]/g, '');
    console.log(`Created fallback subchart: ${sanitizedName}`);
  }

  private _handleFunctionChart(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    index: number,
    flexibleSubchart: Chart,
  ) {
    try {
      const tempApp = new App({ outdir: 'temp' });
      const rutterInstance = (subchart.chart as (scope: App) => unknown)(tempApp);

      if (this._isRutterInstance(rutterInstance)) {
        this._processRutterInstance(subchart, index, rutterInstance, flexibleSubchart);
      } else if (this._isChartInstance(rutterInstance)) {
        this._processChartInstance(rutterInstance, flexibleSubchart);
      }
    } catch (error) {
      // Sanitize subchart name for logging to prevent log injection
      const sanitizedName = subchart.name.replace(/[\r\n]/g, '');
      console.log(`Failed to process subchart ${sanitizedName}:`, error);
    }
  }

  private _handleObjectChart(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    flexibleSubchart: Chart,
  ) {
    const chartObj = subchart.chart as Record<string, unknown>;
    if (chartObj.constructor && chartObj.constructor.name !== 'Object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlexibleSubchart method
      (flexibleSubchart as any).addConstruct(subchart.chart);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlexibleSubchart method
      (flexibleSubchart as any).addManifest(subchart.chart);
    }
  }

  private _isRutterInstance(instance: unknown): boolean {
    return !!(instance && typeof (instance as Record<string, unknown>).addManifest === 'function');
  }

  private _isChartInstance(instance: unknown): boolean {
    const obj = instance as Record<string, unknown>;
    const node = obj?.node as Record<string, unknown> | undefined;
    return !!(node && node.children);
  }

  private _processRutterInstance(
    subchart: { name: string; chart: unknown; [key: string]: unknown },
    index: number,
    rutterInstance: unknown,
    flexibleSubchart: Chart,
  ) {
    const tempDir = `temp-${subchart.name}-${index}`;
    const write = (rutterInstance as Record<string, unknown>).write as
      | ((dir: string) => void)
      | undefined;
    write?.(tempDir);

    this._copyTemplates(subchart.name, tempDir);
    this._processAssets(rutterInstance, flexibleSubchart);
    this._cleanupTempDir(tempDir);
  }

  private _processChartInstance(rutterInstance: unknown, flexibleSubchart: Chart) {
    const obj = rutterInstance as Record<string, unknown>;
    const node = obj?.node as Record<string, unknown> | undefined;
    const children = node?.children as unknown[] | undefined;
    children?.forEach((child: unknown) => {
      if (child instanceof Chart) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FlexibleSubchart method
        (flexibleSubchart as any).addConstruct(child);
      }
    });
  }

  private _copyTemplates(subchartName: string, tempDir: string) {
    const tempTemplatesDir = join(tempDir, 'templates');
    const subchartTemplatesDir = join('dist', 'charts', subchartName, 'templates');

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (existsSync(tempTemplatesDir)) {
      this._ensureDirectoryExists(join('dist', 'charts', subchartName));
      this._ensureDirectoryExists(subchartTemplatesDir);

      // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
      const templateFiles = readdirSync(tempTemplatesDir);
      templateFiles.forEach((file) => {
        if (file.endsWith('.yaml') || file.endsWith('.yml') || file.endsWith('.tpl')) {
          const sourceFile = join(tempTemplatesDir, file);
          const targetFile = join(subchartTemplatesDir, file);
          copyFileSync(sourceFile, targetFile);
        }
      });
    }
  }

  private _ensureDirectoryExists(dirPath: string) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (!existsSync(dirPath)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
      mkdirSync(dirPath, { recursive: true });
    }
  }

  private _processAssets(rutterInstance: unknown, flexibleSubchart: Chart) {
    const getAssets = (rutterInstance as Record<string, unknown>).getAssets as
      | (() => Array<{ id: string; yaml: string }>)
      | undefined;
    const assets = getAssets?.() || [];

    assets.forEach((asset, assetIndex) => {
      try {
        const manifest = parse(asset.yaml) as Record<string, unknown>;
        if (manifest?.apiVersion && manifest?.kind) {
          new ApiObject(flexibleSubchart, `${String(manifest.kind).toLowerCase()}-${assetIndex}`, {
            apiVersion: String(manifest.apiVersion),
            kind: String(manifest.kind),
            metadata: (manifest.metadata as Record<string, unknown>) || {},
            spec: (manifest.spec as Record<string, unknown>) || {},
          });
        }
      } catch (error) {
        // Sanitize asset id for logging to prevent log injection
        const sanitizedId = asset.id.replace(/[\r\n]/g, '');
        console.log(`Failed to parse asset ${sanitizedId}:`, error);
      }
    });
  }

  private _cleanupTempDir(tempDir: string) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
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
            // Sanitize subchart name for logging to prevent log injection
            const sanitizedName = subchart.name.replace(/[\r\n]/g, '');
            console.warn(`Failed to create subchart ${sanitizedName}:`, fallbackError);
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
