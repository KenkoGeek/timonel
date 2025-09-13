/**
 * @fileoverview Autoscaling resources for Kubernetes workloads
 * @since 2.3.0
 */

import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../baseResourceProvider.js';

/**
 * Horizontal Pod Autoscaler specification
 * @since 2.7.0
 */
export interface HorizontalPodAutoscalerSpec {
  /** Resource name */
  name: string;
  /** Target reference */
  scaleTargetRef: {
    apiVersion: string;
    kind: string;
    name: string;
  };
  /** Minimum replicas */
  minReplicas?: number;
  /** Maximum replicas */
  maxReplicas: number;
  /** Metrics for scaling */
  metrics?: Array<{
    type: 'Resource' | 'Pods' | 'Object' | 'External';
    resource?: {
      name: string;
      target: {
        type: 'Utilization' | 'AverageValue' | 'Value';
        averageUtilization?: number;
        averageValue?: string;
        value?: string;
      };
    };
    pods?: {
      metric: {
        name: string;
        selector?: {
          matchLabels?: Record<string, string>;
        };
      };
      target: {
        type: 'AverageValue' | 'Value';
        averageValue?: string;
        value?: string;
      };
    };
    object?: {
      metric: {
        name: string;
        selector?: {
          matchLabels?: Record<string, string>;
        };
      };
      target: {
        type: 'Value' | 'AverageValue';
        value?: string;
        averageValue?: string;
      };
      describedObject: {
        apiVersion: string;
        kind: string;
        name: string;
      };
    };
    external?: {
      metric: {
        name: string;
        selector?: {
          matchLabels?: Record<string, string>;
        };
      };
      target: {
        type: 'Value' | 'AverageValue';
        value?: string;
        averageValue?: string;
      };
    };
  }>;
  /** Scaling behavior */
  behavior?: {
    scaleUp?: {
      stabilizationWindowSeconds?: number;
      policies?: Array<{
        type: 'Percent' | 'Pods';
        value: number;
        periodSeconds: number;
      }>;
    };
    scaleDown?: {
      stabilizationWindowSeconds?: number;
      policies?: Array<{
        type: 'Percent' | 'Pods';
        value: number;
        periodSeconds: number;
      }>;
    };
  };
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Vertical Pod Autoscaler specification
 * @since 2.7.0
 */
export interface VerticalPodAutoscalerSpec {
  /** Resource name */
  name: string;
  /** Target reference */
  targetRef: {
    apiVersion: string;
    kind: string;
    name: string;
  };
  /** Update policy */
  updatePolicy?: {
    updateMode?: 'Off' | 'Initial' | 'Recreation' | 'Auto';
  };
  /** Resource policy */
  resourcePolicy?: {
    containerPolicies?: Array<{
      containerName?: string;
      mode?: 'Auto' | 'Off';
      minAllowed?: Record<string, string>;
      maxAllowed?: Record<string, string>;
      controlledResources?: string[];
      controlledValues?: 'RequestsAndLimits' | 'RequestsOnly';
    }>;
  };
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * CronJob specification
 * @since 2.7.0
 */
export interface CronJobSpec {
  /** Resource name */
  name: string;
  /** Cron schedule */
  schedule: string;
  /** Job template */
  jobTemplate: {
    spec: {
      template: {
        metadata?: {
          labels?: Record<string, string>;
          annotations?: Record<string, string>;
        };
        spec: {
          containers: Array<{
            name: string;
            image: string;
            command?: string[];
            args?: string[];
            env?: Array<{
              name: string;
              value?: string;
              valueFrom?: {
                secretKeyRef?: {
                  name: string;
                  key: string;
                };
                configMapKeyRef?: {
                  name: string;
                  key: string;
                };
              };
            }>;
            resources?: {
              requests?: Record<string, string>;
              limits?: Record<string, string>;
            };
            volumeMounts?: Array<{
              name: string;
              mountPath: string;
              readOnly?: boolean;
            }>;
          }>;
          restartPolicy?: 'OnFailure' | 'Never';
          volumes?: Array<{
            name: string;
            configMap?: {
              name: string;
            };
            secret?: {
              secretName: string;
            };
            persistentVolumeClaim?: {
              claimName: string;
            };
          }>;
        };
      };
      backoffLimit?: number;
      activeDeadlineSeconds?: number;
      ttlSecondsAfterFinished?: number;
    };
  };
  /** Concurrency policy */
  concurrencyPolicy?: 'Allow' | 'Forbid' | 'Replace';
  /** Starting deadline seconds */
  startingDeadlineSeconds?: number;
  /** Suspend */
  suspend?: boolean;
  /** Successful jobs history limit */
  successfulJobsHistoryLimit?: number;
  /** Failed jobs history limit */
  failedJobsHistoryLimit?: number;
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Autoscaling resources provider for HPA, VPA, and CronJob
 * @extends BaseResourceProvider
 * @since 2.3.0
 */
export class AutoscalingResources extends BaseResourceProvider {
  /**
   * Creates a Horizontal Pod Autoscaler (HPA) resource
   * @param spec - HPA specification
   * @returns Created HPA ApiObject
   * @since 2.7.0
   */
  addHorizontalPodAutoscaler(spec: HorizontalPodAutoscalerSpec): ApiObject {
    const hpaSpec: Record<string, unknown> = {
      scaleTargetRef: spec.scaleTargetRef,
      maxReplicas: spec.maxReplicas,
    };

    if (spec.minReplicas !== undefined) {
      hpaSpec['minReplicas'] = spec.minReplicas;
    }

    if (spec.metrics) {
      hpaSpec['metrics'] = spec.metrics;
    }

    if (spec.behavior) {
      hpaSpec['behavior'] = spec.behavior;
    }

    return this.createApiObject(
      spec.name,
      'autoscaling/v2',
      'HorizontalPodAutoscaler',
      hpaSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Vertical Pod Autoscaler (VPA) resource
   * @param spec - VPA specification
   * @returns Created VPA ApiObject
   * @since 2.7.0
   */
  addVerticalPodAutoscaler(spec: VerticalPodAutoscalerSpec): ApiObject {
    const vpaSpec: Record<string, unknown> = {
      targetRef: spec.targetRef,
    };

    if (spec.updatePolicy) {
      vpaSpec['updatePolicy'] = spec.updatePolicy;
    }

    if (spec.resourcePolicy) {
      vpaSpec['resourcePolicy'] = spec.resourcePolicy;
    }

    return this.createApiObject(
      spec.name,
      'autoscaling.k8s.io/v1',
      'VerticalPodAutoscaler',
      vpaSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a CronJob resource
   * @param spec - CronJob specification
   * @returns Created CronJob ApiObject
   * @since 2.7.0
   */
  addCronJob(spec: CronJobSpec): ApiObject {
    const cronJobSpec: Record<string, unknown> = {
      schedule: spec.schedule,
      jobTemplate: spec.jobTemplate,
    };

    if (spec.concurrencyPolicy) {
      cronJobSpec['concurrencyPolicy'] = spec.concurrencyPolicy;
    }

    if (spec.startingDeadlineSeconds !== undefined) {
      cronJobSpec['startingDeadlineSeconds'] = spec.startingDeadlineSeconds;
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

    return this.createApiObject(
      spec.name,
      'batch/v1',
      'CronJob',
      cronJobSpec,
      spec.labels,
      spec.annotations,
    );
  }
}
