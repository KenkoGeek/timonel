import { App } from 'cdk8s';
import { Rutter, helm, valuesRef } from 'timonel';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';
import * as jsYaml from 'js-yaml';
import wordpress from './charts/wordpress/chart';
import mysql from './charts/mysql/chart';
// Import subcharts - add your subchart imports here

type SynthMode = 'dependencies' | 'inline';

interface SynthOptions {
  mode?: SynthMode;
}

const DEFAULT_MODE: SynthMode = 'dependencies';

const SUBCHARTS: Array<{ name: string; factory: () => Rutter }> = [
  // Add your subcharts here:
  { name: 'wordpress', factory: wordpress },
  { name: 'mysql', factory: mysql },
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
  const content = jsYaml.load(readFileSync(filePath, 'utf8'));
  return content && typeof content === 'object' ? (content as Record<string, unknown>) : {};
}

/**
 * Normalizes a Helm expression by removing the surrounding delimiters.
 * @param expr Helm template expression including the wrapping moustaches
 * @returns Expression body ready for composition
 * @since 2.12.1
 */
function unwrapHelmExpression(expr: string): string {
  return expr
    .replace(/^\{\{\s*/, '')
    .replace(/\s*\}\}$/, '')
    .trim();
}

/**
 * Builds the namespace expression leveraging Timonel helpers.
 * @returns Helm expression that defaults to the release namespace
 * @since 2.12.1
 */
function buildNamespaceNameExpression(): string {
  const releaseNamespace = unwrapHelmExpression(helm.namespace);
  const valuesNamespace = unwrapHelmExpression(valuesRef('namespace'));
  return `{{ default ${releaseNamespace} ${valuesNamespace} }}`;
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
      name: 'wordpress-stack',
      version: '0.1.0',
      description: 'wordpress-stack umbrella chart',
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
        name: buildNamespaceNameExpression(),
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

  writeFileSync(chartPath, jsYaml.dump(chartDoc));
  writeFileSync(valuesPath, jsYaml.dump(valuesDoc));

  app.synth();

  console.log('✅ Umbrella chart generated in ' + mode + ' mode!');
}

// Auto-execute when run directly
if (import.meta.url === new URL(import.meta.url).href) {
  synth(process.argv[2] || 'dist');
}

export default synth;
