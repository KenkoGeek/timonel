import { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../baseResourceProvider.js';

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
    // Validate ingress paths format
    this.validateIngressPaths(spec.rules);

    const annotations = this.buildALBAnnotations(spec);

    // Transform rules to correct networking.k8s.io/v1 format with http wrapper
    const transformedRules = spec.rules.map((rule) => ({
      ...(rule.host ? { host: rule.host } : {}),
      http: {
        paths: rule.paths,
      },
    }));

    const ingressSpec = {
      // Use ingressClassName instead of deprecated annotation
      ingressClassName: spec.ingressClassName ?? 'alb',
      rules: transformedRules,
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
   * Validates Ingress paths format according to Kubernetes specification
   * @param rules - Ingress rules to validate
   * @private
   * @since 2.5.0
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
   * @since 2.5.0
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
   * @since 2.5.0
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
      console.warn(`Warning: Ingress path "${path}" contains path traversal-like sequences`);
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

    this.validateAwsArn(roleArn, 'IAM Role');
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
   * @since 2.7.0
   */
  addECRServiceAccount(spec: AWSECRServiceAccountSpec): ApiObject {
    this.validateRoleArn(spec.roleArn);

    const annotations = {
      'eks.amazonaws.com/role-arn': spec.roleArn,
      ...(spec.annotations || {}),
    };

    const serviceAccountSpec: Record<string, unknown> = {};

    if (spec.automountServiceAccountToken !== undefined) {
      serviceAccountSpec['automountServiceAccountToken'] = spec.automountServiceAccountToken;
    }

    if (spec.imagePullSecrets) {
      serviceAccountSpec['imagePullSecrets'] = spec.imagePullSecrets;
    }

    return this.createApiObject(
      spec.name,
      AWSResources.CORE_API_VERSION,
      'ServiceAccount',
      serviceAccountSpec,
      spec.labels,
      annotations,
    );
  }

  /**
   * Validates AWS ARN format for service account roles
   * @param arn - ARN to validate
   * @param context - Context for error messages
   * @throws Error if ARN format is invalid
   * @since 2.9.0
   */
  private validateAwsArn(arn: string, context: string): void {
    if (!arn || typeof arn !== 'string') {
      throw new Error(`Invalid ARN for ${context}: ARN must be a non-empty string`);
    }

    // AWS ARN format: arn:partition:service:region:account-id:resource
    const arnPattern = /^arn:(aws|aws-us-gov|aws-cn):([a-z0-9-]+):([a-z0-9-]*):([0-9]{12}):(.+)$/;

    if (!arnPattern.test(arn)) {
      throw new Error(
        `Invalid AWS ARN format for ${context}: ${arn}. ` +
          `Expected format: arn:partition:service:region:account-id:resource`,
      );
    }

    const match = arn.match(arnPattern);
    if (!match) {
      throw new Error(
        `Invalid AWS ARN format for ${context}: ${arn}. ` +
          `Expected format: arn:partition:service:region:account-id:resource`,
      );
    }

    const [, partition, service, , accountId, resource] = match;

    // Ensure all required parts are present
    if (!partition || !service || !accountId || !resource) {
      throw new Error(
        `Incomplete AWS ARN format for ${context}: ${arn}. ` + `Missing required components.`,
      );
    }

    // Validate IAM role ARN specifically
    if (service === 'iam') {
      const iamRolePattern =
        /^(role|user|group|policy|server-certificate|instance-profile)\/[A-Za-z0-9+=,.@\-_/]+$/;
      if (!iamRolePattern.test(resource)) {
        throw new Error(
          `Invalid IAM resource format for ${context}: ${resource}. ` +
            `Expected format: type/name (e.g., role/MyRole)`,
        );
      }
    }

    // Validate account ID format
    if (!/^[0-9]{12}$/.test(accountId)) {
      throw new Error(
        `Invalid AWS account ID for ${context}: ${accountId}. ` +
          `Account ID must be exactly 12 digits`,
      );
    }

    // Validate partition
    if (!['aws', 'aws-us-gov', 'aws-cn'].includes(partition)) {
      console.warn(
        `⚠️  WARNING: Unusual AWS partition '${partition}' in ARN for ${context}. ` +
          `Expected: aws, aws-us-gov, or aws-cn`,
      );
    }
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

export interface AWSECRServiceAccountSpec {
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
