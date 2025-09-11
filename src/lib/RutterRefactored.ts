import type { ChartProps } from 'cdk8s';
import { Chart } from 'cdk8s';
import { Construct } from 'constructs';
import type { ApiObject } from 'cdk8s';

// Import resource providers
import type {
  DeploymentSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './resources/core/CoreResources.js';
import { CoreResources } from './resources/core/CoreResources.js';
import type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './resources/core/StorageResources.js';
import { StorageResources } from './resources/core/StorageResources.js';
import type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/AWSResources.js';
import { AWSResources } from './resources/cloud/aws/AWSResources.js';

/**
 * Refactored Rutter class with modular architecture
 * Provides a clean API while delegating to specialized resource providers
 *
 * @since 2.4.0
 */
export class RutterRefactored extends Chart {
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
    super(props.scope ?? new Construct(undefined!, 'root'), props.meta.name, {
      ...props.chartProps,
      ...(props.namespace ? { namespace: props.namespace } : {}),
    });

    this.meta = props.meta;
    this.defaultValues = props.defaultValues ?? {};
    this.envValues = props.envValues ?? {};

    // Initialize resource providers
    this.coreResources = new CoreResources(this);
    this.storageResources = new StorageResources(this);
    this.awsResources = new AWSResources(this);
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
   * @since 2.4.0
   */
  addDeployment(spec: DeploymentSpec): ApiObject {
    return this.coreResources.addDeployment(spec);
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
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
   * @since 2.4.0
   */
  addCrd(yaml: string, id = 'crd'): void {
    this.assets.push({ id, yaml, target: 'crds' });
  }

  /**
   * Gets chart metadata
   * @returns Chart metadata
   *
   * @since 2.4.0
   */
  getMeta(): ChartMetadata {
    return { ...this.meta };
  }

  /**
   * Gets default values
   * @returns Default values object
   *
   * @since 2.4.0
   */
  getDefaultValues(): Record<string, unknown> {
    return { ...this.defaultValues };
  }

  /**
   * Gets environment-specific values
   * @returns Environment values object
   *
   * @since 2.4.0
   */
  getEnvValues(): Record<string, Record<string, unknown>> {
    return { ...this.envValues };
  }

  /**
   * Gets all assets (CRDs, etc.)
   * @returns Array of assets
   *
   * @since 2.4.0
   */
  getAssets(): Array<{ id: string; yaml: string; target: string }> {
    return [...this.assets];
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
