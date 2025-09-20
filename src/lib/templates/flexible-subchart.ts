/**
 * @fileoverview Flexible subchart template that supports any cdk8s/cdk8s-plus-33 construct
 * @since 2.8.4
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

import { Chart } from 'cdk8s';

import { dumpHelmAwareYaml } from '../utils/helmYamlSerializer.js';
import { generateHelpersTemplate } from '../utils/helmHelpers.js';

/**
 * Flexible subchart that can accept any cdk8s construct or function
 * @since 2.8.4
 */
export class FlexibleSubchart extends Chart {
  private _constructs: unknown[] = [];
  private _manifests: unknown[] = [];

  constructor(
    scope: Chart,
    id: string,
    private readonly config: {
      name: string;
      version?: string;
      description?: string;
      construct?: unknown;
      manifest?: unknown;
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
   * Add any manifest (for addManifest compatibility)
   * @param manifest - Any manifest object
   * @param id - Unique identifier
   */
  addManifest(manifest: unknown, id?: string) {
    if (manifest) {
      this._manifests.push({ manifest, id: id || `manifest-${this._manifests.length}` });
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

    // Add any provided manifest
    if (this.config.manifest) {
      this.addManifest(this.config.manifest);
    }

    // Add any additional properties as constructs
    Object.entries(this.config).forEach(([key, value]) => {
      if (
        key !== 'name' &&
        key !== 'version' &&
        key !== 'description' &&
        key !== 'construct' &&
        key !== 'manifest' &&
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
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(outputDir, 'Chart.yaml'), dumpHelmAwareYaml(subchartYaml));

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
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    writeFileSync(join(outputDir, 'values.yaml'), dumpHelmAwareYaml(subchartValues));

    // Create templates directory
    const templatesDir = join(outputDir, 'templates');
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

    // Generate templates for manifests
    this._manifests.forEach((item) => {
      if (item && typeof item === 'object' && 'manifest' in item && 'id' in item) {
        const { manifest, id } = item as { manifest: unknown; id: string };
        if (manifest && typeof manifest === 'object') {
          const templateContent = this._generateManifestTemplate(manifest, id);
          // eslint-disable-next-line security/detect-non-literal-fs-filename
          writeFileSync(join(templatesDir, `${id}.yaml`), templateContent);
        }
      }
    });

    console.log(`Created flexible Helm chart for subchart: ${this.config.name}`);
  }

  /**
   * Generate Helm template for a manifest
   * @param manifest - The manifest object
   * @param id - Template identifier
   * @returns Generated template content
   * @private
   */
  private _generateManifestTemplate(manifest: unknown, id: string): string {
    // Convert the manifest to a Helm template
    if (typeof manifest !== 'object' || manifest === null) {
      return dumpHelmAwareYaml({});
    }

    const manifestObj = manifest as Record<string, unknown>;
    const template = {
      apiVersion: manifestObj.apiVersion || 'v1',
      kind: manifestObj.kind || 'Manifest',
      metadata: {
        name: `{{ include "${id}.fullname" . }}`,
        labels: `{{ include "${id}.labels" . }}`,
        ...((manifestObj.metadata as Record<string, unknown>) || {}),
      },
      spec: manifestObj.spec || {},
      ...manifestObj,
    };

    return dumpHelmAwareYaml(template);
  }

  /**
   * Get all constructs added to this subchart
   */
  getConstructs() {
    return this._constructs;
  }

  /**
   * Get all manifests added to this subchart
   */
  getManifests() {
    return this._manifests;
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
