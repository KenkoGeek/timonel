import { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../BaseResourceProvider.js';
import { include } from '../../helm.js';

/**
 * Core Kubernetes resources provider
 * Handles fundamental Kubernetes resources like Deployments, Services, ConfigMaps, etc.
 *
 * @since 2.4.0
 */
export class CoreResources extends BaseResourceProvider {
  private static readonly APPS_API_VERSION = 'apps/v1';
  private static readonly CORE_API_VERSION = 'v1';
  private static readonly LABEL_NAME = 'app.kubernetes.io/name';
  private static readonly HELPER_NAME = '{{ include "chart.name" . }}';

  /**
   * Creates a Deployment resource
   * @param spec - Deployment specification
   * @returns Created Deployment ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addDeployment({
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
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const labels = {
      ...matchLabels,
      ...spec.labels,
    };

    const containers = [
      {
        name: spec.name,
        image: spec.image,
        ...(spec.containerPort ? { ports: [{ containerPort: spec.containerPort }] } : {}),
        ...(spec.env ? { env: spec.env } : {}),
        ...(spec.resources ? { resources: spec.resources } : {}),
        ...(spec.volumeMounts ? { volumeMounts: spec.volumeMounts } : {}),
        ...(spec.securityContext ? { securityContext: spec.securityContext } : {}),
      },
    ];

    const deploymentSpec = {
      replicas: spec.replicas ?? 1,
      selector: { matchLabels },
      template: {
        metadata: { labels },
        spec: {
          containers,
          ...(spec.volumes ? { volumes: spec.volumes } : {}),
          ...(spec.serviceAccountName ? { serviceAccountName: spec.serviceAccountName } : {}),
          ...(spec.securityContext ? { securityContext: spec.securityContext } : {}),
          ...(spec.nodeSelector ? { nodeSelector: spec.nodeSelector } : {}),
          ...(spec.tolerations ? { tolerations: spec.tolerations } : {}),
          ...(spec.affinity ? { affinity: spec.affinity } : {}),
        },
      },
    };

    return this.createApiObject(
      spec.name,
      CoreResources.APPS_API_VERSION,
      'Deployment',
      deploymentSpec,
      labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Service resource
   * @param spec - Service specification
   * @returns Created Service ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addService({
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
    const selector = spec.selector ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const ports = spec.ports ?? [
      {
        port: spec.port,
        targetPort: spec.targetPort ?? spec.port,
        ...(spec.protocol ? { protocol: spec.protocol } : {}),
        ...(spec.name ? { name: spec.name } : {}),
      },
    ];

    const serviceSpec = {
      selector,
      ports,
      ...(spec.type ? { type: spec.type } : {}),
      ...(spec.clusterIP ? { clusterIP: spec.clusterIP } : {}),
      ...(spec.externalIPs ? { externalIPs: spec.externalIPs } : {}),
      ...(spec.loadBalancerIP ? { loadBalancerIP: spec.loadBalancerIP } : {}),
      ...(spec.sessionAffinity ? { sessionAffinity: spec.sessionAffinity } : {}),
    };

    return this.createApiObject(
      spec.name,
      CoreResources.CORE_API_VERSION,
      'Service',
      serviceSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a ConfigMap resource
   * @param spec - ConfigMap specification
   * @returns Created ConfigMap ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addConfigMap({
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
    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'ConfigMap',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      ...(spec.data ? { data: spec.data } : {}),
      ...(spec.binaryData ? { binaryData: spec.binaryData } : {}),
    });
  }

  /**
   * Creates a Secret resource
   * @param spec - Secret specification
   * @returns Created Secret ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addSecret({
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
    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'Secret',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      type: spec.type ?? 'Opaque',
      ...(spec.data ? { data: spec.data } : {}),
      ...(spec.stringData ? { stringData: spec.stringData } : {}),
    });
  }

  /**
   * Creates a ServiceAccount resource
   * @param spec - ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addServiceAccount({
   *   name: 'app-service-account',
   *   automountServiceAccountToken: false
   * });
   * ```
   *
   * @since 2.4.0
   */
  addServiceAccount(spec: ServiceAccountSpec): ApiObject {
    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'ServiceAccount',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      ...(spec.automountServiceAccountToken !== undefined
        ? { automountServiceAccountToken: spec.automountServiceAccountToken }
        : {}),
      ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
      ...(spec.secrets ? { secrets: spec.secrets } : {}),
    });
  }
}

// Type definitions
export interface DeploymentSpec {
  name: string;
  image: string;
  replicas?: number;
  containerPort?: number;
  env?: Array<{ name: string; value?: string; valueFrom?: unknown }>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  volumeMounts?: Array<{ name: string; mountPath: string; readOnly?: boolean }>;
  volumes?: Array<unknown>;
  serviceAccountName?: string;
  securityContext?: unknown;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<unknown>;
  affinity?: unknown;
  matchLabels?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ServiceSpec {
  name: string;
  port: number;
  targetPort?: number;
  ports?: Array<{
    port: number;
    targetPort?: number;
    protocol?: string;
    name?: string;
  }>;
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
  selector?: Record<string, string>;
  clusterIP?: string;
  externalIPs?: string[];
  loadBalancerIP?: string;
  sessionAffinity?: string;
  protocol?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ConfigMapSpec {
  name: string;
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface SecretSpec {
  name: string;
  type?: string;
  data?: Record<string, string>;
  stringData?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ServiceAccountSpec {
  name: string;
  automountServiceAccountToken?: boolean;
  imagePullSecrets?: Array<{ name: string }>;
  secrets?: Array<{ name: string }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}
