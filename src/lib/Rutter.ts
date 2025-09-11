import type { ChartProps } from 'cdk8s';
import { Chart, App, Testing } from 'cdk8s';
import type { Construct } from 'constructs';
import type { ApiObject } from 'cdk8s';
import YAML from 'yaml';

// Import resource providers
import { CoreResources } from './resources/core/CoreResources.js';
import { StorageResources } from './resources/core/StorageResources.js';
import { AWSResources } from './resources/cloud/aws/AWSResources.js';
// Import type definitions from providers
import type {
  DeploymentSpec,
  DaemonSetSpec,
  StatefulSetSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './resources/core/CoreResources.js';
import type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './resources/core/StorageResources.js';
import type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/AWSResources.js';
// Import HelmChartWriter for write functionality
import { HelmChartWriter, type SynthAsset } from './helmChartWriter.js';
import { include, helm } from './helm.js';

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
  private readonly coreResources: CoreResources;
  private readonly storageResources: StorageResources;
  private readonly awsResources: AWSResources;

  // Chart metadata and configuration
  private readonly meta: ChartMetadata;
  private readonly defaultValues: Record<string, unknown>;
  private readonly envValues: Record<string, Record<string, unknown>>;
  private readonly assets: Array<{ id: string; yaml: string; target: string }> = [];

  constructor(props: RutterProps) {
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
    this.coreResources = new CoreResources(this.chart);
    this.storageResources = new StorageResources(this.chart);
    this.awsResources = new AWSResources(this.chart);
  }

  // Core Kubernetes Resources

  /**
   * Creates a Deployment resource
   * @param spec - Deployment specification
   * @returns Created Deployment ApiObject
   *
   * @example
   * ```typescript
   * rutter.addDeployment({
   *   name: 'web-app',
   *   image: 'nginx:1.21',
   *   replicas: 3,
   *   containerPort: 80
   * });
   * ```
   *
   * @since 1.0.0
   */
  addDeployment(spec: DeploymentSpec): ApiObject {
    return this.coreResources.addDeployment(spec);
  }

  /**
   * Creates a DaemonSet resource
   * @param spec - DaemonSet specification
   * @returns Created DaemonSet ApiObject
   *
   * @example
   * ```typescript
   * rutter.addDaemonSet({
   *   name: 'log-collector',
   *   image: 'fluentd:v1.14',
   *   containerPort: 24224,
   *   hostNetwork: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addDaemonSet(spec: DaemonSetSpec): ApiObject {
    return this.coreResources.addDaemonSet(spec);
  }

  /**
   * Creates a StatefulSet resource
   * @param spec - StatefulSet specification
   * @returns Created StatefulSet ApiObject
   *
   * @example
   * ```typescript
   * rutter.addStatefulSet({
   *   name: 'database',
   *   image: 'postgres:13',
   *   replicas: 3,
   *   serviceName: 'database-headless',
   *   containerPort: 5432
   * });
   * ```
   *
   * @since 2.4.0
   */
  addStatefulSet(spec: StatefulSetSpec): ApiObject {
    return this.coreResources.addStatefulSet(spec);
  }

  /**
   * Creates a Service resource
   * @param spec - Service specification
   * @returns Created Service ApiObject
   *
   * @example
   * ```typescript
   * rutter.addService({
   *   name: 'web-service',
   *   port: 80,
   *   targetPort: 8080,
   *   type: 'ClusterIP'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addService(spec: ServiceSpec): ApiObject {
    return this.coreResources.addService(spec);
  }

  /**
   * Creates a ConfigMap resource
   * @param spec - ConfigMap specification
   * @returns Created ConfigMap ApiObject
   *
   * @example
   * ```typescript
   * rutter.addConfigMap({
   *   name: 'app-config',
   *   data: {
   *     'config.yaml': 'key: value',
   *     'app.properties': 'debug=true'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addConfigMap(spec: ConfigMapSpec): ApiObject {
    return this.coreResources.addConfigMap(spec);
  }

  /**
   * Creates a Secret resource
   * @param spec - Secret specification
   * @returns Created Secret ApiObject
   *
   * @example
   * ```typescript
   * rutter.addSecret({
   *   name: 'app-secrets',
   *   type: 'Opaque',
   *   data: {
   *     username: 'YWRtaW4=',
   *     password: 'MWYyZDFlMmU2N2Rm'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addSecret(spec: SecretSpec): ApiObject {
    return this.coreResources.addSecret(spec);
  }

  /**
   * Creates a ServiceAccount resource
   * @param spec - ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addServiceAccount({
   *   name: 'app-service-account',
   *   automountServiceAccountToken: false
   * });
   * ```
   *
   * @since 1.0.0
   */
  addServiceAccount(spec: ServiceAccountSpec): ApiObject {
    return this.coreResources.addServiceAccount(spec);
  }

  // Storage Resources

  /**
   * Creates a PersistentVolume resource
   * @param spec - PersistentVolume specification
   * @returns Created PersistentVolume ApiObject
   *
   * @example
   * ```typescript
   * rutter.addPersistentVolume({
   *   name: 'data-pv',
   *   capacity: '10Gi',
   *   accessModes: ['ReadWriteOnce'],
   *   storageClassName: 'fast-ssd'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addPersistentVolume(spec: PersistentVolumeSpec): ApiObject {
    return this.storageResources.addPersistentVolume(spec);
  }

  /**
   * Creates a PersistentVolumeClaim resource
   * @param spec - PersistentVolumeClaim specification
   * @returns Created PersistentVolumeClaim ApiObject
   *
   * @example
   * ```typescript
   * rutter.addPersistentVolumeClaim({
   *   name: 'data-pvc',
   *   size: '10Gi',
   *   accessModes: ['ReadWriteOnce'],
   *   storageClassName: 'fast-ssd'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addPersistentVolumeClaim(spec: PersistentVolumeClaimSpec): ApiObject {
    return this.storageResources.addPersistentVolumeClaim(spec);
  }

  /**
   * Creates a StorageClass resource
   * @param spec - StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addStorageClass({
   *   name: 'fast-ssd',
   *   provisioner: 'kubernetes.io/aws-ebs',
   *   parameters: {
   *     type: 'gp3',
   *     encrypted: 'true'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addStorageClass(spec: StorageClassSpec): ApiObject {
    return this.storageResources.addStorageClass(spec);
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
   *   name: 'aws-service-account',
   *   roleArn: 'arn:aws:iam::123456789012:role/MyRole'
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

  // Utility methods

  /**
   * Adds a custom resource definition (CRD) YAML
   * @param yaml - CRD YAML content
   * @param id - Unique identifier for the CRD
   *
   * @since 1.0.0
   */
  addCrd(yaml: string, id = 'crd'): void {
    this.assets.push({ id, yaml, target: 'crds' });
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
        for (const [k, v] of Object.entries(defaults)) {
          if (!(k in labels)) {
            // eslint-disable-next-line security/detect-object-injection -- Safe: controlled label assignment
            labels[k] = v;
          }
        }
      }
      return obj;
    });

    // Convert to SynthAsset format
    const synthAssets: SynthAsset[] = [];

    // Add main manifests
    if (enriched.length > 0) {
      const combinedYaml = enriched
        .map((obj) => YAML.stringify(obj).trim())
        .filter(Boolean)
        .join('\n---\n');

      synthAssets.push({
        id: 'manifests',
        yaml: combinedYaml,
      });
    }

    // Add custom assets (CRDs, etc.)
    for (const asset of this.assets) {
      synthAssets.push({
        id: asset.id,
        yaml: asset.yaml,
        target: asset.target as 'templates' | 'crds',
      });
    }

    return synthAssets;
  }

  /**
   * Writes the Helm chart to the specified output directory
   * @param outDir - Output directory path
   *
   * @since 1.0.0
   */
  write(outDir: string): void {
    HelmChartWriter.write({
      outDir,
      meta: this.meta,
      defaultValues: this.defaultValues,
      envValues: this.envValues,
      assets: this.toSynthArray(),
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
}

// Re-export types for backward compatibility
export type {
  DeploymentSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './resources/core/CoreResources.js';

export type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './resources/core/StorageResources.js';

export type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/AWSResources.js';
