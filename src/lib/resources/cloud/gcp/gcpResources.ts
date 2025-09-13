import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../baseResourceProvider.js';

/**
 * GCP-specific Kubernetes resources provider
 * Handles GCP integrations like Persistent Disk, Filestore, GCE Ingress, Workload Identity, and other GCP services
 *
 * @since 2.4.0
 */
export class GCPResources extends BaseResourceProvider {
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';
  private static readonly CORE_API_VERSION = 'v1';
  private static readonly NETWORKING_API_VERSION = 'networking.k8s.io/v1';

  /**
   * Creates a GCP Persistent Disk StorageClass
   * @param spec - GCP PD StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * gcpResources.addPersistentDiskStorageClass({
   *   name: 'fast-ssd',
   *   type: 'pd-ssd',
   *   replicationType: 'regional-pd',
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addPersistentDiskStorageClass(spec: GCPPersistentDiskStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      type: spec.type ?? 'pd-standard',
      ...(spec.replicationType ? { 'replication-type': spec.replicationType } : {}),
      ...(spec.fsType ? { fstype: spec.fsType } : {}),
    };

    const fields = {
      provisioner: 'pd.csi.storage.gke.io',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    };

    return this.createRootLevelApiObject(
      spec.name,
      GCPResources.STORAGE_API_VERSION,
      'StorageClass',
      fields,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a GCP Filestore StorageClass
   * @param spec - GCP Filestore StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * gcpResources.addFilestoreStorageClass({
   *   name: 'filestore-premium',
   *   tier: 'premium',
   *   network: 'default',
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addFilestoreStorageClass(spec: GCPFilestoreStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      tier: spec.tier ?? 'standard',
      network: spec.network ?? 'default',
      ...(spec.location ? { location: spec.location } : {}),
    };

    const fields = {
      provisioner: 'filestore.csi.storage.gke.io',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
    };

    return this.createRootLevelApiObject(
      spec.name,
      GCPResources.STORAGE_API_VERSION,
      'StorageClass',
      fields,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a GCE Ingress with Google Cloud Load Balancer
   * @param spec - GCE Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @example
   * ```typescript
   * gcpResources.addGCEIngress({
   *   name: 'gce-ingress',
   *   host: 'myapp.example.com',
   *   serviceName: 'my-service',
   *   servicePort: 80,
   *   staticIPName: 'my-static-ip',
   *   managedCertificate: 'my-ssl-cert'
   * });
   * ```
   *
   * @since 2.4.0
   */
  addGCEIngress(spec: GCPGCEIngressSpec): ApiObject {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'gce',
      ...(spec.staticIPName
        ? { 'kubernetes.io/ingress.global-static-ip-name': spec.staticIPName }
        : {}),
      ...(spec.managedCertificate
        ? { 'networking.gke.io/managed-certificates': spec.managedCertificate }
        : {}),
      ...(spec.sslRedirect !== undefined
        ? { 'ingress.gcp.kubernetes.io/force-ssl-redirect': String(spec.sslRedirect) }
        : {}),
      ...(spec.backendConfig
        ? { 'cloud.google.com/backend-config': JSON.stringify(spec.backendConfig) }
        : {}),
      ...(spec.annotations || {}),
    };

    const rules = [
      {
        host: spec.host,
        http: {
          paths: [
            {
              path: spec.path ?? '/*',
              pathType: 'ImplementationSpecific',
              backend: {
                service: {
                  name: spec.serviceName,
                  port: { number: spec.servicePort },
                },
              },
            },
          ],
        },
      },
    ];

    const ingressSpec = {
      rules,
      ...(spec.tls ? { tls: spec.tls } : {}),
    };

    return this.createApiObject(
      spec.name,
      GCPResources.NETWORKING_API_VERSION,
      'Ingress',
      ingressSpec,
      spec.labels,
      annotations,
    );
  }

  /**
   * Creates a ServiceAccount with Workload Identity annotations
   * @param spec - Workload Identity ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * gcpResources.addWorkloadIdentityServiceAccount({
   *   name: 'workload-identity-sa',
   *   googleServiceAccount: 'my-gsa@my-project.iam.gserviceaccount.com',
   *   namespace: 'default'
   * });
   * ```
   *
   * @since 2.4.0
   */
  addWorkloadIdentityServiceAccount(spec: GCPWorkloadIdentityServiceAccountSpec): ApiObject {
    const annotations: Record<string, string> = {
      'iam.gke.io/gcp-service-account': spec.googleServiceAccount,
      ...(spec.annotations || {}),
    };

    const serviceAccountSpec = {};

    return this.createApiObject(
      spec.name,
      GCPResources.CORE_API_VERSION,
      'ServiceAccount',
      serviceAccountSpec,
      spec.labels,
      annotations,
    );
  }

  /**
   * Creates a ServiceAccount with GCP Artifact Registry access
   * @param spec - Artifact Registry ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * gcpResources.addArtifactRegistryServiceAccount({
   *   name: 'artifact-registry-sa',
   *   googleServiceAccount: 'my-gsa@project.iam.gserviceaccount.com'
   * });
   * ```
   *
   * @since 2.7.0
   */
  addArtifactRegistryServiceAccount(spec: GCPArtifactRegistryServiceAccountSpec): ApiObject {
    const googleServiceAccount =
      'googleServiceAccount' in spec ? spec.googleServiceAccount : spec.gcpServiceAccount;

    const annotations = {
      'iam.gke.io/gcp-service-account': googleServiceAccount,
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
      GCPResources.CORE_API_VERSION,
      'ServiceAccount',
      serviceAccountSpec,
      spec.labels,
      annotations,
    );
  }
}

// Type definitions
export interface GCPPersistentDiskStorageClassSpec {
  name: string;
  type?: 'pd-standard' | 'pd-ssd' | 'pd-balanced';
  replicationType?: 'none' | 'regional-pd';
  fsType?: string;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface GCPFilestoreStorageClassSpec {
  name: string;
  tier?: 'standard' | 'premium' | 'basic-hdd' | 'basic-ssd';
  network?: string;
  location?: string;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface GCPGCEIngressSpec {
  name: string;
  host: string;
  serviceName: string;
  servicePort: number;
  path?: string;
  staticIPName?: string;
  managedCertificate?: string;
  sslRedirect?: boolean;
  backendConfig?: Record<string, unknown>;
  tls?: Array<{ hosts: string[]; secretName: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface GCPWorkloadIdentityServiceAccountSpec {
  name: string;
  googleServiceAccount: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export type GCPArtifactRegistryServiceAccountSpec = {
  name: string;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: Array<{ name: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
} & (
  | { googleServiceAccount: string; gcpServiceAccount?: never }
  | { gcpServiceAccount: string; googleServiceAccount?: never }
);
