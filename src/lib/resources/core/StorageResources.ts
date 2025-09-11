import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../BaseResourceProvider.js';

/**
 * Storage-related Kubernetes resources provider
 * Handles PersistentVolumes, PersistentVolumeClaims, and StorageClasses
 *
 * @since 2.4.0
 */
export class StorageResources extends BaseResourceProvider {
  private static readonly CORE_API_VERSION = 'v1';
  private static readonly STORAGE_API_VERSION = 'storage.k8s.io/v1';

  /**
   * Creates a PersistentVolume resource
   * @param spec - PersistentVolume specification
   * @returns Created PersistentVolume ApiObject
   *
   * @example
   * ```typescript
   * storageResources.addPersistentVolume({
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
    this.validateAccessModes(spec.accessModes, 'PersistentVolume');

    const pvSpec = {
      capacity: { storage: spec.capacity },
      accessModes: spec.accessModes,
      ...(spec.storageClassName ? { storageClassName: spec.storageClassName } : {}),
      ...(spec.persistentVolumeReclaimPolicy
        ? { persistentVolumeReclaimPolicy: spec.persistentVolumeReclaimPolicy }
        : {}),
      ...(spec.volumeMode ? { volumeMode: spec.volumeMode } : {}),
      ...(spec.csi ? { csi: spec.csi } : {}),
      ...(spec.hostPath ? { hostPath: spec.hostPath } : {}),
      ...(spec.nfs ? { nfs: spec.nfs } : {}),
    };

    return this.createApiObject(
      spec.name,
      StorageResources.CORE_API_VERSION,
      'PersistentVolume',
      pvSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a PersistentVolumeClaim resource
   * @param spec - PersistentVolumeClaim specification
   * @returns Created PersistentVolumeClaim ApiObject
   *
   * @example
   * ```typescript
   * storageResources.addPersistentVolumeClaim({
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
    this.validateAccessModes(spec.accessModes, 'PersistentVolumeClaim');

    const pvcSpec = {
      accessModes: spec.accessModes,
      resources: {
        requests: { storage: spec.size },
      },
      ...(spec.storageClassName ? { storageClassName: spec.storageClassName } : {}),
      ...(spec.volumeMode ? { volumeMode: spec.volumeMode } : {}),
      ...(spec.selector ? { selector: spec.selector } : {}),
    };

    return this.createApiObject(
      spec.name,
      StorageResources.CORE_API_VERSION,
      'PersistentVolumeClaim',
      pvcSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a StorageClass resource
   * @param spec - StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * storageResources.addStorageClass({
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
    const storageClassSpec = {
      provisioner: spec.provisioner,
      ...(spec.parameters ? { parameters: spec.parameters } : {}),
      ...(spec.reclaimPolicy ? { reclaimPolicy: spec.reclaimPolicy } : {}),
      ...(spec.allowVolumeExpansion !== undefined
        ? { allowVolumeExpansion: spec.allowVolumeExpansion }
        : {}),
      ...(spec.volumeBindingMode ? { volumeBindingMode: spec.volumeBindingMode } : {}),
      ...(spec.allowedTopologies ? { allowedTopologies: spec.allowedTopologies } : {}),
    };

    return this.createApiObject(
      spec.name,
      StorageResources.STORAGE_API_VERSION,
      'StorageClass',
      storageClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Validates access modes for storage resources
   * @param accessModes - Access modes to validate
   * @param resourceType - Type of resource for error messages
   */
  private validateAccessModes(accessModes: string[], resourceType: string): void {
    const validAccessModes = ['ReadWriteOnce', 'ReadOnlyMany', 'ReadWriteMany', 'ReadWriteOncePod'];

    for (const mode of accessModes) {
      if (!validAccessModes.includes(mode)) {
        throw new Error(
          `${resourceType}: Invalid access mode '${mode}'. Valid modes: ${validAccessModes.join(', ')}`,
        );
      }
    }
  }
}

// Type definitions
export interface PersistentVolumeSpec {
  name: string;
  capacity: string;
  accessModes: string[];
  storageClassName?: string;
  persistentVolumeReclaimPolicy?: 'Retain' | 'Recycle' | 'Delete';
  volumeMode?: 'Filesystem' | 'Block';
  csi?: {
    driver: string;
    volumeHandle: string;
    fsType?: string;
    volumeAttributes?: Record<string, string>;
  };
  hostPath?: { path: string; type?: string };
  nfs?: { server: string; path: string; readOnly?: boolean };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface PersistentVolumeClaimSpec {
  name: string;
  size: string;
  accessModes: string[];
  storageClassName?: string;
  volumeMode?: 'Filesystem' | 'Block';
  selector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: string;
      values?: string[];
    }>;
  };
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface StorageClassSpec {
  name: string;
  provisioner: string;
  parameters?: Record<string, string>;
  reclaimPolicy?: 'Delete' | 'Retain';
  allowVolumeExpansion?: boolean;
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer';
  allowedTopologies?: Array<{
    matchLabelExpressions?: Array<{
      key: string;
      values: string[];
    }>;
  }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}
