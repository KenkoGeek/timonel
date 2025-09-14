/**
 * @fileoverview Unit tests for Karpenter utilities and helpers
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_TERMINATION_GRACE_PERIOD,
  KarpenterVersionUtils,
  isValidDisruptionBudget,
  isValidKubernetesDuration,
  Rutter,
} from '../../src/index.js';

describe('KarpenterVersionUtils', () => {
  describe('isKarpenterV1Compatible', () => {
    it('should return true for v1 compatibility', () => {
      expect(KarpenterVersionUtils.isKarpenterV1Compatible()).toBe(true);
    });
  });

  describe('getNodePoolApiVersion', () => {
    it('should return v1 API version', () => {
      expect(KarpenterVersionUtils.getNodePoolApiVersion()).toBe('karpenter.sh/v1');
    });
  });

  describe('getNodeClaimApiVersion', () => {
    it('should return v1 API version', () => {
      expect(KarpenterVersionUtils.getNodeClaimApiVersion()).toBe('karpenter.sh/v1');
    });
  });
});

describe('isValidDisruptionBudget', () => {
  it('should validate percentage format', () => {
    expect(isValidDisruptionBudget({ nodes: '20%' })).toBe(true);
    expect(isValidDisruptionBudget({ nodes: '100%' })).toBe(true);
    expect(isValidDisruptionBudget({ nodes: '0%' })).toBe(true);
  });

  it('should validate absolute number format', () => {
    expect(isValidDisruptionBudget({ nodes: '5' })).toBe(true);
    expect(isValidDisruptionBudget({ nodes: '0' })).toBe(true);
    expect(isValidDisruptionBudget({ nodes: '100' })).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidDisruptionBudget({ nodes: 'invalid' })).toBe(false);
    expect(isValidDisruptionBudget({ nodes: '20percent' })).toBe(false);
    expect(isValidDisruptionBudget({ nodes: '%20' })).toBe(false);
    expect(isValidDisruptionBudget({ nodes: '' })).toBe(false);
  });

  it('should handle optional fields', () => {
    expect(
      isValidDisruptionBudget({
        nodes: '10%',
        schedule: '0 9 * * 1-5',
        duration: '8h',
      }),
    ).toBe(true);
  });
});

describe('isValidKubernetesDuration', () => {
  it('should validate hours format', () => {
    expect(isValidKubernetesDuration('1h')).toBe(true);
    expect(isValidKubernetesDuration('24h')).toBe(true);
  });

  it('should validate minutes format', () => {
    expect(isValidKubernetesDuration('30m')).toBe(true);
    expect(isValidKubernetesDuration('1m')).toBe(true);
  });

  it('should validate seconds format', () => {
    expect(isValidKubernetesDuration('30s')).toBe(true);
    expect(isValidKubernetesDuration('1s')).toBe(true);
  });

  it('should validate combined formats', () => {
    expect(isValidKubernetesDuration('1h30m')).toBe(true);
    expect(isValidKubernetesDuration('1h30s')).toBe(true);
    expect(isValidKubernetesDuration('30m45s')).toBe(true);
    expect(isValidKubernetesDuration('1h30m45s')).toBe(true);
  });

  it('should reject invalid formats', () => {
    expect(isValidKubernetesDuration('')).toBe(false);
    expect(isValidKubernetesDuration('invalid')).toBe(false);
    expect(isValidKubernetesDuration('1hour')).toBe(false);
    expect(isValidKubernetesDuration('30minutes')).toBe(false);
  });
});

describe('DEFAULT_TERMINATION_GRACE_PERIOD', () => {
  it('should have correct default value', () => {
    expect(DEFAULT_TERMINATION_GRACE_PERIOD).toBe('30s');
  });

  it('should be a valid Kubernetes duration', () => {
    expect(isValidKubernetesDuration(DEFAULT_TERMINATION_GRACE_PERIOD)).toBe(true);
  });
});

describe('Karpenter Helpers Integration', () => {
  let rutter: Rutter;

  beforeEach(() => {
    rutter = new Rutter({
      meta: { name: 'test-karpenter', version: '1.0.0' },
    });
  });

  describe('addKarpenterNodePoolWithDisruption', () => {
    it('should create NodePool with disruption settings', () => {
      const nodePool = rutter.addKarpenterNodePoolWithDisruption({
        name: 'cost-optimized',
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'default',
        },
        consolidationPolicy: 'WhenEmptyOrUnderutilized',
        consolidateAfter: '30s',
        expireAfter: '24h',
        disruptionBudgets: [{ nodes: '20%' }],
      });

      expect(nodePool.kind).toBe('NodePool');
      expect(nodePool.apiVersion).toBe('karpenter.sh/v1');
      expect(nodePool.metadata.name).toBe('cost-optimized');
    });

    it('should handle optional parameters', () => {
      const nodePool = rutter.addKarpenterNodePoolWithDisruption({
        name: 'minimal',
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'default',
        },
      });

      expect(nodePool.kind).toBe('NodePool');
      expect(nodePool.metadata.name).toBe('minimal');
    });
  });

  describe('addKarpenterNodePoolWithScheduling', () => {
    it('should create NodePool with scheduling constraints', () => {
      const nodePool = rutter.addKarpenterNodePoolWithScheduling({
        name: 'gpu-workloads',
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'gpu-nodeclass',
        },
        taints: [{ key: 'nvidia.com/gpu', effect: 'NoSchedule' }],
        terminationGracePeriod: '60s',
        weight: 100,
      });

      expect(nodePool.kind).toBe('NodePool');
      expect(nodePool.apiVersion).toBe('karpenter.sh/v1');
      expect(nodePool.metadata.name).toBe('gpu-workloads');
    });

    it('should validate terminationGracePeriod format', () => {
      expect(() => {
        rutter.addKarpenterNodePoolWithScheduling({
          name: 'invalid-grace',
          nodeClassRef: {
            apiVersion: 'karpenter.k8s.aws/v1beta1',
            kind: 'EC2NodeClass',
            name: 'default',
          },
          terminationGracePeriod: 'invalid',
        });
      }).toThrow('Invalid terminationGracePeriod format');
    });

    it('should use default terminationGracePeriod when not specified', () => {
      const nodePool = rutter.addKarpenterNodePoolWithScheduling({
        name: 'default-grace',
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'default',
        },
      });

      expect(nodePool.kind).toBe('NodePool');
      // The default should be applied internally
    });
  });

  describe('addKarpenterNodePool with version utils', () => {
    it('should use correct API version from utils', () => {
      const nodePool = rutter.addKarpenterNodePool({
        name: 'test-pool',
        template: {
          spec: {
            nodeClassRef: {
              apiVersion: 'karpenter.k8s.aws/v1beta1',
              kind: 'EC2NodeClass',
              name: 'default',
            },
          },
        },
      });

      expect(nodePool.apiVersion).toBe(KarpenterVersionUtils.getNodePoolApiVersion());
    });
  });

  describe('addKarpenterNodeClaim with version utils', () => {
    it('should use correct API version from utils', () => {
      const nodeClaim = rutter.addKarpenterNodeClaim({
        name: 'test-claim',
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'default',
        },
      });

      expect(nodeClaim.apiVersion).toBe(KarpenterVersionUtils.getNodeClaimApiVersion());
    });
  });
});
