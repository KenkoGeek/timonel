/**
 * @fileoverview Helm chart writer for generating complete Helm chart structures
 * @since 2.8.0+
 */

import * as fs from 'fs';
import * as path from 'path';

import { SecurityUtils } from './security.js';
import { dumpHelmAwareYaml } from './utils/helmYamlSerializer.js';

/**
 * Metadata for a Helm chart
 *
 * Contains all the information needed for Chart.yaml file generation
 * following Helm chart specification.
 *
 * @interface HelmChartMeta
 * @since 2.8.0+
 */
export interface HelmChartMeta {
  /** Chart name */
  name: string;
  /** SemVer chart version */
  version: string;
  /** Chart description */
  description?: string;
  /** Underlying application version */
  appVersion?: string;
  /** Chart type */
  type?: 'application' | 'library';
  /** Kubernetes version constraint */
  kubeVersion?: string;
  /** Chart keywords for searchability */
  keywords?: string[];
  /** Chart home page URL */
  home?: string;
  /** Source code URLs */
  sources?: string[];
  /** Chart maintainers */
  maintainers?: { name: string; email?: string; url?: string }[];
  /** Chart icon URL */
  icon?: string;
  /** Chart dependencies */
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

/**
 * Environment-specific values mapping
 *
 * @interface EnvValuesMap
 * @since 2.8.0+
 */
export interface EnvValuesMap {
  [env: string]: Record<string, unknown>;
}

/**
 * Synthesized Kubernetes asset for Helm chart
 *
 * Represents a Kubernetes manifest that will be written to the chart's
 * templates or crds directory.
 *
 * @interface SynthAsset
 * @since 2.8.0+
 */
export interface SynthAsset {
  /** Filename or logical identifier */
  id: string;
  /** YAML content, may contain multiple documents separated by --- */
  yaml: string;
  /** Target directory inside chart */
  target?: 'templates' | 'crds';
  /** If true, don't split into multiple files even with multiple docs */
  singleFile?: boolean;
}

/**
 * Options for writing a complete Helm chart
 *
 * @interface HelmChartWriteOptions
 * @since 2.8.0+
 */
export interface HelmChartWriteOptions {
  /** Output directory path (e.g., dist/charts/my-chart) */
  outDir: string;
  /** Chart metadata */
  meta: HelmChartMeta;
  /** Default values for values.yaml */
  defaultValues?: Record<string, unknown> | undefined;
  /** Environment-specific values (e.g., { dev: {...}, prod: {...} }) */
  envValues?: EnvValuesMap | undefined;
  /** Kubernetes manifests to place under templates/ */
  assets: SynthAsset[];
  /** Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
  /** NOTES.txt content under templates/ */
  notesTpl?: string;
  /** JSON schema for values validation */
  valuesSchema?: Record<string, unknown>;
}

/**
 * Helm template helper definition
 *
 * @interface HelperDefinition
 * @since 2.8.0+
 */
export interface HelperDefinition {
  /** Template name */
  name: string;
  /** Template body content */
  body: string;
}

/**
 * Helm chart writer for generating complete chart structures
 *
 * This class provides static methods to generate a complete Helm chart
 * including Chart.yaml, values.yaml, templates, and auxiliary files.
 *
 * @class HelmChartWriter
 * @since 2.8.0+
 *
 * @example
 * ```typescript
 * HelmChartWriter.write({
 *   outDir: './dist/my-chart',
 *   meta: { name: 'my-app', version: '1.0.0' },
 *   assets: []
 * });
 * ```
 */
export class HelmChartWriter {
  /**
   * Writes a complete Helm chart to the specified directory
   *
   * @param {HelmChartWriteOptions} opts - Chart writing options
   * @throws {Error} If chart cannot be written
   * @since 2.8.0+
   */
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

    console.log(`📝 Writing Helm chart: ${meta.name} v${meta.version} to ${outDir}`);

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

    console.log(`✅ Helm chart written successfully to ${validatedOutDir}`);
  }

  /**
   * Creates the necessary directory structure for the chart
   *
   * @private
   * @param {string} outDir - Output directory path
   * @throws {Error} If directories cannot be created
   * @since 2.8.0+
   */
  private static createDirectories(outDir: string): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.mkdirSync(path.join(outDir, 'templates'), { recursive: true });
    // Create crds directory only if needed later
  }

  /**
   * Writes the Chart.yaml file with chart metadata
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {HelmChartMeta} meta - Chart metadata
   * @throws {Error} If Chart.yaml cannot be written
   * @since 2.8.0+
   */
  private static writeChartYaml(outDir: string, meta: HelmChartMeta): void {
    const chartYaml = dumpHelmAwareYaml({
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

  /**
   * Writes values.yaml and environment-specific values files
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {Record<string, unknown>} defaultValues - Default values
   * @param {EnvValuesMap} envValues - Environment-specific values
   * @throws {Error} If values files cannot be written
   * @since 2.8.0+
   */
  private static writeValuesFiles(
    outDir: string,
    defaultValues: Record<string, unknown>,
    envValues: EnvValuesMap,
  ): void {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, 'values.yaml'), dumpHelmAwareYaml(defaultValues));
    for (const [env, values] of Object.entries(envValues)) {
      // Use centralized environment name sanitization
      const sanitizedEnv = SecurityUtils.sanitizeEnvironmentName(env);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
      fs.writeFileSync(path.join(outDir, `values-${sanitizedEnv}.yaml`), dumpHelmAwareYaml(values));
    }
  }

  /**
   * Writes Kubernetes manifest assets to templates directory
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {SynthAsset[]} assets - Kubernetes manifests to write
   * @since 2.8.0+
   */
  private static writeAssets(outDir: string, assets: SynthAsset[]): void {
    writeAssets(outDir, assets);
  }

  /**
   * Writes Helm template helpers to _helpers.tpl file
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {string | HelperDefinition[]} [helpersTpl] - Helpers content
   * @since 2.8.0+
   */
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

  /**
   * Writes NOTES.txt file for post-install instructions
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {string} [notesTpl] - Notes content
   * @since 2.8.0+
   */
  private static writeNotes(outDir: string, notesTpl?: string): void {
    if (!notesTpl) return;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(
      path.join(outDir, 'templates', 'NOTES.txt'),
      notesTpl.endsWith('\n') ? notesTpl : notesTpl + '\n',
    );
  }

  /**
   * Writes values.schema.json for values validation
   *
   * @private
   * @param {string} outDir - Output directory path
   * @param {Record<string, unknown>} [valuesSchema] - JSON schema
   * @since 2.8.0+
   */
  private static writeSchema(outDir: string, valuesSchema?: Record<string, unknown>): void {
    if (!valuesSchema) return;

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(
      path.join(outDir, 'values.schema.json'),
      JSON.stringify(valuesSchema, null, 2) + '\n',
    );
  }

  /**
   * Writes .helmignore file with common ignore patterns
   *
   * @private
   * @param {string} outDir - Output directory path
   * @since 2.8.0+
   */
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

/**
 * Splits YAML string into individual documents
 *
 * @private
 * @param {string} yamlStr - YAML string with potential document separators
 * @returns {string[]} Array of individual YAML documents
 * @since 2.8.0+
 */
function splitDocs(yamlStr: string): string[] {
  return yamlStr
    .split(/^---\s*$/m)
    .map((p) => p.trim())
    .filter((p) => p.length);
}

/**
 * Writes all synthesized assets to the chart directory
 *
 * @private
 * @param {string} outDir - Output directory path
 * @param {SynthAsset[]} assets - Assets to write
 * @throws {Error} If asset ID contains invalid characters
 * @since 2.8.0+
 */
function writeAssets(outDir: string, assets: SynthAsset[]) {
  for (const asset of assets) {
    // Sanitize asset ID to prevent path traversal
    const sanitizedId = asset.id.replace(/[^a-zA-Z0-9-_]/g, '');
    if (sanitizedId !== asset.id) {
      console.error(`❌ Invalid asset ID detected: ${SecurityUtils.sanitizeLogMessage(asset.id)}`);
      throw new Error(`Invalid asset ID: ${SecurityUtils.sanitizeLogMessage(asset.id)}`);
    }

    const targetDir = getTargetDirectory(asset.target);

    try {
      if (asset.singleFile) {
        writeSingleAssetFile(outDir, targetDir, sanitizedId, asset.yaml);
      } else {
        writeMultipleAssetFiles(outDir, targetDir, sanitizedId, asset.yaml);
      }
    } catch (error) {
      console.error(`❌ Failed to write asset ${asset.id}:`, error);
      throw error;
    }
  }
}

/**
 * Gets the target directory for an asset
 *
 * @private
 * @param {('templates' | 'crds')} [target] - Target directory type
 * @returns {string} Directory name
 * @since 2.8.0+
 */
function getTargetDirectory(target?: 'templates' | 'crds'): string {
  return target === 'crds' ? 'crds' : 'templates';
}

/**
 * Writes a single asset file without document splitting
 *
 * @private
 * @param {string} outDir - Output directory path
 * @param {string} targetDir - Target subdirectory
 * @param {string} assetId - Asset identifier
 * @param {string} yaml - YAML content
 * @since 2.8.0+
 */
function writeSingleAssetFile(
  outDir: string,
  targetDir: string,
  assetId: string,
  yaml: string,
): void {
  // Debug: Log content being written for ingress files
  if (assetId === 'ingress' && yaml.includes('number:')) {
    console.log('🔍 Writing ingress file with content:');
    const numberLines = yaml.split('\n').filter((line) => line.includes('number:'));
    console.log('Number lines:', numberLines);
  }

  const filename = `${assetId}.yaml`;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.mkdirSync(path.join(outDir, targetDir), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.writeFileSync(path.join(outDir, targetDir, filename), yaml + '\n');
}

/**
 * Writes multiple asset files by splitting YAML documents
 *
 * @private
 * @param {string} outDir - Output directory path
 * @param {string} targetDir - Target subdirectory
 * @param {string} assetId - Asset identifier
 * @param {string} yaml - YAML content with potential multiple documents
 * @since 2.8.0+
 */
function writeMultipleAssetFiles(
  outDir: string,
  targetDir: string,
  assetId: string,
  yaml: string,
): void {
  // Debug: Log content being written for ingress files
  if (assetId === 'ingress' && yaml.includes('number:')) {
    console.log('🔍 Writing ingress file (multiple) with content:');
    const numberLines = yaml.split('\n').filter((line) => line.includes('number:'));
    console.log('Number lines:', numberLines);
  }

  const parts = splitDocs(yaml);
  parts.forEach((doc, index) => {
    const filename = `${assetId}${parts.length > 1 ? `-${index + 1}` : ''}.yaml`;

    // Debug: Log each document being written
    if (assetId === 'ingress' && doc.includes('number:')) {
      console.log(
        `🔍 Writing document ${index + 1} for ingress:`,
        doc.split('\n').filter((line) => line.includes('number:')),
      );
    }

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.mkdirSync(path.join(outDir, targetDir), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(path.join(outDir, targetDir, filename), doc + '\n');
  });
}
