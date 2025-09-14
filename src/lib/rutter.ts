import { ApiObject, App, Chart, Testing } from 'cdk8s';
import type { ChartProps } from 'cdk8s';
import type { Construct } from 'constructs';
import YAML from 'yaml';

import { helm, include } from './helm.js';
import { HelmChartWriter, type SynthAsset } from './helmChartWriter.js';
import { AWSResources } from './resources/cloud/aws/awsResources.js';
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
import { generateHelpersTemplate } from './utils/helmHelpers.js';
import type { HelperDefinition } from './utils/helmHelpers.js';

/**
 * Rutter class with modular architecture
 * Provides a clean API while delegating to specialized resource providers
 * Maintains full backward compatibility with the original Rutter class
 *
 * @since 2.4.0
 */
export class Rutter {
  // Constants for labels
  private static readonly HELPER_NAME = 'chart.name';

  // CDK8s infrastructure
  private readonly app: App;
  private readonly chart: Chart;

  // Resource providers
  private readonly awsResources: AWSResources;
  private readonly karpenterResources: KarpenterResources;

  // Chart metadata and configuration
  private readonly meta: ChartMetadata;
  private readonly defaultValues: Record<string, unknown>;
  private readonly envValues: Record<string, Record<string, unknown>>;
  private readonly props: RutterProps;
  private readonly assets: Array<{ id: string; yaml: string; target: string }> = [];

  constructor(props: RutterProps) {
    this.props = props;
    this.meta = props.meta;
    this.defaultValues = props.defaultValues ?? {};
    this.envValues = props.envValues ?? {};

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
   * @since 1.0.0
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
   * @since 1.0.0
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
   * @since 1.0.0
   */
  addAWSIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec): ApiObject {
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
   * @since 1.0.0
   */
  addAWSALBIngress(spec: AWSALBIngressSpec): ApiObject {
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
   * @since 2.7.0
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
   * @since 2.7.0
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
   * @since 2.7.0
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
   * @since 2.7.1
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
   * @since 2.7.1
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
   * @since 2.7.0
   */
  addAWSECRServiceAccount(spec: AWSECRServiceAccountSpec): ApiObject {
    return this.awsResources.addECRServiceAccount(spec);
  }

  // Utility methods
  /**
   * Adds a Kubernetes manifest to the chart using CDK8S
   *
   * This method allows you to add any Kubernetes manifest (CRDs, custom resources, etc.)
   * either as YAML strings or as objects. The manifest will be processed using CDK8S
   * for better type safety and validation.
   *
   * @param yamlOrObject - Kubernetes manifest as YAML string or object
   * @param id - Unique identifier for the manifest (default: 'manifest')
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
   * `);
   *
   * // Using object for any Kubernetes resource
   * rutter.addManifest({
   *   apiVersion: 'v1',
   *   kind: 'ConfigMap',
   *   metadata: { name: 'my-config' },
   *   data: { key: 'value' }
   * });
   * ```
   *
   * @since 3.0.0
   */
  addManifest(yamlOrObject: string | Record<string, unknown>, id = 'manifest'): ApiObject {
    let manifestObject: Record<string, unknown>;

    if (typeof yamlOrObject === 'string') {
      // Parse YAML string to object
      try {
        manifestObject = YAML.parse(yamlOrObject) as Record<string, unknown>;
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
      data: manifestObject['data'] as Record<string, unknown>,
    });
  }

  /**
   * Validates the structure of a Kubernetes manifest object
   * @param manifest - The manifest object to validate
   * @private
   * @since 3.0.0
   */
  private validateManifestStructure(manifest: Record<string, unknown>): void {
    if (!manifest['apiVersion'] || typeof manifest['apiVersion'] !== 'string') {
      throw new Error('Kubernetes manifest must have a valid apiVersion');
    }

    if (!manifest['kind'] || typeof manifest['kind'] !== 'string') {
      throw new Error('Kubernetes manifest must have a valid kind');
    }

    if (
      !manifest['metadata'] ||
      typeof manifest['metadata'] !== 'object' ||
      manifest['metadata'] === null
    ) {
      throw new Error('Kubernetes manifest must have valid metadata');
    }

    const metadata = manifest['metadata'] as Record<string, unknown>;
    if (!metadata['name'] || typeof metadata['name'] !== 'string') {
      throw new Error('Kubernetes manifest metadata must have a valid name');
    }

    // Additional validation for specific resource types
    const kind = manifest['kind'] as string;
    if (kind === 'CustomResourceDefinition') {
      if (!manifest['spec'] || typeof manifest['spec'] !== 'object' || manifest['spec'] === null) {
        throw new Error('CustomResourceDefinition must have a valid spec');
      }

      const spec = manifest['spec'] as Record<string, unknown>;
      if (!spec['group'] || typeof spec['group'] !== 'string') {
        throw new Error('CustomResourceDefinition spec must have a valid group');
      }

      if (!Array.isArray(spec['versions']) || spec['versions'].length === 0) {
        throw new Error('CustomResourceDefinition must have at least one version in spec.versions');
      }
    }
  }

  /**
   * Gets chart metadata
   * @returns Chart metadata
   *
   * @since 1.0.0
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
   * @since 2.4.0
   */
  private toSynthArray(): SynthAsset[] {
    // Use cdk8s Testing.synth to obtain manifest objects
    const manifestObjs = Testing.synth(this.chart) as unknown[];

    // Enforce common labels best-practice on all rendered objects
    const enriched = manifestObjs.map((obj: unknown) => {
      if (obj && typeof obj === 'object') {
        const o = obj as { metadata?: { labels?: Record<string, unknown> } };
        o.metadata = o.metadata ?? {};
        o.metadata.labels = o.metadata.labels ?? {};
        const labels = o.metadata.labels as Record<string, unknown>;
        const defaults: Record<string, string> = {
          'helm.sh/chart': '{{ .Chart.Name }}-{{ .Chart.Version }}',
          'app.kubernetes.io/name': include(Rutter.HELPER_NAME),
          'app.kubernetes.io/instance': helm.releaseName,
          'app.kubernetes.io/version': helm.chartVersion,
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'app.kubernetes.io/part-of': helm.chartName,
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
        .map((obj) => YAML.stringify(obj).trim())
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        const yaml = YAML.stringify(obj).trim();
        if (yaml) {
          const manifestId = `manifest-${index + 1}`;
          synthAssets.push({ id: manifestId, yaml });
        }
      });
    }

    // Add any additional assets (CRDs, etc.)
    this.assets.forEach((asset) => {
      synthAssets.push({ id: asset.id, yaml: asset.yaml });
    });

    return synthAssets;
  }

  /**
   * Writes the Helm chart to the specified output directory
   * @param outDir - Output directory path
   *
   * @since 1.0.0
   */
  write(outDir: string): void {
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

    HelmChartWriter.write({
      outDir,
      meta: this.meta,
      defaultValues: this.defaultValues,
      envValues: this.envValues,
      assets: this.toSynthArray(),
      helpersTpl: helpersContent,
    });
  }
}

// Type definitions
export interface ChartMetadata {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  home?: string;
  sources?: string[];
  maintainers?: Array<{
    name: string;
    email?: string;
    url?: string;
  }>;
}

export interface RutterProps {
  scope?: Construct;
  meta: ChartMetadata;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  namespace?: string;
  chartProps?: ChartProps;
  /** Custom Helm helpers content or definitions */
  helpersTpl?: string | HelperDefinition[];
  /** Cloud provider for default helpers */
  cloudProvider?: 'aws';
  /** Custom prefix for manifest files */
  manifestPrefix?: string;
  /** Combine all resources into single manifest file */
  singleManifestFile?: boolean;
}

// Re-export types for backward compatibility
export type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/awsResources.js';
