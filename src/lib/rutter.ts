import { ApiObject, App, Chart, Testing } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Ingress, ServiceAccount } from 'cdk8s-plus-33';
import type { Construct } from 'constructs';
import * as jsYaml from 'js-yaml';

import { include } from './helm.js';
import { HelmChartWriter, type SynthAsset } from './helmChartWriter.js';
import { AWSResources } from './resources/cloud/aws/awsResources.js';
import { createLogger, type TimonelLogger } from './utils/logger.js';
import type {
  AWSALBIngressSpec,
  AWSEBSStorageClassSpec,
  AWSECRServiceAccountSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
} from './resources/cloud/aws/awsResources.js';
import { KarpenterResources } from './resources/cloud/aws/karpenterResources.js';
import type {
  KarpenterEC2NodeClassSpec,
  KarpenterNodeClaimSpec,
  KarpenterNodePoolSpec,
} from './resources/cloud/aws/karpenterResources.js';
import { dumpHelmAwareYaml } from './utils/helmYamlSerializer.js';
import { generateHelpersTemplate } from './utils/helmHelpers.js';
import type { HelperDefinition } from './utils/helmHelpers.js';

/**
 * Rutter class with modular architecture
 * Provides a clean API while delegating to specialized resource providers
 * Maintains full backward compatibility with the original Rutter class
 *
 * @since 2.8.0+
 */
export class Rutter {
  // Constants for labels
  private static readonly HELPER_NAME = 'chart.name';

  // CDK8s infrastructure
  private readonly app: App;
  private readonly assets: Array<{ id: string; yaml: string; target: string }> = [];
  private readonly awsResources: AWSResources;
  private readonly chart: Chart;
  private readonly defaultValues: Record<string, unknown>;
  private readonly envValues: Record<string, Record<string, unknown>>;
  private readonly karpenterResources: KarpenterResources;
  private readonly meta: ChartMetadata;
  private readonly props: RutterProps;
  private readonly logger: TimonelLogger;

  constructor(props: RutterProps) {
    this.defaultValues = props.defaultValues ?? {};
    this.envValues = props.envValues ?? {};
    this.meta = props.meta;
    this.props = props;
    this.logger = props.logger ?? createLogger('rutter');

    this.logger.info('Initializing chart', {
      chartName: props.meta.name,
      version: props.meta.version,
      namespace: props.namespace,
      operation: 'chart_initialization',
    });

    // Create CDK8s infrastructure
    this.app = new App();
    this.chart = new Chart(this.app, props.meta.name, {
      ...props.chartProps,
      ...(props.namespace ? { namespace: props.namespace } : {}),
    });

    // Initialize resource providers
    this.awsResources = new AWSResources(this.chart);
    this.karpenterResources = new KarpenterResources(this.chart);
  }

  // AWS Resources
  /**
   * Creates an AWS EBS StorageClass
   * @param spec - EBS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSEBSStorageClass({
   *   name: 'fast-ebs',
   *   volumeType: 'gp3',
   *   encrypted: true,
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addAWSEBSStorageClass(spec: AWSEBSStorageClassSpec): ApiObject {
    return this.awsResources.addEBSStorageClass(spec);
  }

  /**
   * Creates an AWS EFS StorageClass
   * @param spec - EFS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSEFSStorageClass({
   *   name: 'efs-storage',
   *   fileSystemId: 'fs-12345678',
   *   directoryPerms: '0755'
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addAWSEFSStorageClass(spec: AWSEFSStorageClassSpec): ApiObject {
    return this.awsResources.addEFSStorageClass(spec);
  }

  /**
   * Creates an AWS IRSA ServiceAccount
   * @param spec - IRSA ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSIRSAServiceAccount({
   *   name: 'my-service-account',
   *   roleArn: 'arn:aws:iam::ACCOUNT_ID:role/MyRole'
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addAWSIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec): ServiceAccount {
    return this.awsResources.addIRSAServiceAccount(spec);
  }

  /**
   * Creates an AWS ALB Ingress
   * @param spec - ALB Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSALBIngress({
   *   name: 'web-ingress',
   *   rules: [{
   *     paths: [{
   *       path: '/',
   *       pathType: 'Prefix',
   *       backend: { service: { name: 'web-service', port: { number: 80 } } }
   *     }]
   *   }],
   *   scheme: 'internet-facing'
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addAWSALBIngress(spec: AWSALBIngressSpec): Ingress {
    return this.awsResources.addALBIngress(spec);
  }

  // AWS Karpenter Resources
  /**
   * Creates a Karpenter NodePool resource
   * @param spec - NodePool specification
   * @returns Created NodePool ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodePool({
   *   name: 'default-nodepool',
   *   template: {
   *     spec: {
   *       nodeClassRef: {
   *         apiVersion: 'karpenter.k8s.aws/v1beta1',
   *         kind: 'EC2NodeClass',
   *         name: 'default'
   *       }
   *     }
   *   }
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addKarpenterNodePool(spec: KarpenterNodePoolSpec): ApiObject {
    return this.karpenterResources.addKarpenterNodePool(spec);
  }

  /**
   * Creates a Karpenter NodeClaim resource
   * @param spec - NodeClaim specification
   * @returns Created NodeClaim ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodeClaim({
   *   name: 'my-node-claim',
   *   nodeClassRef: {
   *     apiVersion: 'karpenter.k8s.aws/v1beta1',
   *     kind: 'EC2NodeClass',
   *     name: 'default'
   *   }
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addKarpenterNodeClaim(spec: KarpenterNodeClaimSpec): ApiObject {
    return this.karpenterResources.addKarpenterNodeClaim(spec);
  }

  /**
   * Creates a Karpenter EC2NodeClass resource
   * @param spec - EC2NodeClass specification
   * @returns Created EC2NodeClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterEC2NodeClass({
   *   name: 'default',
   *   amiFamily: 'AL2',
   *   subnetSelectorTerms: [{ tags: { 'karpenter.sh/discovery': 'my-cluster' } }],
   *   securityGroupSelectorTerms: [{ tags: { 'karpenter.sh/discovery': 'my-cluster' } }]
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addKarpenterEC2NodeClass(spec: KarpenterEC2NodeClassSpec): ApiObject {
    return this.karpenterResources.addKarpenterEC2NodeClass(spec);
  }

  /**
   * Creates a Karpenter NodePool with optimized disruption settings for cost efficiency
   * @param spec - NodePool specification with disruption optimization
   * @returns Created NodePool ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodePoolWithDisruption({
   *   name: 'cost-optimized',
   *   nodeClassRef: {
   *     apiVersion: 'karpenter.k8s.aws/v1beta1',
   *     kind: 'EC2NodeClass',
   *     name: 'default'
   *   },
   *   consolidationPolicy: 'WhenEmptyOrUnderutilized',
   *   consolidateAfter: '30s',
   *   expireAfter: '24h',
   *   disruptionBudgets: [
   *     { nodes: '20%' },
   *     { nodes: '0', schedule: '0 9 * * 1-5', duration: '8h' }
   *   ]
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addKarpenterNodePoolWithDisruption(spec: {
    name: string;
    nodeClassRef: { apiVersion: string; kind: string; name: string };
    requirements?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
      values?: string[];
    }>;
    consolidationPolicy?: 'WhenEmpty' | 'WhenEmptyOrUnderutilized';
    consolidateAfter?: string;
    expireAfter?: string;
    disruptionBudgets?: Array<{ nodes: string; schedule?: string; duration?: string }>;
    limits?: Record<string, string>;
    weight?: number;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): ApiObject {
    return this.karpenterResources.addKarpenterNodePoolWithDisruption(spec);
  }

  /**
   * Creates a Karpenter NodePool with scheduling constraints and priorities
   * @param spec - NodePool specification with scheduling optimization
   * @returns Created NodePool ApiObject
   *
   * @example
   * ```typescript
   * rutter.addKarpenterNodePoolWithScheduling({
   *   name: 'gpu-workloads',
   *   nodeClassRef: {
   *     apiVersion: 'karpenter.k8s.aws/v1beta1',
   *     kind: 'EC2NodeClass',
   *     name: 'gpu-nodeclass'
   *   },
   *   requirements: [
   *     { key: 'node.kubernetes.io/instance-type', operator: 'In', values: ['g4dn.xlarge', 'g4dn.2xlarge'] }
   *   ],
   *   taints: [
   *     { key: 'nvidia.com/gpu', effect: 'NoSchedule' }
   *   ],
   *   terminationGracePeriod: '60s',
   *   weight: 100
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addKarpenterNodePoolWithScheduling(spec: {
    name: string;
    nodeClassRef: { apiVersion: string; kind: string; name: string };
    requirements?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
      values?: string[];
    }>;
    taints?: Array<{
      key: string;
      value?: string;
      effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    }>;
    startupTaints?: Array<{
      key: string;
      value?: string;
      effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    }>;
    terminationGracePeriod?: string;
    weight?: number;
    limits?: Record<string, string>;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): ApiObject {
    return this.karpenterResources.addKarpenterNodePoolWithScheduling(spec);
  }

  // AWS ECR ServiceAccount
  /**
   * Creates a ServiceAccount with ECR access annotations
   * @param spec - ECR ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSECRServiceAccount({
   *   name: 'ecr-service-account',
   *   roleArn: 'arn:aws:iam::ACCOUNT_ID:role/ECRAccessRole'
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addAWSECRServiceAccount(spec: AWSECRServiceAccountSpec): ServiceAccount {
    return this.awsResources.addECRServiceAccount(spec);
  }

  // Manifest Helpers
  // Utility methods
  /**
   * Adds a Kubernetes manifest to the chart using CDK8S
   *
   * This method allows you to add any Kubernetes manifest (CRDs, custom resources, etc.)
   * either as YAML strings or as objects. The manifest will be processed using CDK8S
   * for better type safety and validation. Uses js-yaml for reliable YAML parsing.
   *
   * @param yamlOrObject - Kubernetes manifest as YAML string or object
   * @param id - Unique identifier for the manifest (required for multiple manifests)
   *
   * @example
   * ```typescript
   * // Using YAML string for CRD
   * rutter.addManifest(`
   * apiVersion: apiextensions.k8s.io/v1
   * kind: CustomResourceDefinition
   * metadata:
   *   name: example.com
   * spec:
   *   group: example.com
   *   versions: []
   * `, 'my-crd');
   *
   * // Using object for any Kubernetes resource
   * rutter.addManifest({
   *   apiVersion: 'v1',
   *   kind: 'ConfigMap',
   *   metadata: { name: 'my-config' },
   *   data: { key: 'value' }
   * }, 'my-configmap');
   * ```
   *
   * @since 2.8.0+
   * @since 2.9.2 Improved YAML parsing with js-yaml.load for better compatibility
   * @note Consider using cdk8s-plus constructs for better type safety when available
   */
  addManifest(yamlOrObject: string | Record<string, unknown>, id: string): ApiObject {
    let manifestObject: Record<string, unknown>;

    if (typeof yamlOrObject === 'string') {
      // Parse YAML string to object
      try {
        manifestObject = jsYaml.load(yamlOrObject) as Record<string, unknown>;
      } catch (error) {
        throw new Error(
          `Invalid YAML provided to addManifest(): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else if (typeof yamlOrObject === 'object' && yamlOrObject !== null) {
      // Use object directly
      manifestObject = yamlOrObject;
    } else {
      throw new Error('addManifest() requires either a YAML string or an object');
    }

    // Validate basic Kubernetes manifest structure
    this.validateManifestStructure(manifestObject);

    // Create CDK8S ApiObject from the manifest
    return new ApiObject(this.chart, id, {
      apiVersion: manifestObject['apiVersion'] as string,
      kind: manifestObject['kind'] as string,
      metadata: manifestObject['metadata'] as Record<string, unknown>,
      spec: manifestObject['spec'] as Record<string, unknown>,
    });
  }

  /**
   * Adds a template manifest to the chart with custom YAML content that preserves Helm expressions.
   * This method allows you to provide raw YAML with Helm templates without serialization issues.
   *
   * @param yamlTemplate - The YAML template string with Helm expressions
   * @param id - Unique identifier for the manifest
   * @returns A placeholder ApiObject
   */
  addTemplateManifest(yamlTemplate: string, id: string): ApiObject {
    // Store the template as an asset that will be processed during write
    const templateAsset = {
      id,
      yaml: yamlTemplate,
      target: 'templates',
    };

    this.assets.push(templateAsset);

    // Return a placeholder ApiObject for compatibility
    return new ApiObject(this.chart, id, {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: id },
    });
  }

  /**
   * Adds a Kubernetes manifest wrapped in a Helm conditional using programmatic template generation
   *
   * This method creates a manifest that will only be rendered if the specified
   * condition evaluates to true. The condition is checked against .Values in Helm.
   *
   * **Key improvements in v2.9.2:**
   * - Uses programmatic Helm template generation instead of JavaScript interpolation
   * - Eliminates Handlebars dependency for conditional manifests
   * - Leverages the include() function from helm.ts for proper Helm syntax
   * - Provides better type safety and eliminates double interpolation issues
   * - Maintains backward compatibility with existing condition syntax
   *
   * @param manifestObject - JavaScript object representing the Kubernetes manifest
   * @param condition - Helm condition path (e.g., 'enabled', 'feature.enabled')
   *                   Can also be a full Helm expression like '{{ .Values.enabled }}'
   * @param id - Unique identifier for the manifest
   * @returns ApiObject instance for CDK8S compatibility
   *
   * @example
   * ```typescript
   * // Simple boolean condition
   * rutter.addConditionalManifest(
   *   {
   *     apiVersion: 'v1',
   *     kind: 'Namespace',
   *     metadata: { name: 'my-namespace' }
   *   },
   *   'createNamespace',
   *   'namespace'
   * );
   *
   * // Nested condition with complex logic
   * rutter.addConditionalManifest(
   *   {
   *     apiVersion: 'v1',
   *     kind: 'ConfigMap',
   *     metadata: { name: 'app-config' },
   *     data: {
   *       config: '{{ .Values.config }}',
   *       environment: '{{ .Values.environment }}'
   *     }
   *   },
   *   'features.configMap.enabled',
   *   'app-config'
   * );
   * ```
   *
   * @throws {Error} When condition is invalid or manifest structure is malformed
   * @since 2.8.4
   * @since 2.9.2 Enhanced with programmatic Helm template generation for better reliability
   */
  addConditionalManifest(
    manifestObject: Record<string, unknown>,
    condition: string,
    id: string,
  ): ApiObject {
    // Validate condition path
    if (!condition || typeof condition !== 'string') {
      throw new Error('Condition must be a non-empty string');
    }

    // Validate basic Kubernetes manifest structure
    this.validateManifestStructure(manifestObject);

    // Handle condition - if it's already a Helm expression, use it directly
    // Otherwise, treat it as a path and wrap it with .Values.
    let helmCondition: string;
    if (condition.startsWith('{{') && condition.endsWith('}}')) {
      // Already a Helm expression, extract the inner part and use as-is
      helmCondition = condition.slice(2, -2).trim();
    } else {
      // Plain path, wrap with .Values.
      helmCondition = `.Values.${condition}`;
    }

    try {
      // Convert the manifest to YAML with Helm-aware serialization
      const yamlContent = dumpHelmAwareYaml(manifestObject, {
        // Preserve formatting and minimize line wrapping
        lineWidth: 0,
      });

      // Create programmatic Helm conditional template using proper syntax
      // This eliminates JavaScript interpolation and uses native Helm templating
      const conditionalYaml = `{{- if ${helmCondition} }}
${yamlContent.trim()}
{{- end }}`;

      // Store the manifest as a conditional asset that will be processed during write
      const conditionalAsset = {
        id,
        yaml: conditionalYaml,
        target: 'templates',
      };

      this.assets.push(conditionalAsset);
    } catch (error) {
      throw new Error(
        `Failed to generate conditional template for manifest '${id}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Create a placeholder CDK8S ApiObject for consistency, but mark it as conditional
    // so it doesn't get processed as a separate asset
    return new ApiObject(this.chart, `${id}-placeholder`, {
      apiVersion: manifestObject['apiVersion'] as string,
      kind: manifestObject['kind'] as string,
      metadata: {
        ...((manifestObject['metadata'] as Record<string, unknown>) || {}),
        annotations: {
          ...(((manifestObject['metadata'] as Record<string, unknown>)?.['annotations'] as Record<
            string,
            unknown
          >) || {}),
          'timonel.sh/conditional': condition,
          'timonel.sh/placeholder': 'true', // Mark as placeholder to exclude from synthesis
        },
      },
      spec: manifestObject['spec'] as Record<string, unknown>,
    });
  }

  /**
   * Validates the structure of a Kubernetes manifest object
   * @param manifest - The manifest object to validate
   * @private
   * @since 2.8.0+
   */
  private validateManifestStructure(manifest: Record<string, unknown>): void {
    if (!manifest.apiVersion) {
      this.logger.error('Validation failed: Missing apiVersion', {
        operation: 'manifest_validation',
        issue: 'missing_api_version',
      });
      throw new Error('Manifest must have an apiVersion');
    }

    if (!manifest.kind) {
      this.logger.error('Validation failed: Missing kind', {
        operation: 'manifest_validation',
        issue: 'missing_kind',
      });
      throw new Error('Manifest must have a kind');
    }

    if (!manifest.metadata) {
      this.logger.error('Validation failed: Missing metadata', {
        operation: 'manifest_validation',
        issue: 'missing_metadata',
      });
      throw new Error('Manifest must have metadata');
    }

    const metadata = manifest.metadata as Record<string, unknown>;
    if (!metadata.name) {
      this.logger.error('Validation failed: Missing metadata.name', {
        operation: 'manifest_validation',
        issue: 'missing_metadata_name',
      });
      throw new Error('Manifest metadata must have a name');
    }

    // Validate that metadata.name is a string
    if (typeof metadata.name !== 'string') {
      this.logger.error('Validation failed: metadata.name must be a string', {
        operation: 'manifest_validation',
        issue: 'invalid_metadata_name_type',
        actual_type: typeof metadata.name,
      });
      throw new Error('Manifest metadata.name must be a string');
    }
  }

  /**
   * Gets chart metadata
   * @returns Chart metadata
   *
   * @since 2.8.0+
   */
  getMeta(): ChartMetadata {
    return { ...this.meta };
  }

  /**
   * Gets default values
   * @returns Default values object
   *
   * @since 1.0.0
   */
  getDefaultValues(): Record<string, unknown> {
    return { ...this.defaultValues };
  }

  /**
   * Gets environment-specific values
   * @returns Environment values object
   *
   * @since 1.0.0
   */
  getEnvValues(): Record<string, Record<string, unknown>> {
    return { ...this.envValues };
  }

  /**
   * Gets all assets (CRDs, etc.)
   * @returns Array of assets
   *
   * @since 1.0.0
   */
  getAssets(): Array<{ id: string; yaml: string; target: string }> {
    return [...this.assets];
  }

  /**
   * Converts the chart to SynthAsset array for HelmChartWriter
   * @returns Array of synthesized assets
   *
   * @since 2.8.0+
   */
  private toSynthArray(): SynthAsset[] {
    const timer = this.logger.time('chart_synthesis');

    this.logger.debug('Starting chart synthesis', {
      chartName: this.meta.name,
      operation: 'synthesis_start',
    });

    // Get ApiObject IDs before synthesis, excluding placeholders
    const apiObjectIds: string[] = [];
    for (const child of this.chart.node.children) {
      if (child instanceof ApiObject && !child.node.id.endsWith('-placeholder')) {
        apiObjectIds.push(child.node.id);
      }
    }

    // Use cdk8s Testing.synth to obtain manifest objects, but filter out placeholders
    const allManifestObjs = Testing.synth(this.chart) as unknown[];
    const manifestObjs = allManifestObjs.filter((obj) => {
      if (obj && typeof obj === 'object') {
        const o = obj as { metadata?: { annotations?: Record<string, string> } };
        const annotations = o.metadata?.annotations || {};
        return annotations['timonel.sh/placeholder'] !== 'true';
      }
      return true;
    });

    this.logger.info('Processing manifest objects', {
      chartName: this.meta.name,
      manifestCount: manifestObjs.length,
      apiObjectCount: apiObjectIds.length,
      operation: 'manifest_processing',
    });
    // Enforce common labels best-practice on all rendered objects
    const enriched = manifestObjs.map((obj: unknown) => {
      if (obj && typeof obj === 'object') {
        const o = obj as { metadata?: { labels?: Record<string, unknown> } };
        o.metadata = o.metadata ?? {};
        o.metadata.labels = o.metadata.labels ?? {};
        const labels = o.metadata.labels as Record<string, unknown>;
        const defaults: Record<string, string> = {
          'helm.sh/chart': `{{ .Chart.Name }}-{{ .Chart.Version }}`,
          'app.kubernetes.io/name': include(Rutter.HELPER_NAME),
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
          'app.kubernetes.io/version': '{{ .Chart.Version }}',
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'app.kubernetes.io/part-of': '{{ .Chart.Name }}',
        };

        // Apply defaults only if not already set
        for (const [key, value] of Object.entries(defaults)) {
          if (!(key in labels)) {
            // eslint-disable-next-line security/detect-object-injection -- Safe: controlled label assignment
            labels[key] = value;
          }
        }
      }
      return obj;
    });

    const synthAssets: SynthAsset[] = [];

    if (this.props.singleManifestFile) {
      // Combine all resources into single manifest
      const combinedYaml = enriched
        .map((obj) => this.processHelmTemplates(dumpHelmAwareYaml(obj).trim()))
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        // eslint-disable-next-line security/detect-object-injection
        const apiObjectId = apiObjectIds[index];
        const manifestId = apiObjectId || `manifest-${index + 1}`;

        const yaml = this.processHelmTemplates(dumpHelmAwareYaml(obj).trim());
        if (yaml) {
          // Use descriptive name from ApiObject ID if available, otherwise fallback to generic name
          synthAssets.push({ id: manifestId, yaml });
        }
      });
    }

    // Add any additional assets (CRDs, etc.)
    this.assets.forEach((asset) => {
      synthAssets.push({ id: asset.id, yaml: asset.yaml });
    });

    this.logger.info('Chart synthesis completed', {
      chartName: this.meta.name,
      totalAssets: synthAssets.length,
      additionalAssets: this.assets.length,
      operation: 'synthesis_complete',
    });

    timer(); // Complete timing measurement
    return synthAssets;
  }

  /**
   * Processes Helm template expressions in YAML content
   * @param yaml - YAML content to process
   * @returns Processed YAML with proper Helm template syntax
   *
   * @since 2.8.0+
   */
  private processHelmTemplates(yaml: string): string {
    let processed = this.fixCharacterMappingIssues(yaml);
    processed = this.applyHelmTemplateReplacements(processed);
    return processed;
  }

  private fixCharacterMappingIssues(yaml: string): string {
    const lines = yaml.split('\n');
    const fixedLines: string[] = [];
    let i = 0;

    while (i < lines.length) {
      // eslint-disable-next-line security/detect-object-injection
      const line = lines[i];

      if (!line) {
        i++;
        continue;
      }

      const charKeyMatch = line.match(/^(\s*)"(\d+)":\s*(.+)$/);
      if (charKeyMatch && charKeyMatch[2] && parseInt(charKeyMatch[2]) === 0) {
        const indent = charKeyMatch[1] || '';
        const result = this.processCharacterMapping(lines, i, indent);
        if (result.reconstructed) {
          fixedLines.push(result.reconstructed);
          i = result.nextIndex;
          continue;
        }
      }

      if (line) {
        fixedLines.push(line);
      }
      i++;
    }

    return fixedLines.join('\n');
  }

  private processCharacterMapping(
    lines: string[],
    startIndex: number,
    indent: string,
  ): { reconstructed?: string; nextIndex: number } {
    const charMappings: Array<{ index: number; char: string }> = [];
    let j = startIndex;

    while (j < lines.length) {
      // eslint-disable-next-line security/detect-object-injection
      const currentLine = lines[j];
      if (!currentLine) {
        break;
      }

      const currentMatch = currentLine.match(/^(\s*)"(\d+)":\s*(.+)$/);
      if (currentMatch && currentMatch[1] === indent && currentMatch[2] && currentMatch[3]) {
        const index = parseInt(currentMatch[2]);
        let char = currentMatch[3];

        if (char && char.startsWith('"') && char.endsWith('"')) {
          char = char.slice(1, -1);
        }

        charMappings.push({ index, char });
        j++;
      } else {
        break;
      }
    }

    if (charMappings.length > 3) {
      charMappings.sort((a, b) => a.index - b.index);
      const reconstructed = charMappings.map((m) => m.char).join('');

      if (reconstructed.includes('{{') && reconstructed.includes('}}')) {
        return { reconstructed: `${indent}${reconstructed}`, nextIndex: j };
      }
    }

    return { nextIndex: j };
  }

  private applyHelmTemplateReplacements(processed: string): string {
    // Handle complex multi-line expressions
    processed = this.fixConditionalBlocks(processed);

    // Handle expressions with pipes
    processed = this.fixPipeExpressions(processed);

    // Fix nested quotes
    processed = this.fixNestedQuotes(processed);

    // Clean up artifacts
    processed = this.cleanupArtifacts(processed);

    // Remove quotes around Helm expressions (final step)
    processed = this.removeHelmExpressionQuotes(processed);

    return processed;
  }

  private fixIncludeStatements(processed: string): string {
    processed = processed.replace(
      /\{\{ include \\"([^"]+)\\" \. \| nindent (\d+) \}\}/g,
      '{{ include "$1" . | nindent $2 }}',
    );
    processed = processed.replace(/\{\{ include \\"([^"]+)\\" \. \}\}/g, '{{ include "$1" . }}');
    return processed;
  }

  private fixFunctionCalls(processed: string): string {
    return processed.replace(/\{\{ (\w+) \\"([^"]*)\\" ([^}]*) \}\}/g, '{{ $1 "$2" $3 }}');
  }

  private fixChartReferences(processed: string): string {
    return processed.replace(
      /\{\{ \.Chart\.(\w+) \| replace \\"([^"]*)\\" \\"([^"]*)\\" ([^}]*) \}\}/g,
      '{{ .Chart.$1 | replace "$2" "$3" $4 }}',
    );
  }

  private removeHelmExpressionQuotes(processed: string): string {
    // UNIVERSAL SOLUTION: Handle all primitive types (int, float, bool) that should not be quoted

    // Define replacement pattern as constant
    const HELM_EXPRESSION_REPLACEMENT = '$1$2: {{$3}}';

    // 1. Handle expressions with type conversion functions (highest priority)
    // These are explicit type conversions that should never be quoted
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\|\s*(?:int|float|bool|number)[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 2. Handle known numeric fields in Kubernetes manifests
    processed = processed.replace(
      /^(\s*)(port):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // Handle nested port fields (e.g., port.number)
    processed = processed.replace(
      /^(\s*)(port\.number):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // Handle other common nested numeric fields
    processed = processed.replace(
      /^(\s*)(service\.port):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(backend\.service\.port\.number):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(spec\.port):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // Handle any field ending with .number (general pattern)
    processed = processed.replace(
      /^(\s*)([^:\s]*\.number):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    processed = processed.replace(
      /^(\s*)(number):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    processed = processed.replace(
      /^(\s*)(replicas):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(targetPort):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(nodePort):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(containerPort):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(hostPort):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(weight):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(priority):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(timeoutSeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(periodSeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(successThreshold):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(failureThreshold):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(initialDelaySeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(terminationGracePeriodSeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(activeDeadlineSeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(backoffLimit):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(parallelism):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(completions):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(revisionHistoryLimit):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(progressDeadlineSeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(minReadySeconds):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(maxUnavailable):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(maxSurge):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(cpu):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(memory):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 3. Handle known boolean fields in Kubernetes manifests
    processed = processed.replace(
      /^(\s*)(enabled):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(create):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(allow):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(disable):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(force):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(required):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(optional):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(readOnly):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(runAsNonRoot):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(privileged):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(allowPrivilegeEscalation):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)(readOnlyRootFilesystem):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 4. Handle literal primitive values (true, false, numbers)
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*true[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*false[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\d+[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 5. Handle expressions that contain comparison operators
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\beq\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\bne\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\blt\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\ble\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\bgt\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\bge\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\band\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\bor\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*\bnot\b[^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 6. Handle expressions that contain arithmetic operators
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*[+][^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*[-][^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*[*][^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 7. Complex expressions spanning multiple template parts
    processed = processed.replace(/:\s*"([^"]*\{\{[^}]+\}\}[^"]*)"/g, ': $1');

    // 8. Handle literal primitive values (not in Helm expressions)
    // Boolean literals
    processed = processed.replace(/^(\s*)([^:\s]+):\s*"(true|false)"$/gm, '$1$2: $3');

    // Integer literals
    processed = processed.replace(/^(\s*)([^:\s]+):\s*"(-?\d+)"$/gm, '$1$2: $3');

    // Float literals (simple decimal numbers)
    processed = processed.replace(/^(\s*)([^:\s]+):\s*"(-?\d+\.\d+)"$/gm, '$1$2: $3');

    // Scientific notation (e.g., 1.5e-3, 2E+5)
    processed = processed.replace(/^(\s*)([^:\s]+):\s*"(-?\d+\.?\d*[eE][+-]?\d+)"$/gm, '$1$2: $3');

    // 9. Key-value pairs with quoted Helm expressions (general case)
    processed = processed.replace(
      /^(\s*)([^:\s]+):\s*"\{\{([^}]*)\}\}"/gm,
      HELM_EXPRESSION_REPLACEMENT,
    );

    // 10. Standalone quoted Helm expressions
    processed = processed.replace(/"\{\{([^}]*)\}\}"/g, '{{$1}}');

    // 11. Array/list items with quoted Helm expressions
    processed = processed.replace(/^(\s*)-\s*"\{\{([^}]*)\}\}"/gm, '$1- {{$2}}');

    return processed;
  }

  private fixConditionalBlocks(processed: string): string {
    return processed.replace(
      /"\{\{-\s*(if|with|range)([^}]*)\}\}([^"]*)\{\{-\s*end\s*\}\}"/g,
      '{{- $1$2}}$3{{- end }}',
    );
  }

  private fixPipeExpressions(processed: string): string {
    return processed.replace(/"\{\{([^}]*\|[^}]*)\}\}"/g, '{{$1}}');
  }

  private fixNestedQuotes(processed: string): string {
    return processed.replace(/\{\{([^}]*)\\"([^"]*)\\"([^}]*)\}\}/g, '{{$1"$2"$3}}');
  }

  private cleanupArtifacts(processed: string): string {
    processed = processed.replace(/": "\.nan"/g, ': .nan');
    processed = processed.replace(/: \{\{([^}]+)\}\}$/gm, ': {{$1}}');
    return processed;
  }

  /**
   * Writes the Helm chart to the specified output directory
   * @param outDir - Output directory path
   *
   * @since 1.0.0
   */
  write(outDir: string): void {
    const timer = this.logger.time('chart_write');

    this.logger.info('Starting chart write operation', {
      chartName: this.meta.name,
      outputDirectory: outDir,
      operation: 'chart_write_start',
    });

    // Generate helpers template
    let helpersContent: string | undefined;
    if (this.props.helpersTpl) {
      if (typeof this.props.helpersTpl === 'string') {
        helpersContent = this.props.helpersTpl;
      } else {
        helpersContent = this.props.helpersTpl
          .map(
            (helper) => `{{/*
${helper.name}
*/}}
{{- define "${helper.name}" -}}
${helper.template}
{{- end }}`,
          )
          .join('\n\n');
      }
    } else {
      // Auto-generate standard helpers
      helpersContent = generateHelpersTemplate(this.props.cloudProvider);
    }

    const synthAssets = this.toSynthArray();

    this.logger.info('Generated assets for chart', {
      chartName: this.meta.name,
      assetCount: synthAssets.length,
      operation: 'assets_generated',
    });

    HelmChartWriter.write({
      outDir,
      meta: this.meta,
      defaultValues: this.defaultValues,
      envValues: this.envValues,
      assets: synthAssets,
      helpersTpl: helpersContent,
    });

    this.logger.info('Chart write operation completed successfully', {
      chartName: this.meta.name,
      outputDirectory: outDir,
      operation: 'chart_write_complete',
    });

    timer(); // Complete timing measurement
  }
}

// Type definitions
export interface ChartMetadata {
  description?: string;
  home?: string;
  keywords?: string[];
  maintainers?: Array<{
    email?: string;
    name: string;
    url?: string;
  }>;
  name: string;
  sources?: string[];
  version: string;
}

export interface RutterProps {
  chartProps?: ChartProps;
  /** Cloud provider for default helpers */
  cloudProvider?: 'aws';
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  /** Custom Helm helpers content or definitions */
  helpersTpl?: string | HelperDefinition[];
  /** Custom prefix for manifest files */
  manifestPrefix?: string;
  meta: ChartMetadata;
  namespace?: string;
  scope?: Construct;
  /** Combine all resources into single manifest file */
  singleManifestFile?: boolean;
  /**
   * Custom logger instance
   * @since 2.13.0
   */
  logger?: TimonelLogger;
}

// Re-export types for backward compatibility
export type {
  AWSALBIngressSpec,
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
} from './resources/cloud/aws/awsResources.js';
