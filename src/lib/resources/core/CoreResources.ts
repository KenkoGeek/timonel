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
  private static readonly RBAC_API_VERSION = 'rbac.authorization.k8s.io/v1';
  private static readonly LABEL_NAME = 'app.kubernetes.io/name';
  private static readonly HELPER_NAME = 'chart.name';

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

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.APPS_API_VERSION,
      kind: 'Deployment',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      spec: deploymentSpec,
    });
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

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'Service',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: serviceSpec,
    });
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

  /**
   * Creates a DaemonSet resource
   * @param spec - DaemonSet specification
   * @returns Created DaemonSet ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addDaemonSet({
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
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const daemonSetSpec = this.buildDaemonSetSpec(spec, matchLabels);
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.APPS_API_VERSION,
      kind: 'DaemonSet',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      spec: daemonSetSpec,
    });
  }

  /**
   * Builds DaemonSet specification object
   * @private
   */
  private buildDaemonSetSpec(
    spec: DaemonSetSpec,
    matchLabels: Record<string, string>,
  ): Record<string, unknown> {
    const containers = this.buildDaemonSetContainers(spec);
    const podSpec = this.buildDaemonSetPodSpec(spec, containers);

    return {
      selector: { matchLabels },
      template: {
        metadata: {
          labels: { ...matchLabels, ...(spec.labels || {}) },
          ...(spec.annotations && Object.keys(spec.annotations).length > 0
            ? { annotations: spec.annotations }
            : {}),
        },
        spec: podSpec,
      },
      ...(spec.updateStrategy && { updateStrategy: spec.updateStrategy }),
    };
  }

  /**
   * Builds container specification for DaemonSet
   * @private
   */
  private buildDaemonSetContainers(spec: DaemonSetSpec): Record<string, unknown>[] {
    const container: Record<string, unknown> = {
      name: spec.name,
      image: spec.image,
    };

    if (spec.containerPort) {
      container['ports'] = [{ containerPort: spec.containerPort }];
    }
    if (spec.env) {
      container['env'] = spec.env;
    }
    if (spec.resources) {
      container['resources'] = spec.resources;
    }
    if (spec.volumeMounts) {
      container['volumeMounts'] = spec.volumeMounts;
    }
    if (spec.securityContext) {
      container['securityContext'] = spec.securityContext;
    }

    return [container];
  }

  /**
   * Builds pod specification for DaemonSet
   * @private
   */
  private buildDaemonSetPodSpec(
    spec: DaemonSetSpec,
    containers: Record<string, unknown>[],
  ): Record<string, unknown> {
    const podSpec: Record<string, unknown> = {
      containers,
    };

    if (spec.serviceAccountName) {
      podSpec['serviceAccountName'] = spec.serviceAccountName;
    }
    if (spec.nodeSelector) {
      podSpec['nodeSelector'] = spec.nodeSelector;
    }
    if (spec.tolerations) {
      podSpec['tolerations'] = spec.tolerations;
    }
    if (spec.affinity) {
      podSpec['affinity'] = spec.affinity;
    }
    if (spec.volumes) {
      podSpec['volumes'] = spec.volumes;
    }
    if (spec.hostNetwork) {
      podSpec['hostNetwork'] = spec.hostNetwork;
    }
    if (spec.hostPID) {
      podSpec['hostPID'] = spec.hostPID;
    }
    if (spec.dnsPolicy) {
      podSpec['dnsPolicy'] = spec.dnsPolicy;
    }
    if (spec.priorityClassName) {
      podSpec['priorityClassName'] = spec.priorityClassName;
    }

    return podSpec;
  }

  /**
   * Creates a StatefulSet resource
   * @param spec - StatefulSet specification
   * @returns Created StatefulSet ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addStatefulSet({
   *   name: 'database',
   *   image: 'postgres:13',
   *   replicas: 3,
   *   containerPort: 5432,
   *   serviceName: 'database-headless'
   * });
   * ```
   *
   * @since 2.4.0
   */
  addStatefulSet(spec: StatefulSetSpec): ApiObject {
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const statefulSetSpec = this.buildStatefulSetSpec(spec, matchLabels);
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.APPS_API_VERSION,
      kind: 'StatefulSet',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      spec: statefulSetSpec,
    });
  }

  /**
   * Builds StatefulSet specification object
   * @private
   */
  private buildStatefulSetSpec(
    spec: StatefulSetSpec,
    matchLabels: Record<string, string>,
  ): Record<string, unknown> {
    const containers = this.buildStatefulSetContainers(spec);
    const podSpec = this.buildStatefulSetPodSpec(spec, containers);

    const statefulSetSpec: Record<string, unknown> = {
      replicas: spec.replicas ?? 1,
      selector: { matchLabels },
      serviceName: spec.serviceName,
      template: {
        metadata: {
          labels: { ...matchLabels, ...(spec.labels || {}) },
          ...(spec.annotations && Object.keys(spec.annotations).length > 0
            ? { annotations: spec.annotations }
            : {}),
        },
        spec: podSpec,
      },
    };

    if (spec.volumeClaimTemplates) {
      statefulSetSpec['volumeClaimTemplates'] = spec.volumeClaimTemplates;
    }
    if (spec.updateStrategy) {
      statefulSetSpec['updateStrategy'] = spec.updateStrategy;
    }
    if (spec.podManagementPolicy) {
      statefulSetSpec['podManagementPolicy'] = spec.podManagementPolicy;
    }
    if (spec.revisionHistoryLimit !== undefined) {
      statefulSetSpec['revisionHistoryLimit'] = spec.revisionHistoryLimit;
    }

    return statefulSetSpec;
  }

  /**
   * Builds container specification for StatefulSet
   * @private
   */
  private buildStatefulSetContainers(spec: StatefulSetSpec): Record<string, unknown>[] {
    const container: Record<string, unknown> = {
      name: spec.name,
      image: spec.image,
    };

    if (spec.containerPort) {
      container['ports'] = [{ containerPort: spec.containerPort }];
    }
    if (spec.env) {
      container['env'] = spec.env;
    }
    if (spec.resources) {
      container['resources'] = spec.resources;
    }
    if (spec.volumeMounts) {
      container['volumeMounts'] = spec.volumeMounts;
    }
    if (spec.securityContext) {
      container['securityContext'] = spec.securityContext;
    }
    if (spec.livenessProbe) {
      container['livenessProbe'] = spec.livenessProbe;
    }
    if (spec.readinessProbe) {
      container['readinessProbe'] = spec.readinessProbe;
    }

    return [container];
  }

  /**
   * Builds pod specification for StatefulSet
   * @private
   */
  private buildStatefulSetPodSpec(
    spec: StatefulSetSpec,
    containers: Record<string, unknown>[],
  ): Record<string, unknown> {
    const podSpec: Record<string, unknown> = {
      containers,
    };

    if (spec.serviceAccountName) {
      podSpec['serviceAccountName'] = spec.serviceAccountName;
    }
    if (spec.nodeSelector) {
      podSpec['nodeSelector'] = spec.nodeSelector;
    }
    if (spec.tolerations) {
      podSpec['tolerations'] = spec.tolerations;
    }
    if (spec.affinity) {
      podSpec['affinity'] = spec.affinity;
    }
    if (spec.volumes) {
      podSpec['volumes'] = spec.volumes;
    }
    if (spec.initContainers) {
      podSpec['initContainers'] = spec.initContainers;
    }
    if (spec.terminationGracePeriodSeconds !== undefined) {
      podSpec['terminationGracePeriodSeconds'] = spec.terminationGracePeriodSeconds;
    }

    return podSpec;
  }

  /**
   * Creates a Role resource for RBAC
   * @param spec - Role specification
   * @returns Created Role ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addRole({
   *   name: 'pod-reader',
   *   rules: [
   *     {
   *       apiGroups: [''],
   *       resources: ['pods'],
   *       verbs: ['get', 'list', 'watch']
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addRole(spec: RoleSpec): ApiObject {
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.RBAC_API_VERSION,
      kind: 'Role',
      metadata: {
        name: spec.name,
        ...(spec.namespace && { namespace: spec.namespace }),
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      rules: spec.rules,
    });
  }

  /**
   * Creates a ClusterRole resource for cluster-wide RBAC
   * @param spec - ClusterRole specification
   * @returns Created ClusterRole ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addClusterRole({
   *   name: 'cluster-admin',
   *   rules: [
   *     {
   *       apiGroups: ['*'],
   *       resources: ['*'],
   *       verbs: ['*']
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addClusterRole(spec: ClusterRoleSpec): ApiObject {
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.RBAC_API_VERSION,
      kind: 'ClusterRole',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      rules: spec.rules,
    });
  }

  /**
   * Creates a RoleBinding resource for RBAC
   * @param spec - RoleBinding specification
   * @returns Created RoleBinding ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addRoleBinding({
   *   name: 'pod-reader-binding',
   *   roleRef: {
   *     kind: 'Role',
   *     name: 'pod-reader',
   *     apiGroup: 'rbac.authorization.k8s.io'
   *   },
   *   subjects: [
   *     {
   *       kind: 'ServiceAccount',
   *       name: 'my-service-account',
   *       namespace: 'default'
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addRoleBinding(spec: RoleBindingSpec): ApiObject {
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.RBAC_API_VERSION,
      kind: 'RoleBinding',
      metadata: {
        name: spec.name,
        ...(spec.namespace && { namespace: spec.namespace }),
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      roleRef: spec.roleRef,
      subjects: spec.subjects,
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

export interface DaemonSetSpec {
  name: string;
  image: string;
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
  hostNetwork?: boolean;
  hostPID?: boolean;
  dnsPolicy?: string;
  priorityClassName?: string;
  updateStrategy?: {
    type?: 'RollingUpdate' | 'OnDelete';
    rollingUpdate?: {
      maxUnavailable?: number | string;
    };
  };
}

export interface StatefulSetSpec {
  name: string;
  image: string;
  replicas?: number | string;
  serviceName: string;
  containerPort?: number;
  env?: Array<{ name: string; value?: string; valueFrom?: unknown }>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  volumeMounts?: Array<{ name: string; mountPath: string; readOnly?: boolean }>;
  volumes?: Array<unknown>;
  volumeClaimTemplates?: Array<unknown>;
  serviceAccountName?: string;
  securityContext?: unknown;
  nodeSelector?: Record<string, string>;
  tolerations?: Array<unknown>;
  affinity?: unknown;
  matchLabels?: Record<string, string>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  initContainers?: Array<unknown>;
  livenessProbe?: unknown;
  readinessProbe?: unknown;
  terminationGracePeriodSeconds?: number;
  updateStrategy?: {
    type?: 'RollingUpdate' | 'OnDelete';
    rollingUpdate?: {
      partition?: number;
      maxUnavailable?: number | string;
    };
  };
  podManagementPolicy?: 'OrderedReady' | 'Parallel';
  revisionHistoryLimit?: number;
}

export interface RoleSpec {
  name: string;
  namespace?: string;
  rules: Array<{
    apiGroups?: string[];
    resources?: string[];
    resourceNames?: string[];
    verbs: string[];
    nonResourceURLs?: string[];
  }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface ClusterRoleSpec {
  name: string;
  rules: Array<{
    apiGroups?: string[];
    resources?: string[];
    resourceNames?: string[];
    verbs: string[];
    nonResourceURLs?: string[];
  }>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface RoleBindingSpec {
  name: string;
  namespace?: string;
  roleRef: {
    kind: 'Role' | 'ClusterRole';
    name: string;
    apiGroup: string;
  };
  subjects: Array<{
    kind: 'User' | 'Group' | 'ServiceAccount';
    name: string;
    namespace?: string;
    apiGroup?: string;
  }>;
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
