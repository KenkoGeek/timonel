import { ApiObject, App, Chart, Testing } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Ingress, ServiceAccount } from 'cdk8s-plus-33';
import type { Construct } from 'constructs';
import { parse } from 'yaml';

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
import { isHelmExpression, isHelmConstruct } from './utils/helmControlStructures.js';
import { dumpHelmAwareYaml, preprocessHelmConstructs } from './utils/helmYamlSerializer.js';
import { generateHelpersTemplate } from './utils/helmHelpers.js';
import type { HelperDefinition } from './utils/helmHelpers.js';
import type { PolicyEngine, PolicyResult } from './policy/index.js';

/**
 * Constants for error messages
 */
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

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

    // Create a proxy for backward compatibility with synchronous toSynthArray calls
    // This allows tests that use rutter['toSynthArray']() to work without await
    const originalToSynthArray = this.toSynthArray.bind(this);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any)['toSynthArray'] = (..._args: any[]) => {
      // If no policy engine is configured, use the synchronous version
      if (!this.props.policyEngine) {
        return this.toSynthArraySync();
      }
      // Otherwise, return the async version (toSynthArray doesn't accept arguments)
      return originalToSynthArray();
    };
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
        manifestObject = parse(yamlOrObject) as Record<string, unknown>;
      } catch (error) {
        throw new Error(
          `Invalid YAML provided to addManifest(): ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`,
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

    // IMPORTANT: Pre-process HelmConstructs BEFORE creating ApiObject
    // This ensures that field-level conditionals are detected and transformed
    // into __fieldConditionalTemplate_* fields that can be preserved during cdk8s serialization
    const preprocessedManifest = preprocessHelmConstructs(manifestObject) as Record<
      string,
      unknown
    >;

    // Create CDK8S ApiObject from the manifest
    // ApiObjectProps has an index signature [key: string]: any, which allows
    // passing additional fields like data, stringData, spec, etc.
    // We validate that required fields exist, then safely construct the props
    const apiObjectProps = {
      apiVersion: preprocessedManifest.apiVersion as string,
      kind: preprocessedManifest.kind as string,
      metadata: preprocessedManifest.metadata as Record<string, unknown>,
      ...preprocessedManifest, // Spread remaining fields (spec, data, stringData, etc.)
    };

    return new ApiObject(this.chart, id, apiObjectProps);
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
        `Failed to generate conditional template for manifest '${id}': ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`,
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

    // Validate metadata.name - must be string, HelmExpression, or HelmConstruct
    const name = (manifest['metadata'] as Record<string, unknown>)?.['name'];
    if (typeof name !== 'string' && !isHelmExpression(name) && !isHelmConstruct(name)) {
      const actualType = Array.isArray(name) ? 'array' : name === null ? 'null' : typeof name;
      throw new Error(
        `Manifest metadata.name must be a string, HelmExpression, or HelmConstruct. Got ${actualType}`,
      );
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
  // eslint-disable-next-line sonarjs/cognitive-complexity
  public async toSynthArray(): Promise<SynthAsset[]> {
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

    // Optional policy validation BEFORE enrichment to allow policies to control label injection
    if (this.props.policyEngine) {
      this.logger.debug('Starting policy validation before enrichment', {
        chartName: this.meta.name,
        manifestCount: manifestObjs.length,
        operation: 'policy_validation_start',
      });

      try {
        const validationResult = await this.props.policyEngine.validate(manifestObjs, this.meta);

        if (!validationResult.valid) {
          const errorMessage = this.formatPolicyErrors(validationResult);
          this.logger.error('Policy validation failed', {
            chartName: this.meta.name,
            violationCount: validationResult.violations.length,
            operation: 'policy_validation_failed',
          });
          throw new Error(`Policy validation failed: ${errorMessage}`);
        }

        // Log warnings but continue
        if (validationResult.warnings.length > 0) {
          this.logger.warn('Policy validation warnings', {
            chartName: this.meta.name,
            warningCount: validationResult.warnings.length,
            warnings: validationResult.warnings.map((w) => ({
              plugin: w.plugin,
              message: w.message,
              severity: w.severity,
            })),
            operation: 'policy_validation_warnings',
          });
        }

        this.logger.info('Policy validation completed successfully before enrichment', {
          chartName: this.meta.name,
          pluginCount: validationResult.metadata.pluginCount,
          executionTime: validationResult.metadata.executionTime,
          operation: 'policy_validation_success',
        });
      } catch (error) {
        this.logger.error('Policy validation error', {
          chartName: this.meta.name,
          error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE,
          operation: 'policy_validation_error',
        });
        throw error;
      }
    }

    // Enforce common labels best-practice on all rendered objects
    // IMPORTANT: Also pre-process HelmConstructs AFTER Testing.synth serializes the objects
    // This ensures that field-level conditionals are detected and transformed
    // even though cdk8s may have removed the original HelmConstruct structure
    const enriched = manifestObjs.map((obj: unknown) => {
      // First, pre-process HelmConstructs to detect field-level conditionals
      const preprocessed = preprocessHelmConstructs(obj);

      if (preprocessed && typeof preprocessed === 'object') {
        const o = preprocessed as { metadata?: { labels?: Record<string, unknown> } };
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
      return preprocessed;
    });

    const synthAssets: SynthAsset[] = [];

    if (this.props.singleManifestFile) {
      // Combine all resources into single manifest
      const combinedYaml = enriched
        .map((obj) => dumpHelmAwareYaml(obj).trim())
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml, target: 'templates' });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        // eslint-disable-next-line security/detect-object-injection
        const apiObjectId = apiObjectIds[index];
        const manifestId = apiObjectId || `manifest-${index + 1}`;

        const yaml = dumpHelmAwareYaml(obj).trim();
        if (yaml) {
          // Use descriptive name from ApiObject ID if available, otherwise fallback to generic name
          synthAssets.push({ id: manifestId, yaml, target: 'templates' });
        }
      });
    }

    // Add any additional assets (CRDs, etc.)
    this.assets.forEach((asset) => {
      synthAssets.push({
        id: asset.id,
        yaml: asset.yaml,
        target: (asset.target as 'templates' | 'crds') || 'templates',
      });
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
   * Synchronous version of toSynthArray for backward compatibility
   * @returns Array of synthesized assets
   * @deprecated Use toSynthArray() instead for proper async handling
   * @since 2.8.0+
   */
  public toSynthArraySync(): SynthAsset[] {
    // For backward compatibility, we need to handle the case where no policy engine is used
    // In this case, we can run synchronously
    if (this.props.policyEngine) {
      throw new Error(
        'toSynthArraySync() cannot be used with policy engine. Use toSynthArray() instead.',
      );
    }

    const timer = this.logger.time('chart_synthesis_sync');

    this.logger.debug('Starting synchronous chart synthesis', {
      chartName: this.meta.name,
      operation: 'synthesis_start_sync',
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

    this.logger.info('Processing manifest objects synchronously', {
      chartName: this.meta.name,
      manifestCount: manifestObjs.length,
      apiObjectCount: apiObjectIds.length,
      operation: 'manifest_processing_sync',
    });

    // Enforce common labels best-practice on all rendered objects
    const enriched = manifestObjs.map((obj: unknown) => {
      // First, pre-process HelmConstructs to detect field-level conditionals
      const preprocessed = preprocessHelmConstructs(obj);

      if (preprocessed && typeof preprocessed === 'object') {
        const o = preprocessed as { metadata?: { labels?: Record<string, unknown> } };
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
      return preprocessed;
    });

    const synthAssets: SynthAsset[] = [];

    if (this.props.singleManifestFile) {
      // Combine all resources into single manifest
      const combinedYaml = enriched
        .map((obj) => dumpHelmAwareYaml(obj).trim())
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml, target: 'templates' });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        // eslint-disable-next-line security/detect-object-injection
        const apiObjectId = apiObjectIds[index];
        const manifestId = apiObjectId || `manifest-${index + 1}`;

        const yaml = dumpHelmAwareYaml(obj).trim();
        if (yaml) {
          // Use descriptive name from ApiObject ID if available, otherwise fallback to generic name
          synthAssets.push({ id: manifestId, yaml, target: 'templates' });
        }
      });
    }

    // Add any additional assets (CRDs, etc.)
    this.assets.forEach((asset) => {
      synthAssets.push({
        id: asset.id,
        yaml: asset.yaml,
        target: (asset.target as 'templates' | 'crds') || 'templates',
      });
    });

    this.logger.info('Synchronous chart synthesis completed', {
      chartName: this.meta.name,
      totalAssets: synthAssets.length,
      additionalAssets: this.assets.length,
      operation: 'synthesis_complete_sync',
    });

    timer(); // Complete timing measurement
    return synthAssets;
  }

  /**
   * Formats policy validation errors into a readable error message
   * @param result - Policy validation result
   * @returns Formatted error message
   * @private
   */
  private formatPolicyErrors(result: PolicyResult): string {
    const errorMessages: string[] = [];

    if (result.violations && result.violations.length > 0) {
      errorMessages.push(`Found ${result.violations.length} policy violation(s):`);

      result.violations.forEach((violation, index: number) => {
        const parts = [`${index + 1}. [${violation.plugin}] ${violation.message}`];

        if (violation.resourcePath) {
          parts.push(`Resource: ${violation.resourcePath}`);
        }

        if (violation.field) {
          parts.push(`Field: ${violation.field}`);
        }

        if (violation.suggestion) {
          parts.push(`Suggestion: ${violation.suggestion}`);
        }

        errorMessages.push(`   ${parts.join(' | ')}`);
      });
    }

    if (result.summary) {
      const summary = result.summary;
      errorMessages.push(
        `Summary: ${summary.violationsBySeverity.error} error(s), ${summary.violationsBySeverity.warning} warning(s), ${summary.violationsBySeverity.info} info(s)`,
      );
    }

    return errorMessages.join('\n');
  }

  /**
   * Writes the Helm chart to the specified output directory
   * @param outDir - Output directory path
   *
   * @since 1.0.0
   */
  async write(outDir: string): Promise<void> {
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

    const synthAssets = await this.toSynthArray();

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
      logger: this.logger,
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
  /** Optional policy engine for manifest validation */
  policyEngine?: PolicyEngine;
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
