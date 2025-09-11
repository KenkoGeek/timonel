import { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../BaseResourceProvider.js';

/**
 * AWS-specific Kubernetes resources provider
 * Handles AWS integrations like EBS, EFS, ALB, IRSA, and other AWS services
 *
 * @since 2.4.0
 */
export class AWSResources extends BaseResourceProvider {
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';
  private static readonly CORE_API_VERSION = 'v1';
  private static readonly NETWORKING_API_VERSION = 'networking.k8s.io/v1';

  /**
   * Creates an AWS EBS StorageClass
   * @param spec - EBS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * awsResources.addEBSStorageClass({
   *   name: 'fast-ebs',
   *   volumeType: 'gp3',
   *   encrypted: true,
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addEBSStorageClass(spec: AWSEBSStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      type: spec.volumeType ?? 'gp3',
      ...(spec.encrypted !== undefined ? { encrypted: String(spec.encrypted) } : {}),
      ...(spec.iops ? { iops: String(spec.iops) } : {}),
      ...(spec.throughput ? { throughput: String(spec.throughput) } : {}),
      ...(spec.fsType ? { fsType: spec.fsType } : {}),
    };

    const storageClassSpec = {
      provisioner: 'ebs.csi.aws.com',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    };

    return this.createApiObject(
      spec.name,
      AWSResources.STORAGE_API_VERSION,
      'StorageClass',
      storageClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates an AWS EFS StorageClass
   * @param spec - EFS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * awsResources.addEFSStorageClass({
   *   name: 'efs-storage',
   *   fileSystemId: 'fs-12345678',
   *   directoryPerms: '0755'
   * });
   * ```
   *
   * @since 2.4.0
   */
  addEFSStorageClass(spec: AWSEFSStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      ...(spec.fileSystemId ? { fileSystemId: spec.fileSystemId } : {}),
      ...(spec.directoryPerms ? { directoryPerms: spec.directoryPerms } : {}),
      ...(spec.gidRangeStart ? { gidRangeStart: String(spec.gidRangeStart) } : {}),
      ...(spec.gidRangeEnd ? { gidRangeEnd: String(spec.gidRangeEnd) } : {}),
      ...(spec.basePath ? { basePath: spec.basePath } : {}),
    };

    const storageClassSpec = {
      provisioner: 'efs.csi.aws.com',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
    };

    return this.createApiObject(
      spec.name,
      AWSResources.STORAGE_API_VERSION,
      'StorageClass',
      storageClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates an AWS IRSA (IAM Roles for Service Accounts) ServiceAccount
   * @param spec - IRSA ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * awsResources.addIRSAServiceAccount({
   *   name: 'aws-service-account',
   *   roleArn: 'arn:aws:iam::123456789012:role/MyRole'
   * });
   * ```
   *
   * @since 2.4.0
   */
  addIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec): ApiObject {
    this.validateRoleArn(spec.roleArn);

    const annotations: Record<string, string> = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      ...(spec.annotations ?? {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: AWSResources.CORE_API_VERSION,
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        annotations,
        ...(spec.labels ? { labels: spec.labels } : {}),
      },
      ...(spec.automountServiceAccountToken !== undefined
        ? { automountServiceAccountToken: spec.automountServiceAccountToken }
        : {}),
      ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
    });
  }

  /**
   * Creates an AWS ALB Ingress
   * @param spec - ALB Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @example
   * ```typescript
   * awsResources.addALBIngress({
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
  addALBIngress(spec: AWSALBIngressSpec): ApiObject {
    const annotations = this.buildALBAnnotations(spec);

    const ingressSpec = {
      ...(spec.ingressClassName ? { ingressClassName: spec.ingressClassName } : {}),
      rules: spec.rules,
      ...(spec.tls ? { tls: spec.tls } : {}),
    };

    return this.createApiObject(
      spec.name,
      AWSResources.NETWORKING_API_VERSION,
      'Ingress',
      ingressSpec,
      spec.labels,
      annotations,
    );
  }

  /**
   * Validates AWS IAM Role ARN format
   * @param roleArn - Role ARN to validate
   */
  private validateRoleArn(roleArn: string): void {
    // Skip validation for Helm template values
    if (roleArn.includes('{{') && roleArn.includes('}}')) {
      return;
    }

    const arnRegex = /^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/;
    if (!arnRegex.test(roleArn)) {
      throw new Error(`Invalid AWS IAM Role ARN format: ${roleArn}`);
    }
  }

  /**
   * Builds ALB-specific annotations
   * @param spec - ALB Ingress specification
   * @returns ALB annotations
   */
  private buildALBAnnotations(spec: AWSALBIngressSpec): Record<string, string> {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'alb',
      ...(spec.annotations ?? {}),
    };

    if (spec.scheme) {
      annotations['alb.ingress.kubernetes.io/scheme'] = spec.scheme;
    }

    if (spec.targetType) {
      annotations['alb.ingress.kubernetes.io/target-type'] = spec.targetType;
    }

    if (spec.certificateArn) {
      annotations['alb.ingress.kubernetes.io/certificate-arn'] = spec.certificateArn;
    }

    if (spec.sslRedirect) {
      annotations['alb.ingress.kubernetes.io/ssl-redirect'] = '443';
    }

    if (spec.healthCheckPath) {
      annotations['alb.ingress.kubernetes.io/healthcheck-path'] = spec.healthCheckPath;
    }

    return annotations;
  }
}

// Type definitions
export interface AWSEBSStorageClassSpec {
  name: string;
  volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
  encrypted?: boolean;
  iops?: number;
  throughput?: number;
  fsType?: string;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSEFSStorageClassSpec {
  name: string;
  fileSystemId?: string;
  directoryPerms?: string;
  gidRangeStart?: number;
  gidRangeEnd?: number;
  basePath?: string;
  reclaimPolicy?: 'Delete' | 'Retain';
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSIRSAServiceAccountSpec {
  name: string;
  roleArn: string;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: Array<{ name: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AWSALBIngressSpec {
  name: string;
  rules: Array<{
    host?: string;
    paths: Array<{
      path: string;
      pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
      backend: {
        service: { name: string; port: { number?: number; name?: string } };
      };
    }>;
  }>;
  tls?: Array<{
    hosts?: string[];
    secretName?: string;
  }>;
  scheme?: 'internet-facing' | 'internal';
  targetType?: 'ip' | 'instance';
  certificateArn?: string;
  sslRedirect?: boolean;
  healthCheckPath?: string;
  ingressClassName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}
