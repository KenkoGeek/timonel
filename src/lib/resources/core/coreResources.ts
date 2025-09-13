import { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../baseResourceProvider.js';
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
      replicas: this.normalizeReplicas(spec.replicas),
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
    // Validate and encode base64 data if needed
    const processedData = spec.data ? this.validateAndEncodeSecretData(spec.data) : undefined;

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'Secret',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      type: spec.type ?? 'Opaque',
      ...(processedData ? { data: processedData } : {}),
      ...(spec.stringData ? { stringData: spec.stringData } : {}),
    });
  }

  /**
   * Validates and encodes Secret data as base64
   * @param data - Raw secret data
   * @returns Base64 encoded data
   * @private
   * @since 2.5.0
   */
  private validateAndEncodeSecretData(data: Record<string, string>): Record<string, string> {
    const encodedData: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
      // Check if value is already base64 encoded (basic validation)
      if (this.isBase64Encoded(value)) {
        // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Object.entries iteration
        encodedData[key] = value;
      } else {
        // Encode as base64
        // eslint-disable-next-line security/detect-object-injection -- Safe: key is from Object.entries iteration
        encodedData[key] = Buffer.from(value, 'utf8').toString('base64');
      }
    }

    return encodedData;
  }

  /**
   * Checks if a string is base64 encoded
   * @param str - String to check
   * @returns True if string appears to be base64 encoded
   * @private
   * @since 2.5.0
   */
  private isBase64Encoded(str: string): boolean {
    // Basic base64 validation - checks for valid base64 characters and padding
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;

    if (!base64Regex.test(str)) {
      return false;
    }

    try {
      // Attempt decode without exposing the decoded content
      Buffer.from(str, 'base64');
      return true;
    } catch {
      return false;
    }
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
      replicas: this.normalizeReplicas(spec.replicas),
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

  /**
   * Creates a ClusterRoleBinding resource for cluster-wide RBAC
   * @param spec - ClusterRoleBinding specification
   * @returns Created ClusterRoleBinding ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addClusterRoleBinding({
   *   name: 'cluster-admin-binding',
   *   roleRef: {
   *     kind: 'ClusterRole',
   *     name: 'cluster-admin',
   *     apiGroup: 'rbac.authorization.k8s.io'
   *   },
   *   subjects: [
   *     {
   *       kind: 'ServiceAccount',
   *       name: 'admin-user',
   *       namespace: 'kube-system'
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addClusterRoleBinding(spec: ClusterRoleBindingSpec): ApiObject {
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.RBAC_API_VERSION,
      kind: 'ClusterRoleBinding',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      roleRef: spec.roleRef,
      subjects: spec.subjects,
    });
  }

  /**
   * Creates a Job resource for batch workloads
   * @param spec - Job specification
   * @returns Created Job ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addJob({
   *   name: 'data-processor',
   *   image: 'busybox:1.35',
   *   command: ['sh', '-c', 'echo "Processing data..." && sleep 30'],
   *   completions: 1,
   *   parallelism: 1
   * });
   * ```
   *
   * @since 2.4.0
   */
  addJob(spec: JobSpec): ApiObject {
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const jobSpec = this.buildJobSpec(spec, matchLabels);
    const labels = {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
      ...(spec.labels || {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: spec.name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(spec.annotations && Object.keys(spec.annotations).length > 0
          ? { annotations: spec.annotations }
          : {}),
      },
      spec: jobSpec,
    });
  }

  /**
   * Builds Job specification object
   * @private
   */
  private buildJobSpec(
    spec: JobSpec,
    matchLabels: Record<string, string>,
  ): Record<string, unknown> {
    const containers = this.buildJobContainers(spec);
    const podSpec = this.buildJobPodSpec(spec, containers);

    const jobSpec: Record<string, unknown> = {
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

    if (spec.completions !== undefined) {
      jobSpec['completions'] = spec.completions;
    }
    if (spec.parallelism !== undefined) {
      jobSpec['parallelism'] = spec.parallelism;
    }
    if (spec.backoffLimit !== undefined) {
      jobSpec['backoffLimit'] = spec.backoffLimit;
    }
    if (spec.activeDeadlineSeconds !== undefined) {
      jobSpec['activeDeadlineSeconds'] = spec.activeDeadlineSeconds;
    }
    if (spec.ttlSecondsAfterFinished !== undefined) {
      jobSpec['ttlSecondsAfterFinished'] = spec.ttlSecondsAfterFinished;
    }
    if (spec.completionMode) {
      jobSpec['completionMode'] = spec.completionMode;
    }
    if (spec.suspend !== undefined) {
      jobSpec['suspend'] = spec.suspend;
    }

    return jobSpec;
  }

  /**
   * Builds container specification for Job
   * @private
   */
  private buildJobContainers(spec: JobSpec): Record<string, unknown>[] {
    const containerSpec: Record<string, unknown> = {
      name: spec.name,
      image: spec.image,
    };

    if (spec.command) containerSpec['command'] = spec.command;
    if (spec.args) containerSpec['args'] = spec.args;
    if (spec.env) containerSpec['env'] = spec.env;
    if (spec.resources) containerSpec['resources'] = spec.resources;
    if (spec.volumeMounts) containerSpec['volumeMounts'] = spec.volumeMounts;
    if (spec.securityContext) containerSpec['securityContext'] = spec.securityContext;

    return this.buildGenericContainers(containerSpec);
  }

  /**
   * Builds pod specification for Job
   * @private
   */
  private buildJobPodSpec(
    spec: JobSpec,
    containers: Record<string, unknown>[],
  ): Record<string, unknown> {
    const podSpec: Record<string, unknown> = {
      containers,
      restartPolicy: spec.restartPolicy ?? 'Never',
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

    return podSpec;
  }

  /**
   * Creates a ReplicaSet resource
   * @param spec - ReplicaSet specification
   * @returns Created ReplicaSet ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addReplicaSet({
   *   name: 'web-replica',
   *   image: 'nginx:1.21',
   *   replicas: 3,
   *   containerPort: 80
   * });
   * ```
   *
   * @since 2.4.0
   */
  addReplicaSet(spec: ReplicaSetSpec): ApiObject {
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
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

    const replicaSetSpec = {
      replicas: this.normalizeReplicas(spec.replicas),
      selector: { matchLabels },
      template: {
        metadata: { labels: { ...matchLabels, ...spec.labels } },
        spec: {
          containers,
          ...(spec.volumes ? { volumes: spec.volumes } : {}),
          ...(spec.serviceAccountName ? { serviceAccountName: spec.serviceAccountName } : {}),
          ...(spec.nodeSelector ? { nodeSelector: spec.nodeSelector } : {}),
          ...(spec.tolerations ? { tolerations: spec.tolerations } : {}),
          ...(spec.affinity ? { affinity: spec.affinity } : {}),
        },
      },
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.APPS_API_VERSION,
      kind: 'ReplicaSet',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: replicaSetSpec,
    });
  }

  /**
   * Creates a Pod resource
   * @param spec - Pod specification
   * @returns Created Pod ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addPod({
   *   name: 'web-pod',
   *   image: 'nginx:1.21',
   *   containerPort: 80
   * });
   * ```
   *
   * @since 2.4.0
   */
  addPod(spec: PodSpec): ApiObject {
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

    const podSpec = {
      containers,
      restartPolicy: spec.restartPolicy ?? 'Always',
      ...(spec.volumes ? { volumes: spec.volumes } : {}),
      ...(spec.serviceAccountName ? { serviceAccountName: spec.serviceAccountName } : {}),
      ...(spec.nodeSelector ? { nodeSelector: spec.nodeSelector } : {}),
      ...(spec.tolerations ? { tolerations: spec.tolerations } : {}),
      ...(spec.affinity ? { affinity: spec.affinity } : {}),
      ...(spec.initContainers ? { initContainers: spec.initContainers } : {}),
    };

    return new ApiObject(this.chart, spec.name, {
      apiVersion: CoreResources.CORE_API_VERSION,
      kind: 'Pod',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: podSpec,
    });
  }

  /**
   * Creates a CronJob resource
   * @param spec - CronJob specification
   * @returns Created CronJob ApiObject
   *
   * @example
   * ```typescript
   * coreResources.addCronJob({
   *   name: 'backup-job',
   *   schedule: '0 2 * * *',
   *   image: 'backup:latest',
   *   command: ['sh', '-c', 'backup-script.sh']
   * });
   * ```
   *
   * @since 2.4.0
   */
  addCronJob(spec: CronJobSpec): ApiObject {
    const matchLabels = spec.matchLabels ?? {
      [CoreResources.LABEL_NAME]: include(CoreResources.HELPER_NAME),
    };

    const cronJobSpec = this.buildCronJobSpec(spec, matchLabels);

    return new ApiObject(this.chart, spec.name, {
      apiVersion: 'batch/v1',
      kind: 'CronJob',
      metadata: {
        name: spec.name,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.annotations ? { annotations: spec.annotations } : {}),
      },
      spec: cronJobSpec,
    });
  }

  /**
   * Builds CronJob specification object
   * @private
   */
  private buildCronJobSpec(
    spec: CronJobSpec,
    matchLabels: Record<string, string>,
  ): Record<string, unknown> {
    const containerSpec: Record<string, unknown> = {
      name: spec.name,
      image: spec.image,
    };

    if (spec.command) containerSpec['command'] = spec.command;
    if (spec.args) containerSpec['args'] = spec.args;
    if (spec.env) containerSpec['env'] = spec.env;
    if (spec.resources) containerSpec['resources'] = spec.resources;
    if (spec.volumeMounts) containerSpec['volumeMounts'] = spec.volumeMounts;
    if (spec.securityContext) containerSpec['securityContext'] = spec.securityContext;

    const containers = this.buildGenericContainers(containerSpec);
    const podSpec = this.buildCronJobPodSpec(spec, containers);

    const cronJobSpec: Record<string, unknown> = {
      schedule: spec.schedule,
      jobTemplate: {
        spec: {
          template: {
            metadata: { labels: { ...matchLabels, ...spec.labels } },
            spec: podSpec,
          },
          ...(spec.backoffLimit !== undefined ? { backoffLimit: spec.backoffLimit } : {}),
          ...(spec.activeDeadlineSeconds !== undefined
            ? { activeDeadlineSeconds: spec.activeDeadlineSeconds }
            : {}),
        },
      },
    };

    if (spec.concurrencyPolicy) {
      cronJobSpec['concurrencyPolicy'] = spec.concurrencyPolicy;
    }
    if (spec.suspend !== undefined) {
      cronJobSpec['suspend'] = spec.suspend;
    }
    if (spec.successfulJobsHistoryLimit !== undefined) {
      cronJobSpec['successfulJobsHistoryLimit'] = spec.successfulJobsHistoryLimit;
    }
    if (spec.failedJobsHistoryLimit !== undefined) {
      cronJobSpec['failedJobsHistoryLimit'] = spec.failedJobsHistoryLimit;
    }
    if (spec.startingDeadlineSeconds !== undefined) {
      cronJobSpec['startingDeadlineSeconds'] = spec.startingDeadlineSeconds;
    }

    return cronJobSpec;
  }

  /**
   * Builds generic container specification
   * @private
   */
  private buildGenericContainers(spec: Record<string, unknown>): Record<string, unknown>[] {
    const container: Record<string, unknown> = {
      name: spec['name'],
      image: spec['image'],
    };

    if (spec['containerPort']) {
      container['ports'] = [{ containerPort: spec['containerPort'] }];
    }
    if (spec['command']) {
      container['command'] = spec['command'];
    }
    if (spec['args']) {
      container['args'] = spec['args'];
    }
    if (spec['env']) {
      container['env'] = spec['env'];
    }
    if (spec['resources']) {
      container['resources'] = spec['resources'];
    }
    if (spec['volumeMounts']) {
      container['volumeMounts'] = spec['volumeMounts'];
    }
    if (spec['securityContext']) {
      container['securityContext'] = spec['securityContext'];
    }

    return [container];
  }

  /**
   * Builds pod specification for CronJob
   * @private
   */
  private buildCronJobPodSpec(
    spec: CronJobSpec,
    containers: Record<string, unknown>[],
  ): Record<string, unknown> {
    const podSpec: Record<string, unknown> = {
      containers,
      restartPolicy: spec.restartPolicy ?? 'OnFailure',
    };

    if (spec.volumes) {
      podSpec['volumes'] = spec.volumes;
    }
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

    return podSpec;
  }

  /**
   * Normalizes replicas value to ensure it's always a number
   * @param replicas - Replicas value (number, string, or undefined)
   * @returns Normalized number value or Helm template string
   * @private
   * @since 2.5.0
   */
  private normalizeReplicas(replicas?: number | string): number | string {
    if (replicas === undefined || replicas === null) {
      return 1;
    }

    // Validate Helm template value with safe regex (no ReDoS vulnerability)
    if (typeof replicas === 'string') {
      // Simple check for Helm template pattern without catastrophic backtracking
      if (replicas.trim().startsWith('{{') && replicas.trim().endsWith('}}')) {
        return replicas.trim();
      }

      const parsed = parseInt(replicas, 10);
      return isNaN(parsed) ? 1 : Math.max(0, parsed);
    }

    if (typeof replicas === 'number') {
      return Math.max(0, Math.floor(replicas));
    }

    return 1;
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

export interface ClusterRoleBindingSpec {
  name: string;
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

export interface JobSpec {
  name: string;
  image: string;
  command?: string[];
  args?: string[];
  completions?: number;
  parallelism?: number;
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
  ttlSecondsAfterFinished?: number;
  completionMode?: 'NonIndexed' | 'Indexed';
  suspend?: boolean;
  restartPolicy?: 'Never' | 'OnFailure';
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
  initContainers?: Array<unknown>;
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

export interface ReplicaSetSpec {
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

export interface PodSpec {
  name: string;
  image: string;
  containerPort?: number;
  restartPolicy?: 'Always' | 'OnFailure' | 'Never';
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
  initContainers?: Array<unknown>;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface CronJobSpec {
  name: string;
  schedule: string;
  image: string;
  command?: string[];
  args?: string[];
  restartPolicy?: 'OnFailure' | 'Never';
  concurrencyPolicy?: 'Allow' | 'Forbid' | 'Replace';
  suspend?: boolean;
  successfulJobsHistoryLimit?: number;
  failedJobsHistoryLimit?: number;
  startingDeadlineSeconds?: number;
  backoffLimit?: number;
  activeDeadlineSeconds?: number;
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
