import { ApiObject, App, Chart, JsonPatch, Testing } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Ingress, ServiceAccount } from 'cdk8s-plus-33';
import type { Construct } from 'constructs';

import { include } from './helm.js';
import {
  HelmChartWriter,
  type ChartFileAsset,
  type HelmChartMeta,
  type SynthAsset,
} from './helmChartWriter.js';
import { AWSResources } from './resources/cloud/aws/awsResources.js';
import { createLogger, type TimonelLogger } from './utils/logger.js';
import {
  isHelmCondition,
  serializeHelmValue,
  type HelmCondition,
  type HelmValueRef,
} from './utils/valuesRef.js';
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
  private readonly chartFiles: ChartFileAsset[];
  private readonly awsResources: AWSResources;
  private readonly chart: Chart;
  private readonly defaultValues: Record<string, unknown>;
  private readonly envValues: Record<string, Record<string, unknown>>;
  private readonly karpenterResources: KarpenterResources;
  private readonly meta: ChartMetadata;
  private readonly props: RutterProps;
  private readonly logger: TimonelLogger;
  private readonly resourceConditions = new Map<string, string>();

  constructor(props: RutterProps) {
    this.defaultValues = props.defaultValues ?? {};
    this.envValues = props.envValues ?? {};
    this.chartFiles = [...(props.chartFiles ?? [])];
    this.meta = props.meta;
    this.props = props;
    this.logger = props.logger ?? createLogger('rutter');

    this.logger.info('Initializing chart', {
      chartName: props.meta.name,
      version: props.meta.version,
      namespace: props.namespace,
      operation: 'chart_initialization',
    });

    // Compose with a caller-owned construct tree when one is supplied. Otherwise
    // Timonel owns an internal App solely as the root for this chart.
    const scope = props.scope ?? new App();
    this.chart = new Chart(scope, props.meta.name, {
      ...props.chartProps,
      ...(props.namespace ? { namespace: props.namespace } : {}),
    });

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
   * @returns Created cdk8s-plus ServiceAccount
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
   * @returns Created cdk8s-plus Ingress
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
   * @returns Created cdk8s-plus ServiceAccount
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

  /**
   * Returns stable identifiers and construct paths for synthesized ApiObjects, including
   * those nested inside cdk8s-plus resources.
   */
  private getSynthesizedApiObjectDescriptors(): Array<{ id: string; path: string }> {
    return this.chart.node
      .findAll()
      .filter(
        (construct): construct is ApiObject =>
          construct instanceof ApiObject && !construct.node.id.endsWith('-placeholder'),
      )
      .map((apiObject) => {
        const owner = apiObject.node.scope;
        const id =
          apiObject.node.id === 'Resource' && owner && owner !== this.chart
            ? owner.node.id
            : apiObject.node.id;
        return { id, path: apiObject.node.path };
      });
  }

  /**
   * Returns the underlying cdk8s Chart so consumers can attach fully typed
   * cdk8s/cdk8s-plus constructs directly to Timonel's synthesis tree.
   *
   * @returns The cdk8s Chart owned by this Rutter instance
   */
  getChart(): Chart {
    return this.chart;
  }

  /**
   * Replaces a synthesized scalar field on a typed cdk8s/cdk8s-plus construct with a ValuesRef.
   *
   * @param resource Typed construct containing an ApiObject.
   * @param jsonPointer RFC 6901 JSON pointer to the scalar field to replace.
   * @param value Typed Helm value reference rendered into the target field.
   */
  bindHelmValue<T>(resource: Construct, jsonPointer: string, value: HelmValueRef<T>): void {
    if (!jsonPointer.startsWith('/')) {
      throw new Error('Helm value binding path must be an absolute JSON pointer');
    }

    const apiObject = ApiObject.of(resource);
    if (apiObject.chart !== this.chart) {
      throw new Error('Helm value binding resource must belong to this Rutter chart');
    }

    apiObject.addJsonPatch(JsonPatch.add(jsonPointer, serializeHelmValue(value)));
  }

  /**
   * Conditionally renders a complete typed cdk8s/cdk8s-plus resource with Helm.
   *
   * @param condition ValuesRef boolean reference or composed Helm condition.
   * @param resource Typed construct containing the ApiObject to gate.
   */
  when(condition: HelmValueRef<boolean> | HelmCondition, resource: Construct): void {
    const apiObject = ApiObject.of(resource);
    if (apiObject.chart !== this.chart) {
      throw new Error('Conditional resource must belong to this Rutter chart');
    }

    const expression = isHelmCondition(condition) ? condition.__condition : condition.__path;
    this.resourceConditions.set(apiObject.node.path, expression);
  }

  /** Apply a registered whole-resource condition to synthesized YAML. */
  private applyResourceCondition(yaml: string, descriptor?: { path: string }): string {
    if (!descriptor) return yaml;
    const condition = this.resourceConditions.get(descriptor.path);
    if (!condition) return yaml;
    return `{{- if ${condition} }}\n${yaml}\n{{- end }}`;
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
   * Adds an arbitrary non-manifest file to the generated Helm chart.
   *
   * The destination is chart-relative and is validated by `HelmChartWriter`
   * during `write()`. Existing generated files cannot be overwritten.
   */
  addChartFile(asset: ChartFileAsset): void {
    this.chartFiles.push(asset);
  }

  /** Return the chart-file assets configured for this chart. */
  getChartFiles(): readonly ChartFileAsset[] {
    return [...this.chartFiles];
  }

  /**
   * Converts the chart to SynthAsset array for HelmChartWriter
   * @returns Array of synthesized assets
   *
   * @since 2.8.0+
   */
  public async toSynthArray(): Promise<SynthAsset[]> {
    const timer = this.logger.time('chart_synthesis');

    this.logger.debug('Starting chart synthesis', {
      chartName: this.meta.name,
      operation: 'synthesis_start',
    });

    // Get ApiObject IDs before synthesis, including ApiObjects nested inside
    // cdk8s-plus constructs while excluding compatibility placeholders.
    const apiObjectDescriptors = this.getSynthesizedApiObjectDescriptors();

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
      apiObjectCount: apiObjectDescriptors.length,
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
        .map((obj, index) => {
          // eslint-disable-next-line security/detect-object-injection -- index aligns synthesized objects with construct descriptors
          const descriptor = apiObjectDescriptors[index];
          return this.applyResourceCondition(dumpHelmAwareYaml(obj).trim(), descriptor);
        })
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml, target: 'templates' });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        // eslint-disable-next-line security/detect-object-injection -- index aligns synthesized objects with construct descriptors
        const descriptor = apiObjectDescriptors[index];
        const manifestId = descriptor?.id || `manifest-${index + 1}`;

        const yaml = this.applyResourceCondition(dumpHelmAwareYaml(obj).trim(), descriptor);
        if (yaml) {
          // Use descriptive name from ApiObject ID if available, otherwise fallback to generic name
          synthAssets.push({ id: manifestId, yaml, target: 'templates' });
        }
      });
    }

    this.logger.info('Chart synthesis completed', {
      chartName: this.meta.name,
      totalAssets: synthAssets.length,
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

    // Get ApiObject IDs before synthesis, including ApiObjects nested inside
    // cdk8s-plus constructs while excluding compatibility placeholders.
    const apiObjectDescriptors = this.getSynthesizedApiObjectDescriptors();

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
      apiObjectCount: apiObjectDescriptors.length,
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
        .map((obj, index) => {
          // eslint-disable-next-line security/detect-object-injection -- index aligns synthesized objects with construct descriptors
          const descriptor = apiObjectDescriptors[index];
          return this.applyResourceCondition(dumpHelmAwareYaml(obj).trim(), descriptor);
        })
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml, target: 'templates' });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        // eslint-disable-next-line security/detect-object-injection -- index aligns synthesized objects with construct descriptors
        const descriptor = apiObjectDescriptors[index];
        const manifestId = descriptor?.id || `manifest-${index + 1}`;

        const yaml = this.applyResourceCondition(dumpHelmAwareYaml(obj).trim(), descriptor);
        if (yaml) {
          // Use descriptive name from ApiObject ID if available, otherwise fallback to generic name
          synthAssets.push({ id: manifestId, yaml, target: 'templates' });
        }
      });
    }

    this.logger.info('Synchronous chart synthesis completed', {
      chartName: this.meta.name,
      totalAssets: synthAssets.length,
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
      chartFiles: this.chartFiles,
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
/**
 * Helm chart metadata accepted by `Rutter`.
 *
 * Rutter deliberately shares the `HelmChartWriter` metadata contract so charts
 * keep the same `Chart.yaml` surface regardless of which high-level API writes them.
 */
export type ChartMetadata = HelmChartMeta;

/**
 * Configuration for a `Rutter` chart.
 */
export interface RutterProps {
  /** Additional cdk8s Chart properties applied to the generated chart. */
  chartProps?: ChartProps;
  /** Arbitrary non-manifest files packaged at chart-relative destinations. */
  chartFiles?: readonly ChartFileAsset[];
  /** Cloud provider for default helpers. */
  cloudProvider?: 'aws';
  /** Default values emitted to `values.yaml`. */
  defaultValues?: Record<string, unknown>;
  /** Environment-specific values emitted to `values-<environment>.yaml`. */
  envValues?: Record<string, Record<string, unknown>>;
  /** Custom Helm helpers content or definitions. */
  helpersTpl?: string | HelperDefinition[];
  /** Custom prefix for manifest files. */
  manifestPrefix?: string;
  /** Required Helm chart metadata. */
  meta: ChartMetadata;
  /** Optional default namespace for the underlying cdk8s Chart. */
  namespace?: string;
  /** Optional policy engine for manifest validation. */
  policyEngine?: PolicyEngine;
  /** Optional caller-owned construct scope used as the parent of Timonel's cdk8s Chart. */
  scope?: Construct;
  /** Combine all resources into a single manifest file. */
  singleManifestFile?: boolean;
  /**
   * Custom logger instance.
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
