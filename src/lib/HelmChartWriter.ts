import * as fs from 'fs';
import * as path from 'path';

import YAML from 'yaml';

import { SecurityUtils } from './security.js';

export interface HelmChartMeta {
  name: string;
  version: string; // SemVer chart version
  description?: string;
  appVersion?: string; // Underlying app version (string)
  type?: 'application' | 'library';
  kubeVersion?: string;
  keywords?: string[];
  home?: string;
  sources?: string[];
  maintainers?: { name: string; email?: string; url?: string }[];
  icon?: string;
  dependencies?: Array<{
    name: string;
    version: string;
    repository: string;
    alias?: string;
    condition?: string | string[];
    tags?: string[];
    importValues?: unknown;
  }>;
}

export interface EnvValuesMap {
  [env: string]: Record<string, unknown>;
}

export interface SynthAsset {
  /** filename or logical id */
  id: string;
  /** YAML string, may contain multiple docs separated by --- */
  yaml: string;
  /** target directory inside chart: templates (default) or crds */
  target?: 'templates' | 'crds';
  /** if true, don't split this asset into multiple files even if it contains multiple docs */
  singleFile?: boolean;
}

export interface HelmChartWriteOptions {
  outDir: string; // e.g., dist/charts/my-chart
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown> | undefined;
  envValues?: EnvValuesMap | undefined; // { dev: {...}, prod: {...} }
  /**
   * Kubernetes manifests to place under templates/
   * Accepts one or multiple documents per SynthAsset.
   */
  assets: SynthAsset[];
  /**
   * Optional Helm helpers content for templates/_helpers.tpl.
   * If a string is provided, it's written verbatim.
   * If an array is provided, each item becomes a named Helm template
   * block as: {{- define "<name>" -}} ... {{- end }}
   */
  helpersTpl?: string | HelperDefinition[];
  /** Optional NOTES.txt content under templates/ */
  notesTpl?: string;
  /** Optional values.schema.json object */
  valuesSchema?: Record<string, unknown>;
}

export interface HelperDefinition {
  name: string;
  body: string;
}

export class HelmChartWriter {
  static write(opts: HelmChartWriteOptions) {
    const {
      outDir,
      meta,
      defaultValues = {},
      envValues = {},
      assets,
      helpersTpl,
      notesTpl,
      valuesSchema,
    } = opts;

    // Validate output directory path
    const validatedOutDir = SecurityUtils.validatePath(outDir, process.cwd());

    // Create directory structure
    this.createDirectories(validatedOutDir);

    // Write chart files
    this.writeChartYaml(validatedOutDir, meta);
    this.writeValuesFiles(validatedOutDir, defaultValues, envValues);
    this.writeAssets(validatedOutDir, assets);
    this.writeHelpers(validatedOutDir, helpersTpl);
    this.writeNotes(validatedOutDir, notesTpl);
    this.writeSchema(validatedOutDir, valuesSchema);
    this.writeHelmIgnore(validatedOutDir);
  }

  private static createDirectories(outDir: string): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.mkdirSync(path.join(outDir, 'templates'), { recursive: true });
    // Create crds directory only if needed later
  }

  private static writeChartYaml(outDir: string, meta: HelmChartMeta): void {
    const chartYaml = YAML.stringify({
      apiVersion: 'v2',
      name: meta.name,
      version: meta.version,
      description: meta.description,
      type: meta.type ?? 'application',
      appVersion: meta.appVersion,
      kubeVersion: meta.kubeVersion,
      keywords: meta.keywords,
      home: meta.home,
      sources: meta.sources,
      maintainers: meta.maintainers,
      icon: meta.icon,
      dependencies: meta.dependencies,
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, 'Chart.yaml'), chartYaml);
  }

  private static writeValuesFiles(
    outDir: string,
    defaultValues: Record<string, unknown>,
    envValues: EnvValuesMap,
  ): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, 'values.yaml'), YAML.stringify(defaultValues));
    for (const [env, values] of Object.entries(envValues)) {
      // Sanitize environment name to prevent path traversal
      const sanitizedEnv = env.replace(/[^a-zA-Z0-9-_]/g, '');
      if (sanitizedEnv !== env) {
        throw new Error(`Invalid environment name: ${env}`);
      }
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
      fs.writeFileSync(path.join(outDir, `values-${sanitizedEnv}.yaml`), YAML.stringify(values));
    }
  }

  private static writeAssets(outDir: string, assets: SynthAsset[]): void {
    writeAssets(outDir, assets);
  }

  private static writeHelpers(outDir: string, helpersTpl?: string | HelperDefinition[]): void {
    if (!helpersTpl) return;

    let content = '';
    if (typeof helpersTpl === 'string') {
      content = helpersTpl.endsWith('\n') ? helpersTpl : helpersTpl + '\n';
    } else if (Array.isArray(helpersTpl)) {
      content = helpersTpl
        .map((h) => [`{{- define "${h.name}" -}}`, h.body.trimEnd(), '{{- end }}', ''].join('\n'))
        .join('\n');
    }
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, 'templates', '_helpers.tpl'), content);
  }

  private static writeNotes(outDir: string, notesTpl?: string): void {
    if (!notesTpl) return;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(
      path.join(outDir, 'templates', 'NOTES.txt'),
      notesTpl.endsWith('\n') ? notesTpl : notesTpl + '\n',
    );
  }

  private static writeSchema(outDir: string, valuesSchema?: Record<string, unknown>): void {
    if (!valuesSchema) return;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(
      path.join(outDir, 'values.schema.json'),
      JSON.stringify(valuesSchema, null, 2) + '\n',
    );
  }

  private static writeHelmIgnore(outDir: string): void {
    const helmIgnorePath = path.join(outDir, '.helmignore');
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    if (!fs.existsSync(helmIgnorePath)) {
      const helmIgnore = [
        '# VCS',
        '.git/',
        '.hg/',
        '.svn/',
        '',
        '# OS/editor',
        '.DS_Store',
        '.idea/',
        '.vscode/',
        '',
        '# Backups',
        '*.swp',
        '*.bak',
        '*.tmp',
        '*.orig',
        '',
        '# Chart dependencies and packages',
        'charts/',
        '*.tgz',
        '',
      ].join('\n');
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
      fs.writeFileSync(helmIgnorePath, helmIgnore);
    }
  }
}

function splitDocs(yamlStr: string): string[] {
  return yamlStr
    .split(/^---\s*$/m)
    .map((p) => p.trim())
    .filter((p) => p.length);
}

function writeAssets(outDir: string, assets: SynthAsset[]) {
  for (const asset of assets) {
    // Sanitize asset ID to prevent path traversal
    const sanitizedId = asset.id.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedId !== asset.id) {
      throw new Error(`Invalid asset ID: ${asset.id}`);
    }

    const targetDir = getTargetDirectory(asset.target);

    if (asset.singleFile) {
      writeSingleAssetFile(outDir, targetDir, sanitizedId, asset.yaml);
    } else {
      writeMultipleAssetFiles(outDir, targetDir, sanitizedId, asset.yaml);
    }
  }
}

function getTargetDirectory(target?: 'templates' | 'crds'): string {
  return target === 'crds' ? 'crds' : 'templates';
}

function writeSingleAssetFile(
  outDir: string,
  targetDir: string,
  assetId: string,
  yaml: string,
): void {
  const filename = `${assetId}.yaml`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.mkdirSync(path.join(outDir, targetDir), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.writeFileSync(path.join(outDir, targetDir, filename), yaml + '\n');
}

function writeMultipleAssetFiles(
  outDir: string,
  targetDir: string,
  assetId: string,
  yaml: string,
): void {
  const parts = splitDocs(yaml);
  parts.forEach((doc, index) => {
    const filename = `${assetId}${parts.length > 1 ? `-${index + 1}` : ''}.yaml`;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.mkdirSync(path.join(outDir, targetDir), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, targetDir, filename), doc + '\n');
  });
}
