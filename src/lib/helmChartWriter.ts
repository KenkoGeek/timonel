/**
 * @fileoverview Helm chart writer for generating complete Helm chart structures
 * @since 2.8.0+
 */

import * as fs from 'fs';
import * as path from 'path';

import { SecurityUtils } from './security.js';
import { createLogger, type TimonelLogger } from './utils/logger.js';
import { dumpHelmAwareYaml } from './utils/helmYamlSerializer.js';
import type { HelperDefinition as ExternalHelperDefinition } from './utils/helmHelpers/types.js';

/**
 * Helm template helper definition shared across helper modules.
 * @since 2.8.0+ (unified with utils helper definitions in 2.12.2)
 */
export type HelperDefinition = ExternalHelperDefinition;

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
  /**
   * Custom logger instance
   * @since 2.13.0
   */
  logger?: TimonelLogger;
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
      logger: customLogger,
    } = opts;

    const logger = customLogger ?? createLogger('helm-chart-writer');
    const timer = logger.time('helm_chart_write');

    logger.info('Starting Helm chart write operation', {
      chartName: meta.name,
      version: meta.version,
      outputDirectory: outDir,
      assetCount: assets.length,
      operation: 'helm_write_start',
    });

    // Validate output directory path
    const validatedOutDir = SecurityUtils.validatePath(outDir, process.cwd(), {
      allowAbsolute: true,
    });

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

    logger.info('Helm chart write operation completed successfully', {
      chartName: meta.name,
      version: meta.version,
      outputDirectory: validatedOutDir,
      operation: 'helm_write_complete',
    });

    timer(); // Complete timing measurement
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
        .map((h) =>
          [`{{- define "${h.name}" -}}`, h.template.trimEnd(), '{{- end }}', ''].join('\n'),
        )
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
    const targetDir = getTargetDirectory(asset.target);

    try {
      const { directorySegments, fileBaseName } = resolveAssetPath(asset.id);

      if (asset.singleFile) {
        writeSingleAssetFile(outDir, targetDir, directorySegments, fileBaseName, asset.yaml);
      } else {
        writeMultipleAssetFiles(outDir, targetDir, directorySegments, fileBaseName, asset.yaml);
      }
    } catch (error) {
      console.error(`Failed to write asset ${asset.id}:`, error);
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
  directorySegments: string[],
  fileBaseName: string,
  yaml: string,
): void {
  const chartSubdir = path.join(outDir, targetDir, ...directorySegments);
  SecurityUtils.validatePath(chartSubdir, outDir);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.mkdirSync(chartSubdir, { recursive: true });

  const filename = `${fileBaseName}.yaml`;
  const absolutePath = path.join(chartSubdir, filename);
  SecurityUtils.validatePath(absolutePath, outDir);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.writeFileSync(absolutePath, yaml.endsWith('\n') ? yaml : `${yaml}\n`);
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
  directorySegments: string[],
  fileBaseName: string,
  yaml: string,
): void {
  const chartSubdir = path.join(outDir, targetDir, ...directorySegments);
  SecurityUtils.validatePath(chartSubdir, outDir);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
  fs.mkdirSync(chartSubdir, { recursive: true });

  const parts = splitDocs(yaml);
  parts.forEach((doc, index) => {
    const suffix = parts.length > 1 ? `-${index + 1}` : '';
    const filename = `${fileBaseName}${suffix}.yaml`;
    const absolutePath = path.join(chartSubdir, filename);
    SecurityUtils.validatePath(absolutePath, outDir);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chart writer needs dynamic paths
    fs.writeFileSync(absolutePath, doc.endsWith('\n') ? doc : `${doc}\n`);
  });
}

/**
 * Validates an asset identifier and converts it into directory segments and file basename.
 * @param assetId - Identifier provided by the synthesizer.
 * @returns Normalized directory segments and filename stem.
 * @since 2.12.2 Preserves human-friendly asset identifiers without compromising safety.
 */
function resolveAssetPath(assetId: string): { directorySegments: string[]; fileBaseName: string } {
  if (!assetId || typeof assetId !== 'string') {
    throw new Error('Asset ID must be a non-empty string');
  }

  if (assetId.includes('\0')) {
    throw new Error('Asset ID cannot contain null bytes');
  }

  const normalized = assetId.replace(/\\+/g, '/');
  const rawSegments = normalized.split('/');
  if (rawSegments.length === 0) {
    throw new Error('Asset ID must resolve to at least one segment');
  }

  const segments = rawSegments.map((segment) => {
    if (!segment || segment.trim().length === 0) {
      throw new Error('Asset path segments cannot be empty');
    }

    if (segment === '.' || segment === '..') {
      throw new Error('Asset path segments cannot be relative references');
    }

    if (/[<>:"|?*]/.test(segment)) {
      throw new Error('Asset path contains unsupported characters');
    }

    const hasControlCharacters = Array.from(segment).some((character) => {
      const codePoint = character.codePointAt(0);
      if (typeof codePoint !== 'number') {
        return false;
      }

      if (codePoint < 0x20 || codePoint === 0x7f) {
        return true;
      }

      if (codePoint >= 0x80 && codePoint <= 0x9f) {
        return true;
      }

      return false;
    });

    if (hasControlCharacters) {
      throw new Error('Asset path contains control characters');
    }

    return segment;
  });

  const fileBaseName = segments[segments.length - 1];
  const directorySegments = segments.slice(0, -1);

  if (!fileBaseName) {
    throw new Error('Asset ID must include a filename segment');
  }

  return { directorySegments, fileBaseName };
}
