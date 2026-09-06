import type { ApiObject } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';

import { BaseResourceProvider } from '../../baseResourceProvider.js';

/**
 * AWS-specific Kubernetes resources provider
 * Handles AWS integrations like EBS, EFS, ALB, IRSA, and other AWS services
 *
 * @since 2.8.0+
 */
export class AWSResources extends BaseResourceProvider {
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';

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
   * @since 2.8.0+
   */
  addEBSStorageClass(spec: AWSEBSStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      type: spec.volumeType ?? 'gp3',
      ...(spec.encrypted !== undefined ? { encrypted: String(spec.encrypted) } : {}),
      ...(spec.iops ? { iops: String(spec.iops) } : {}),
      ...(spec.throughput ? { throughput: String(spec.throughput) } : {}),
      ...(spec.fsType ? { fsType: spec.fsType } : {}),
    };

    const provisioner = 'ebs.csi.aws.com';
    const fields = {
      provisioner,
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    };

    // Validate EBS-specific provisioner
    this.validateStorageClassProvisioner(provisioner, 'EBS');

    return this.createRootLevelApiObject(
      spec.name,
      AWSResources.STORAGE_API_VERSION,
      'StorageClass',
      fields,
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
   * @since 2.8.0+
   */
  addEFSStorageClass(spec: AWSEFSStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      ...(spec.fileSystemId ? { fileSystemId: spec.fileSystemId } : {}),
      ...(spec.directoryPerms ? { directoryPerms: spec.directoryPerms } : {}),
      ...(spec.gidRangeStart ? { gidRangeStart: String(spec.gidRangeStart) } : {}),
      ...(spec.gidRangeEnd ? { gidRangeEnd: String(spec.gidRangeEnd) } : {}),
      ...(spec.basePath ? { basePath: spec.basePath } : {}),
    };

    const provisioner = 'efs.csi.aws.com';
    const fields = {
      provisioner,
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
    };

    // Validate EFS-specific provisioner
    this.validateStorageClassProvisioner(provisioner, 'EFS');

    return this.createRootLevelApiObject(
      spec.name,
      AWSResources.STORAGE_API_VERSION,
      'StorageClass',
      fields,
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
   * @since 2.8.0+
   */
  addIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec): kplus.ServiceAccount {
    this.validateRoleArn(spec.roleArn);

    const annotations: Record<string, string> = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      ...(spec.annotations ?? {}),
    };

    const serviceAccount = new kplus.ServiceAccount(this.chart, spec.name, {
      metadata: {
        name: spec.name,
        annotations,
        labels: spec.labels ?? {},
      },
      automountToken: spec.automountServiceAccountToken ?? true,
    });

    // Add image pull secrets if specified
    if (spec.imagePullSecrets) {
      spec.imagePullSecrets.forEach((secret) => {
        serviceAccount.addSecret(
          kplus.Secret.fromSecretName(
            this.chart,
            `${spec.name}-secret-${secret.name}`,
            secret.name,
          ),
        );
      });
    }

    return serviceAccount;
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
   * @since 2.8.0+
   */
  addALBIngress(spec: AWSALBIngressSpec): kplus.Ingress {
    // Validate ingress paths format
    this.validateIngressPaths(spec.rules);

    const annotations = this.buildALBAnnotations(spec);

    const ingress = new kplus.Ingress(this.chart, spec.name, {
      metadata: {
        name: spec.name,
        annotations,
        labels: spec.labels ?? {},
      },
      className: spec.ingressClassName ?? 'alb',
    });

    // Add rules to the ingress
    spec.rules.forEach((rule) => {
      rule.paths.forEach((path) => {
        // Create a service reference for the backend - we need to create a Service instance that references the existing service
        const service = new kplus.Service(
          this.chart,
          `${spec.name}-service-ref-${path.backend.service.name}`,
          {
            // This creates a reference to an existing service by name
            // The service should already exist in the cluster
          },
        );

        const backend = kplus.IngressBackend.fromService(service, {
          port:
            path.backend.service.port.number || parseInt(path.backend.service.port.name || '80'),
        });

        ingress.addRule(path.path, backend, path.pathType as kplus.HttpIngressPathType);
      });
    });

    // Add TLS configuration if specified
    if (spec.tls) {
      spec.tls.forEach((tlsConfig) => {
        if (tlsConfig.secretName && tlsConfig.hosts) {
          const secret = kplus.Secret.fromSecretName(
            this.chart,
            `${spec.name}-tls-secret-${tlsConfig.secretName}`,
            tlsConfig.secretName,
          );
          const tlsConfigObj: kplus.IngressTls = {
            hosts: tlsConfig.hosts,
            secret: secret,
          };
          ingress.addTls([tlsConfigObj]);
        }
      });
    }

    return ingress;
  }

  /**
   * Validates Ingress paths format according to Kubernetes specification
   * @param rules - Ingress rules to validate
   * @private
   * @since 2.8.0+
   */
  private validateIngressPaths(
    rules: Array<{
      host?: string;
      paths: Array<{
        path: string;
        pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
        backend: {
          service: { name: string; port: { number?: number; name?: string } };
        };
      }>;
    }>,
  ): void {
    for (const rule of rules) {
      this.validateIngressRule(rule);
    }
  }

  /**
   * Validates a single Ingress rule
   * @param rule - Ingress rule to validate
   * @private
   * @since 2.8.0+
   */
  private validateIngressRule(rule: {
    host?: string;
    paths: Array<{
      path: string;
      pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
      backend: {
        service: { name: string; port: { number?: number; name?: string } };
      };
    }>;
  }): void {
    if (!rule.paths || !Array.isArray(rule.paths)) {
      throw new Error('Ingress rule must have a paths array');
    }

    for (const pathRule of rule.paths) {
      this.validateIngressPath(pathRule);
    }
  }

  /**
   * Validates a single Ingress path
   * @param pathRule - Path rule to validate
   * @private
   * @since 2.8.0+
   */
  private validateIngressPath(pathRule: {
    path: string;
    pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific';
    backend: {
      service: { name: string; port: { number?: number; name?: string } };
    };
  }): void {
    this.validatePathFormat(pathRule.path);
    this.validatePathType(pathRule.pathType);
    this.validateBackend(pathRule.backend);
  }

  /**
   * Validates path format
   * @param path - Path to validate
   * @private
   * @since 2.5.0
   */
  private validatePathFormat(path: string): void {
    if (!path || typeof path !== 'string') {
      throw new Error('Ingress path must be a non-empty string');
    }

    // Normalize path and check for traversal attempts
    const normalizedPath = path.replace(/\/+/g, '/');
    if (!normalizedPath.startsWith('/')) {
      throw new Error(`Ingress path "${path}" must start with /`);
    }

    // For Kubernetes Ingress paths, we allow URL patterns but warn about suspicious ones
    if (normalizedPath.includes('../') || normalizedPath.includes('./')) {
      // Note: These could be valid URL patterns in some cases, but are suspicious
      // Sanitize path for logging to prevent log injection
      const sanitizedPath = path.replace(/[\r\n]/g, '');
      console.warn(
        `Warning: Ingress path "${sanitizedPath}" contains path traversal-like sequences`,
      );
    }
  }

  /**
   * Validates path type
   * @param pathType - Path type to validate
   * @private
   * @since 2.5.0
   */
  private validatePathType(pathType: string): void {
    const validPathTypes = ['Exact', 'Prefix', 'ImplementationSpecific'];
    if (!validPathTypes.includes(pathType)) {
      throw new Error(
        `Invalid pathType "${pathType}". Must be one of: ${validPathTypes.join(', ')}`,
      );
    }
  }

  /**
   * Validates backend configuration
   * @param backend - Backend to validate
   * @private
   * @since 2.5.0
   */
  private validateBackend(backend: {
    service: { name: string; port: { number?: number; name?: string } };
  }): void {
    if (!backend?.service?.name) {
      throw new Error('Ingress path backend must specify service name');
    }

    const port = backend.service.port;
    if (!port || (!port.number && !port.name)) {
      throw new Error('Ingress path backend service must specify either port number or name');
    }

    if (
      port.number &&
      (typeof port.number !== 'number' || port.number < 1 || port.number > 65535)
    ) {
      throw new Error(`Invalid port number ${port.number}. Must be between 1 and 65535`);
    }
  }

  /**
   * Validates StorageClass provisioner is present and valid
   * @param provisioner - Provisioner string to validate
   * @param storageType - Type of storage (for error messages)
   * @private
   * @since 2.5.0
   */
  private validateStorageClassProvisioner(provisioner: string, storageType: string): void {
    if (!provisioner || typeof provisioner !== 'string' || provisioner.trim() === '') {
      throw new Error(`${storageType} StorageClass must have a valid provisioner`);
    }

    const validProvisioners = {
      EBS: 'ebs.csi.aws.com',
      EFS: 'efs.csi.aws.com',
    };

    // Validate provisioner matches storage type
    const expectedProvisioner = validProvisioners[storageType as keyof typeof validProvisioners];
    if (!expectedProvisioner) {
      throw new Error(`Invalid storage type: ${storageType}`);
    }

    if (provisioner !== expectedProvisioner) {
      throw new Error(
        `Invalid AWS ${storageType} provisioner "${provisioner}". Must be: ${expectedProvisioner}`,
      );
    }
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
      // Remove deprecated kubernetes.io/ingress.class annotation
      // Use spec.ingressClassName instead
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

  /**
   * Creates a ServiceAccount with ECR access annotations
   * @param spec - ECR ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * awsResources.addECRServiceAccount({
   *   name: 'ecr-service-account',
   *   roleArn: 'arn:aws:iam::123456789012:role/ECRAccessRole'
   * });
   * ```
   *
   * @since 2.8.0+
   */
  addECRServiceAccount(spec: AWSECRServiceAccountSpec): kplus.ServiceAccount {
    const annotations = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      ...(spec.annotations || {}),
    };

    const serviceAccount = new kplus.ServiceAccount(this.chart, spec.name, {
      metadata: {
        name: spec.name,
        annotations,
        labels: spec.labels ?? {},
      },
      automountToken: spec.automountServiceAccountToken ?? true,
    });

    // Add image pull secrets if specified
    if (spec.imagePullSecrets) {
      spec.imagePullSecrets.forEach((secret) => {
        serviceAccount.addSecret(
          kplus.Secret.fromSecretName(
            this.chart,
            `${spec.name}-ecr-secret-${secret.name}`,
            secret.name,
          ),
        );
      });
    }

    return serviceAccount;
  }
}

// Type definitions
/** Configuration for an AWS EBS CSI StorageClass. */
export interface AWSEBSStorageClassSpec {
  /** Kubernetes StorageClass name. */
  name: string;
  /** EBS volume type. Defaults to `gp3`. */
  volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
  /** Whether dynamically provisioned volumes should be encrypted. */
  encrypted?: boolean;
  /** Requested IOPS for volume types that support explicit IOPS. */
  iops?: number;
  /** Requested throughput in MiB/s for volume types that support it. */
  throughput?: number;
  /** Filesystem type passed to the CSI provisioner. */
  fsType?: string;
  /** Kubernetes reclaim policy. */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** Whether PVCs may expand the provisioned volume. */
  allowVolumeExpansion?: boolean;
  /** StorageClass volume binding mode. */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** Optional Kubernetes labels. */
  labels?: Record<string, string>;
  /** Optional Kubernetes annotations. */
  annotations?: Record<string, string>;
}

/** Configuration for an AWS EFS CSI StorageClass. */
export interface AWSEFSStorageClassSpec {
  /** Kubernetes StorageClass name. */
  name: string;
  /** EFS filesystem identifier used by the CSI provisioner. */
  fileSystemId?: string;
  /** Permissions applied to dynamically created access-point directories. */
  directoryPerms?: string;
  /** Start of the POSIX group ID allocation range. */
  gidRangeStart?: number;
  /** End of the POSIX group ID allocation range. */
  gidRangeEnd?: number;
  /** Base path for dynamically provisioned directories. */
  basePath?: string;
  /** Kubernetes reclaim policy. */
  reclaimPolicy?: 'Delete' | 'Retain';
  /** StorageClass volume binding mode. */
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  /** Optional Kubernetes labels. */
  labels?: Record<string, string>;
  /** Optional Kubernetes annotations. */
  annotations?: Record<string, string>;
}

/** Configuration for an IRSA-enabled cdk8s-plus ServiceAccount. */
export interface AWSIRSAServiceAccountSpec {
  /** Kubernetes ServiceAccount name. */
  name: string;
  /** IAM role ARN written to the IRSA annotation. */
  roleArn: string;
  /** Whether Kubernetes should automount the service-account token. */
  automountServiceAccountToken?: boolean;
  /** Existing image pull secrets referenced by name. */
  imagePullSecrets?: Array<{ name: string }>;
  /** Optional Kubernetes labels. */
  labels?: Record<string, string>;
  /** Additional annotations merged with the IRSA role annotation. */
  annotations?: Record<string, string>;
}

/** Configuration for an ECR-oriented IRSA ServiceAccount. */
export interface AWSECRServiceAccountSpec {
  /** Kubernetes ServiceAccount name. */
  name: string;
  /** IAM role ARN written to the IRSA annotation. */
  roleArn: string;
  /** Whether Kubernetes should automount the service-account token. */
  automountServiceAccountToken?: boolean;
  /** Existing image pull secrets referenced by name. */
  imagePullSecrets?: Array<{ name: string }>;
  /** Optional Kubernetes labels. */
  labels?: Record<string, string>;
  /** Additional Kubernetes annotations. */
  annotations?: Record<string, string>;
}

/** Configuration for an AWS Load Balancer Controller-backed Ingress. */
export interface AWSALBIngressSpec {
  /** Kubernetes Ingress name. */
  name: string;
  /** Host/path routing rules added to the Ingress. */
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
  /** Optional TLS secret references and host lists. */
  tls?: Array<{
    hosts?: string[];
    secretName?: string;
  }>;
  /** ALB exposure scheme. */
  scheme?: 'internet-facing' | 'internal';
  /** ALB target registration mode. */
  targetType?: 'ip' | 'instance';
  /** ACM certificate ARN added to the controller annotations. */
  certificateArn?: string;
  /** Whether to request HTTP-to-HTTPS redirection on port 443. */
  sslRedirect?: boolean;
  /** ALB health check path. */
  healthCheckPath?: string;
  /** Kubernetes IngressClass name. Defaults to `alb`. */
  ingressClassName?: string;
  /** Optional Kubernetes labels. */
  labels?: Record<string, string>;
  /** Additional controller or Kubernetes annotations. */
  annotations?: Record<string, string>;
}
