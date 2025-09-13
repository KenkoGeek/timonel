/**
 * @fileoverview Karpenter resources for AWS EKS node management
 * @since 2.7.0
 */

import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../baseResourceProvider.js';

/**
 * Karpenter version compatibility utilities
 * @since 2.7.1
 */
export class KarpenterVersionUtils {
  /**
   * Checks if the current Karpenter version supports v1 API
   * @returns true if v1 API is supported, false otherwise
   */
  static isKarpenterV1Compatible(): boolean {
    // For now, we assume v1 compatibility since we're targeting Karpenter v1.6+
    // In the future, this could check actual cluster version
    return true;
  }

  /**
   * Gets the appropriate API version for NodePool resources
   * @returns API version string
   */
  static getNodePoolApiVersion(): string {
    return this.isKarpenterV1Compatible() ? 'karpenter.sh/v1' : 'karpenter.sh/v1beta1';
  }

  /**
   * Gets the appropriate API version for NodeClaim resources
   * @returns API version string
   */
  static getNodeClaimApiVersion(): string {
    return this.isKarpenterV1Compatible() ? 'karpenter.sh/v1' : 'karpenter.sh/v1beta1';
  }
}

/**
 * Karpenter Disruption Budget specification
 * @since 2.7.1
 */
export interface KarpenterDisruptionBudget {
  /** Number or percentage of nodes that can be disrupted */
  nodes: string;
  /** Cron schedule for when budget applies (optional) */
  schedule?: string;
  /** Duration the budget is active (optional) */
  duration?: string;
}

/**
 * Validates a KarpenterDisruptionBudget configuration
 * @param budget - The budget to validate
 * @returns true if valid, false otherwise
 * @since 2.7.1
 */
export function isValidDisruptionBudget(budget: KarpenterDisruptionBudget): boolean {
  const nodePattern = /^(\d+%|\d+)$/;
  return nodePattern.test(budget.nodes);
}

/**
 * Validates Kubernetes duration format
 * @param duration - Duration string to validate
 * @returns true if valid, false otherwise
 * @since 2.7.1
 */
export function isValidKubernetesDuration(duration: string): boolean {
  // eslint-disable-next-line security/detect-unsafe-regex
  const durationPattern = /^(\d+h)?(\d+m)?(\d+s)?$/;
  return durationPattern.test(duration) && duration.length > 0;
}

/**
 * Default termination grace period for Karpenter nodes
 * @since 2.7.1
 */
export const DEFAULT_TERMINATION_GRACE_PERIOD = '30s';

/**
 * Karpenter Disruption specification
 * @since 2.7.1
 */
export interface KarpenterDisruption {
  /** Consolidation policy */
  consolidationPolicy?: 'WhenEmpty' | 'WhenEmptyOrUnderutilized';
  /** Time to wait before consolidating */
  consolidateAfter?: string;
  /** Node expiration time */
  expireAfter?: string;
  /** Disruption budgets for rate limiting */
  budgets?: KarpenterDisruptionBudget[];
}

/**
 * Karpenter NodePool specification
 * @since 2.7.0
 */
export interface KarpenterNodePoolSpec {
  /** Resource name */
  name: string;
  /** Template for nodes */
  template: {
    metadata?: {
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    };
    spec: {
      /** Node class reference */
      nodeClassRef: {
        apiVersion: string;
        kind: string;
        name: string;
      };
      /** Node requirements */
      requirements?: Array<{
        key: string;
        operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
        values?: string[];
      }>;
      /** Taints to apply to nodes */
      taints?: Array<{
        key: string;
        value?: string;
        effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
      }>;
      /** Startup taints */
      startupTaints?: Array<{
        key: string;
        value?: string;
        effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
      }>;
      /** Termination grace period */
      terminationGracePeriod?: string;
    };
  };
  /** Disruption settings */
  disruption?: KarpenterDisruption;
  /** Resource limits */
  limits?: Record<string, string>;
  /** Resource weight for scheduling priority */
  weight?: number;
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Karpenter NodeClaim specification
 * @since 2.7.0
 */
export interface KarpenterNodeClaimSpec {
  /** Resource name */
  name: string;
  /** Node class reference */
  nodeClassRef: {
    apiVersion: string;
    kind: string;
    name: string;
  };
  /** Node requirements */
  requirements?: Array<{
    key: string;
    operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
    values?: string[];
  }>;
  /** Taints to apply to node */
  taints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  /** Startup taints */
  startupTaints?: Array<{
    key: string;
    value?: string;
    effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
  }>;
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Karpenter EC2NodeClass specification
 * @since 2.7.0
 */
export interface KarpenterEC2NodeClassSpec {
  /** Resource name */
  name: string;
  /** AMI family */
  amiFamily?:
    | 'AL2'
    | 'AL2023'
    | 'Bottlerocket'
    | 'Ubuntu'
    | 'Windows2019'
    | 'Windows2022'
    | 'Custom';
  /** AMI selector */
  amiSelectorTerms?: Array<{
    tags?: Record<string, string>;
    id?: string;
    name?: string;
    owner?: string;
  }>;
  /** Instance store policy */
  instanceStorePolicy?: 'RAID0' | 'NVME';
  /** Instance profile */
  instanceProfile?: string;
  /** Security group selector */
  securityGroupSelectorTerms?: Array<{
    tags?: Record<string, string>;
    id?: string;
    name?: string;
  }>;
  /** Subnet selector */
  subnetSelectorTerms?: Array<{
    tags?: Record<string, string>;
    id?: string;
  }>;
  /** User data */
  userData?: string;
  /** Role */
  role?: string;
  /** Tags to apply to instances */
  tags?: Record<string, string>;
  /** Block device mappings */
  blockDeviceMappings?: Array<{
    deviceName: string;
    ebs?: {
      volumeSize?: string;
      volumeType?: 'gp2' | 'gp3' | 'io1' | 'io2' | 'sc1' | 'st1';
      iops?: number;
      throughput?: number;
      encrypted?: boolean;
      kmsKeyId?: string;
      deleteOnTermination?: boolean;
    };
  }>;
  /** Metadata options */
  metadataOptions?: {
    httpEndpoint?: 'enabled' | 'disabled';
    httpProtocolIPv6?: 'enabled' | 'disabled';
    httpPutResponseHopLimit?: number;
    httpTokens?: 'required' | 'optional';
  };
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Karpenter resources provider for AWS EKS node management
 * @extends BaseResourceProvider
 * @since 2.7.0
 */
export class KarpenterResources extends BaseResourceProvider {
  /**
   * Creates a Karpenter NodePool resource
   * @param spec - NodePool specification
   * @returns Created NodePool ApiObject
   * @since 2.7.0
   */
  addKarpenterNodePool(spec: KarpenterNodePoolSpec): ApiObject {
    const nodePoolSpec: Record<string, unknown> = {
      template: spec.template,
    };

    if (spec.disruption) {
      nodePoolSpec['disruption'] = spec.disruption;
    }

    if (spec.limits) {
      nodePoolSpec['limits'] = spec.limits;
    }

    if (spec.weight !== undefined) {
      nodePoolSpec['weight'] = spec.weight;
    }

    return this.createApiObject(
      spec.name,
      KarpenterVersionUtils.getNodePoolApiVersion(),
      'NodePool',
      nodePoolSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Karpenter NodeClaim resource
   * @param spec - NodeClaim specification
   * @returns Created NodeClaim ApiObject
   * @since 2.7.0
   */
  addKarpenterNodeClaim(spec: KarpenterNodeClaimSpec): ApiObject {
    const nodeClaimSpec: Record<string, unknown> = {
      nodeClassRef: spec.nodeClassRef,
    };

    if (spec.requirements) {
      nodeClaimSpec['requirements'] = spec.requirements;
    }

    if (spec.taints) {
      nodeClaimSpec['taints'] = spec.taints;
    }

    if (spec.startupTaints) {
      nodeClaimSpec['startupTaints'] = spec.startupTaints;
    }

    return this.createApiObject(
      spec.name,
      KarpenterVersionUtils.getNodeClaimApiVersion(),
      'NodeClaim',
      nodeClaimSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Karpenter EC2NodeClass resource
   * @param spec - EC2NodeClass specification
   * @returns Created EC2NodeClass ApiObject
   * @since 2.7.0
   */
  addKarpenterEC2NodeClass(spec: KarpenterEC2NodeClassSpec): ApiObject {
    const nodeClassSpec: Record<string, unknown> = {};

    if (spec.amiFamily) {
      nodeClassSpec['amiFamily'] = spec.amiFamily;
    }

    if (spec.amiSelectorTerms) {
      nodeClassSpec['amiSelectorTerms'] = spec.amiSelectorTerms;
    }

    if (spec.instanceStorePolicy) {
      nodeClassSpec['instanceStorePolicy'] = spec.instanceStorePolicy;
    }

    if (spec.instanceProfile) {
      nodeClassSpec['instanceProfile'] = spec.instanceProfile;
    }

    if (spec.securityGroupSelectorTerms) {
      nodeClassSpec['securityGroupSelectorTerms'] = spec.securityGroupSelectorTerms;
    }

    if (spec.subnetSelectorTerms) {
      nodeClassSpec['subnetSelectorTerms'] = spec.subnetSelectorTerms;
    }

    if (spec.userData) {
      nodeClassSpec['userData'] = spec.userData;
    }

    if (spec.role) {
      nodeClassSpec['role'] = spec.role;
    }

    if (spec.tags) {
      nodeClassSpec['tags'] = spec.tags;
    }

    if (spec.blockDeviceMappings) {
      nodeClassSpec['blockDeviceMappings'] = spec.blockDeviceMappings;
    }

    if (spec.metadataOptions) {
      nodeClassSpec['metadataOptions'] = spec.metadataOptions;
    }

    return this.createApiObject(
      spec.name,
      'karpenter.k8s.aws/v1beta1',
      'EC2NodeClass',
      nodeClassSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Karpenter NodePool with optimized disruption settings for cost efficiency
   * @param spec - NodePool specification with disruption optimization
   * @returns Created NodePool ApiObject
   * @since 2.7.1
   */
  addKarpenterNodePoolWithDisruption(spec: {
    name: string;
    nodeClassRef: { apiVersion: string; kind: string; name: string };
    requirements?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
      values?: string[];
    }>;
    consolidationPolicy?: 'WhenEmpty' | 'WhenEmptyOrUnderutilized';
    consolidateAfter?: string;
    expireAfter?: string;
    disruptionBudgets?: KarpenterDisruptionBudget[];
    limits?: Record<string, string>;
    weight?: number;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): ApiObject {
    const disruption: KarpenterDisruption = {};

    if (spec.consolidationPolicy) {
      disruption.consolidationPolicy = spec.consolidationPolicy;
    }

    if (spec.consolidateAfter) {
      disruption.consolidateAfter = spec.consolidateAfter;
    }

    if (spec.expireAfter) {
      disruption.expireAfter = spec.expireAfter;
    }

    if (spec.disruptionBudgets) {
      disruption.budgets = spec.disruptionBudgets;
    }

    const templateSpec: Record<string, unknown> = {
      nodeClassRef: spec.nodeClassRef,
    };

    if (spec.requirements) {
      templateSpec['requirements'] = spec.requirements;
    }

    const nodePoolConfig: Record<string, unknown> = {
      name: spec.name,
      template: {
        spec: templateSpec,
      },
      disruption,
    };

    if (spec.limits) {
      nodePoolConfig['limits'] = spec.limits;
    }

    if (spec.weight !== undefined) {
      nodePoolConfig['weight'] = spec.weight;
    }

    if (spec.labels) {
      nodePoolConfig['labels'] = spec.labels;
    }

    if (spec.annotations) {
      nodePoolConfig['annotations'] = spec.annotations;
    }

    return this.addKarpenterNodePool(nodePoolConfig as unknown as KarpenterNodePoolSpec);
  }

  /**
   * Creates a Karpenter NodePool with scheduling constraints and priorities
   * @param spec - NodePool specification with scheduling optimization
   * @returns Created NodePool ApiObject
   * @since 2.7.1
   */
  addKarpenterNodePoolWithScheduling(spec: {
    name: string;
    nodeClassRef: { apiVersion: string; kind: string; name: string };
    requirements?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist' | 'Gt' | 'Lt';
      values?: string[];
    }>;
    taints?: Array<{
      key: string;
      value?: string;
      effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    }>;
    startupTaints?: Array<{
      key: string;
      value?: string;
      effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
    }>;
    terminationGracePeriod?: string;
    weight?: number;
    limits?: Record<string, string>;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
  }): ApiObject {
    const templateSpec: Record<string, unknown> = {
      nodeClassRef: spec.nodeClassRef,
    };

    if (spec.requirements) {
      templateSpec['requirements'] = spec.requirements;
    }

    if (spec.taints) {
      templateSpec['taints'] = spec.taints;
    }

    if (spec.startupTaints) {
      templateSpec['startupTaints'] = spec.startupTaints;
    }

    if (spec.terminationGracePeriod) {
      if (!isValidKubernetesDuration(spec.terminationGracePeriod)) {
        throw new Error(
          `Invalid terminationGracePeriod format: "${spec.terminationGracePeriod}". Use Kubernetes duration format (e.g., "30s", "1m30s", "1h")`,
        );
      }
      templateSpec['terminationGracePeriod'] = spec.terminationGracePeriod;
    } else {
      templateSpec['terminationGracePeriod'] = DEFAULT_TERMINATION_GRACE_PERIOD;
    }

    const nodePoolConfig: Record<string, unknown> = {
      name: spec.name,
      template: {
        spec: templateSpec,
      },
    };

    if (spec.weight !== undefined) {
      nodePoolConfig['weight'] = spec.weight;
    }

    if (spec.limits) {
      nodePoolConfig['limits'] = spec.limits;
    }

    if (spec.labels) {
      nodePoolConfig['labels'] = spec.labels;
    }

    if (spec.annotations) {
      nodePoolConfig['annotations'] = spec.annotations;
    }

    return this.addKarpenterNodePool(nodePoolConfig as unknown as KarpenterNodePoolSpec);
  }
}
