/**
 * @fileoverview Karpenter resources for AWS EKS node management
 * @since 2.7.0
 */

import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../../baseResourceProvider.js';

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
    };
  };
  /** Disruption settings */
  disruption?: {
    consolidationPolicy?: 'WhenEmpty' | 'WhenUnderutilized';
    consolidateAfter?: string;
    expireAfter?: string;
  };
  /** Resource limits */
  limits?: Record<string, string>;
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

    return this.createApiObject(
      spec.name,
      'karpenter.sh/v1',
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
      'karpenter.sh/v1',
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
}
