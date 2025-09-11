import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../BaseResourceProvider.js';

/**
 * Azure-specific Kubernetes resources provider
 * Handles Azure integrations like Azure Disk, Azure File, Application Gateway, AGIC, and other Azure services
 *
 * @since 2.4.0
 */
export class AzureResources extends BaseResourceProvider {
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';
  private static readonly NETWORKING_API_VERSION = 'networking.k8s.io/v1';

  /**
   * Creates an Azure Disk StorageClass
   * @param spec - Azure Disk StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * azureResources.addAzureDiskStorageClass({
   *   name: 'premium-disk',
   *   skuName: 'Premium_LRS',
   *   cachingMode: 'ReadOnly',
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addAzureDiskStorageClass(spec: AzureDiskStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      skuName: spec.skuName ?? 'Standard_LRS',
      ...(spec.cachingMode ? { cachingmode: spec.cachingMode } : {}),
      ...(spec.fsType ? { fsType: spec.fsType } : {}),
      ...(spec.kind ? { kind: spec.kind } : {}),
    };

    const storageClassSpec = {
      provisioner: 'disk.csi.azure.com',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'WaitForFirstConsumer',
    };

    return this.createApiObject(
      spec.name,
      AzureResources.STORAGE_API_VERSION,
      'StorageClass',
      storageClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates an Azure File StorageClass
   * @param spec - Azure File StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * azureResources.addAzureFileStorageClass({
   *   name: 'azure-file-premium',
   *   skuName: 'Premium_LRS',
   *   protocol: 'nfs',
   *   allowSharedAccess: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addAzureFileStorageClass(spec: AzureFileStorageClassSpec): ApiObject {
    const parameters: Record<string, string> = {
      skuName: spec.skuName ?? 'Standard_LRS',
      ...(spec.protocol ? { protocol: spec.protocol } : {}),
      ...(spec.allowSharedAccess !== undefined
        ? { allowSharedAccess: String(spec.allowSharedAccess) }
        : {}),
    };

    const storageClassSpec = {
      provisioner: 'file.csi.azure.com',
      parameters,
      reclaimPolicy: spec.reclaimPolicy ?? 'Delete',
      allowVolumeExpansion: spec.allowVolumeExpansion ?? true,
      volumeBindingMode: spec.volumeBindingMode ?? 'Immediate',
    };

    return this.createApiObject(
      spec.name,
      AzureResources.STORAGE_API_VERSION,
      'StorageClass',
      storageClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates an Azure Application Gateway Ingress
   * @param spec - AGIC Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @example
   * ```typescript
   * azureResources.addApplicationGatewayIngress({
   *   name: 'app-gateway-ingress',
   *   host: 'myapp.example.com',
   *   serviceName: 'my-service',
   *   servicePort: 80,
   *   sslRedirect: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addApplicationGatewayIngress(spec: AzureAGICIngressSpec): ApiObject {
    const annotations: Record<string, string> = {
      'kubernetes.io/ingress.class': 'azure/application-gateway',
      ...(spec.sslRedirect !== undefined
        ? { 'appgw.ingress.kubernetes.io/ssl-redirect': String(spec.sslRedirect) }
        : {}),
      ...(spec.cookieBasedAffinity !== undefined
        ? { 'appgw.ingress.kubernetes.io/cookie-based-affinity': String(spec.cookieBasedAffinity) }
        : {}),
      ...(spec.requestTimeout
        ? { 'appgw.ingress.kubernetes.io/request-timeout': String(spec.requestTimeout) }
        : {}),
      ...(spec.connectionDraining !== undefined
        ? { 'appgw.ingress.kubernetes.io/connection-draining': String(spec.connectionDraining) }
        : {}),
      ...(spec.annotations || {}),
    };

    const rules = [
      {
        host: spec.host,
        http: {
          paths: [
            {
              path: spec.path ?? '/',
              pathType: 'Prefix',
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
      AzureResources.NETWORKING_API_VERSION,
      'Ingress',
      ingressSpec,
      spec.labels,
      annotations,
    );
  }
}

// Type definitions
export interface AzureDiskStorageClassSpec {
  name: string;
  skuName?: 'Standard_LRS' | 'Premium_LRS' | 'StandardSSD_LRS' | 'UltraSSD_LRS';
  cachingMode?: 'None' | 'ReadOnly' | 'ReadWrite';
  fsType?: string;
  kind?: 'Shared' | 'Dedicated' | 'Managed';
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AzureFileStorageClassSpec {
  name: string;
  skuName?: 'Standard_LRS' | 'Premium_LRS';
  protocol?: 'smb' | 'nfs';
  allowSharedAccess?: boolean;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AzureAGICIngressSpec {
  name: string;
  host: string;
  serviceName: string;
  servicePort: number;
  path?: string;
  sslRedirect?: boolean;
  cookieBasedAffinity?: boolean;
  requestTimeout?: number;
  connectionDraining?: boolean;
  tls?: Array<{ hosts: string[]; secretName: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}
