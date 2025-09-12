/**
 * @fileoverview Pod template utilities for generating reusable Kubernetes pod specifications
 * @since 2.5.0
 */

/**
 * Container specification for pod templates
 * @interface ContainerSpec
 * @since 2.5.0
 */
export interface ContainerSpec {
  /** Container name */
  name: string;
  /** Container image */
  image: string;
  /** Container port */
  port?: number;
  /** Environment variables */
  env?: Array<{ name: string; value?: string; valueFrom?: unknown }>;
  /** Resource requirements */
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  /** Volume mounts */
  volumeMounts?: Array<{ name: string; mountPath: string; readOnly?: boolean }>;
  /** Security context */
  securityContext?: unknown;
  /** Liveness probe */
  livenessProbe?: unknown;
  /** Readiness probe */
  readinessProbe?: unknown;
  /** Startup probe */
  startupProbe?: unknown;
  /** Command to run */
  command?: string[];
  /** Arguments to command */
  args?: string[];
}

/**
 * Pod template specification
 * @interface PodTemplateSpec
 * @since 2.5.0
 */
export interface PodTemplateSpec {
  /** Pod name */
  name: string;
  /** Container specifications */
  containers: ContainerSpec[];
  /** Init containers */
  initContainers?: ContainerSpec[];
  /** Volumes */
  volumes?: Array<unknown>;
  /** Service account name */
  serviceAccountName?: string;
  /** Restart policy */
  restartPolicy?: 'Always' | 'OnFailure' | 'Never';
  /** Node selector */
  nodeSelector?: Record<string, string>;
  /** Tolerations */
  tolerations?: Array<unknown>;
  /** Affinity */
  affinity?: unknown;
  /** Security context */
  securityContext?: unknown;
  /** DNS policy */
  dnsPolicy?: string;
  /** Host network */
  hostNetwork?: boolean;
  /** Priority class name */
  priorityClassName?: string;
  /** Labels */
  labels?: Record<string, string>;
  /** Annotations */
  annotations?: Record<string, string>;
}

/**
 * Security profile for pod templates
 * @since 2.5.0
 */
export type SecurityProfile = 'baseline' | 'restricted' | 'privileged';

/**
 * Workload type for pod templates
 * @since 2.5.0
 */
export type WorkloadType = 'web' | 'api' | 'worker' | 'database' | 'cache' | 'batch';

/**
 * Creates a secure pod template with best practices
 * @param spec - Pod template specification
 * @param profile - Security profile to apply
 * @returns Pod template object
 *
 * @example
 * ```typescript
 * const template = createSecurePodTemplate({
 *   name: 'web-app',
 *   containers: [{
 *     name: 'app',
 *     image: 'nginx:1.27',
 *     port: 80
 *   }]
 * }, 'restricted');
 * ```
 *
 * @since 2.5.0
 */
export function createSecurePodTemplate(
  spec: PodTemplateSpec,
  profile: SecurityProfile = 'baseline',
): Record<string, unknown> {
  const securityContext = getSecurityContextForProfile(profile);
  const containers = spec.containers.map((container) => applyContainerSecurity(container, profile));

  const metadata: Record<string, unknown> = {
    name: spec.name,
    labels: {
      'app.kubernetes.io/name': spec.name,
      ...(spec.labels || {}),
    },
  };

  if (spec.annotations) {
    metadata['annotations'] = spec.annotations;
  }

  const combinedSecurityContext = { ...securityContext };
  if (spec.securityContext) {
    Object.assign(combinedSecurityContext, spec.securityContext);
  }

  const podSpec: Record<string, unknown> = {
    containers,
    restartPolicy: spec.restartPolicy ?? 'Always',
    securityContext: combinedSecurityContext,
  };

  if (spec.initContainers) {
    podSpec['initContainers'] = spec.initContainers.map((container) =>
      applyContainerSecurity(container, profile),
    );
  }
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
  if (spec.dnsPolicy) {
    podSpec['dnsPolicy'] = spec.dnsPolicy;
  }
  if (spec.hostNetwork) {
    podSpec['hostNetwork'] = spec.hostNetwork;
  }
  if (spec.priorityClassName) {
    podSpec['priorityClassName'] = spec.priorityClassName;
  }

  return {
    metadata,
    spec: podSpec,
  };
}

/**
 * Creates a workload-optimized pod template
 * @param spec - Pod template specification
 * @param workloadType - Type of workload
 * @returns Pod template object
 *
 * @example
 * ```typescript
 * const template = createWorkloadPodTemplate({
 *   name: 'api-server',
 *   containers: [{
 *     name: 'api',
 *     image: 'myapi:latest',
 *     port: 8080
 *   }]
 * }, 'api');
 * ```
 *
 * @since 2.5.0
 */
export function createWorkloadPodTemplate(
  spec: PodTemplateSpec,
  workloadType: WorkloadType,
): Record<string, unknown> {
  const workloadConfig = getWorkloadConfiguration(workloadType);
  const enhancedSpec: PodTemplateSpec = {
    ...spec,
    labels: { ...(spec.labels || {}), ...(workloadConfig.labels || {}) },
  };

  if (workloadConfig.restartPolicy) {
    enhancedSpec.restartPolicy = workloadConfig.restartPolicy;
  }

  return createSecurePodTemplate(enhancedSpec, 'baseline');
}

/**
 * Creates a multi-container pod template with sidecar pattern
 * @param mainContainer - Main application container
 * @param sidecars - Sidecar containers
 * @param options - Additional pod options
 * @returns Pod template object
 *
 * @example
 * ```typescript
 * const template = createSidecarPodTemplate(
 *   { name: 'app', image: 'myapp:latest', port: 8080 },
 *   [{ name: 'proxy', image: 'envoy:latest', port: 9901 }],
 *   { name: 'app-with-proxy' }
 * );
 * ```
 *
 * @since 2.5.0
 */
export function createSidecarPodTemplate(
  mainContainer: ContainerSpec,
  sidecars: ContainerSpec[],
  options: Partial<PodTemplateSpec>,
): Record<string, unknown> {
  const spec: PodTemplateSpec = {
    name: options.name || `${mainContainer.name}-pod`,
    containers: [mainContainer, ...sidecars],
    ...options,
  };

  return createSecurePodTemplate(spec, 'baseline');
}

/**
 * Creates a pod template with health checks
 * @param spec - Pod template specification
 * @param healthConfig - Health check configuration
 * @returns Pod template object
 *
 * @example
 * ```typescript
 * const template = createHealthyPodTemplate({
 *   name: 'web-app',
 *   containers: [{
 *     name: 'app',
 *     image: 'nginx:1.27',
 *     port: 80
 *   }]
 * }, {
 *   httpPath: '/health',
 *   port: 80
 * });
 * ```
 *
 * @since 2.5.0
 */
export function createHealthyPodTemplate(
  spec: PodTemplateSpec,
  healthConfig: {
    httpPath?: string;
    port?: number;
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    failureThreshold?: number;
  },
): Record<string, unknown> {
  const enhancedContainers = spec.containers.map((container) => ({
    ...container,
    livenessProbe: createHttpProbe(healthConfig, 'liveness'),
    readinessProbe: createHttpProbe(healthConfig, 'readiness'),
  }));

  return createSecurePodTemplate({ ...spec, containers: enhancedContainers }, 'baseline');
}

/**
 * Gets security context for the specified profile
 * @private
 */
function getSecurityContextForProfile(profile: SecurityProfile): Record<string, unknown> {
  switch (profile) {
    case 'restricted':
      return {
        runAsNonRoot: true,
        runAsUser: 65534,
        runAsGroup: 65534,
        fsGroup: 65534,
        seccompProfile: { type: 'RuntimeDefault' },
      };
    case 'baseline':
      return {
        runAsNonRoot: true,
        runAsUser: 1000,
        runAsGroup: 1000,
        fsGroup: 1000,
      };
    case 'privileged':
      return {};
    default:
      return getSecurityContextForProfile('baseline');
  }
}

/**
 * Applies container security based on profile
 * @private
 */
function applyContainerSecurity(
  container: ContainerSpec,
  profile: SecurityProfile,
): Record<string, unknown> {
  const baseContainer: Record<string, unknown> = {
    name: container.name,
    image: container.image,
  };

  if (container.port) {
    baseContainer['ports'] = [{ containerPort: container.port }];
  }
  if (container.env) {
    baseContainer['env'] = container.env;
  }
  if (container.resources) {
    baseContainer['resources'] = container.resources;
  }
  if (container.volumeMounts) {
    baseContainer['volumeMounts'] = container.volumeMounts;
  }
  if (container.command) {
    baseContainer['command'] = container.command;
  }
  if (container.args) {
    baseContainer['args'] = container.args;
  }
  if (container.livenessProbe) {
    baseContainer['livenessProbe'] = container.livenessProbe;
  }
  if (container.readinessProbe) {
    baseContainer['readinessProbe'] = container.readinessProbe;
  }
  if (container.startupProbe) {
    baseContainer['startupProbe'] = container.startupProbe;
  }

  const securityContext = getContainerSecurityContext(profile);
  const containerSecurityContext = { ...securityContext };
  if (container.securityContext) {
    Object.assign(containerSecurityContext, container.securityContext);
  }
  baseContainer['securityContext'] = containerSecurityContext;

  return baseContainer;
}

/**
 * Gets container security context for profile
 * @private
 */
function getContainerSecurityContext(profile: SecurityProfile): Record<string, unknown> {
  switch (profile) {
    case 'restricted':
      return {
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: true,
        runAsNonRoot: true,
        capabilities: { drop: ['ALL'] },
        seccompProfile: { type: 'RuntimeDefault' },
      };
    case 'baseline':
      return {
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: false,
        runAsNonRoot: true,
        capabilities: { drop: ['ALL'] },
      };
    case 'privileged':
      return {};
    default:
      return getContainerSecurityContext('baseline');
  }
}

/**
 * Gets workload-specific configuration
 * @private
 */
function getWorkloadConfiguration(workloadType: WorkloadType): Partial<PodTemplateSpec> {
  switch (workloadType) {
    case 'web':
      return {
        labels: { 'app.kubernetes.io/component': 'frontend' },
        restartPolicy: 'Always',
      };
    case 'api':
      return {
        labels: { 'app.kubernetes.io/component': 'backend' },
        restartPolicy: 'Always',
      };
    case 'worker':
      return {
        labels: { 'app.kubernetes.io/component': 'worker' },
        restartPolicy: 'Always',
      };
    case 'database':
      return {
        labels: { 'app.kubernetes.io/component': 'database' },
        restartPolicy: 'Always',
      };
    case 'cache':
      return {
        labels: { 'app.kubernetes.io/component': 'cache' },
        restartPolicy: 'Always',
      };
    case 'batch':
      return {
        labels: { 'app.kubernetes.io/component': 'batch' },
        restartPolicy: 'OnFailure',
      };
    default:
      return {};
  }
}

/**
 * Creates HTTP probe configuration
 * @private
 */
function createHttpProbe(
  config: {
    httpPath?: string;
    port?: number;
    initialDelaySeconds?: number;
    periodSeconds?: number;
    timeoutSeconds?: number;
    failureThreshold?: number;
  },
  type: 'liveness' | 'readiness',
): Record<string, unknown> {
  const defaults = {
    liveness: {
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
    },
    readiness: { initialDelaySeconds: 5, periodSeconds: 5, timeoutSeconds: 3, failureThreshold: 3 },
  };

  const defaultConfig = type === 'liveness' ? defaults.liveness : defaults.readiness;

  return {
    httpGet: {
      path: config.httpPath || '/health',
      port: config.port || 8080,
    },
    initialDelaySeconds: config.initialDelaySeconds || defaultConfig.initialDelaySeconds,
    periodSeconds: config.periodSeconds || defaultConfig.periodSeconds,
    timeoutSeconds: config.timeoutSeconds || defaultConfig.timeoutSeconds,
    failureThreshold: config.failureThreshold || defaultConfig.failureThreshold,
  };
}
