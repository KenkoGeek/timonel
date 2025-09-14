import { Rutter } from '../../src/lib/rutter';

export function createUnifiedKarpenterFixture(): Rutter {
  const chart = new Rutter({
    meta: {
      name: 'unified-karpenter-chart',
      version: '0.1.0',
    },
  });

  // EC2NodeClass for Karpenter
  chart.addKarpenterEC2NodeClass({
    name: 'test-nodeclass',
    amiFamily: 'AL2023',
    instanceProfile: 'KarpenterNodeInstanceProfile',
    securityGroupSelectorTerms: [
      {
        tags: {
          'karpenter.sh/discovery': 'test-cluster',
        },
      },
    ],
    subnetSelectorTerms: [
      {
        tags: {
          'karpenter.sh/discovery': 'test-cluster',
        },
      },
    ],
    userData: `#!/bin/bash
/etc/eks/bootstrap.sh test-cluster
`,
    tags: {
      Environment: 'test',
      Application: 'unified-karpenter',
    },
  });

  // NodePool for Karpenter
  chart.addKarpenterNodePool({
    name: 'test-nodepool',
    template: {
      spec: {
        nodeClassRef: {
          apiVersion: 'karpenter.k8s.aws/v1beta1',
          kind: 'EC2NodeClass',
          name: 'test-nodeclass',
        },
        requirements: [
          {
            key: 'kubernetes.io/arch',
            operator: 'In',
            values: ['amd64'],
          },
          {
            key: 'karpenter.sh/capacity-type',
            operator: 'In',
            values: ['spot', 'on-demand'],
          },
          {
            key: 'node.kubernetes.io/instance-type',
            operator: 'In',
            values: ['t3.medium', 't3.large'],
          },
        ],
      },
    },
    disruption: {
      consolidationPolicy: 'WhenEmptyOrUnderutilized',
      consolidateAfter: '30s',
      expireAfter: '24h',
    },
    limits: {
      cpu: '1000',
      memory: '1000Gi',
    },
    weight: 10,
  });

  // NodeClaim for Karpenter
  chart.addKarpenterNodeClaim({
    name: 'test-nodeclaim',
    nodeClassRef: {
      apiVersion: 'karpenter.k8s.aws/v1beta1',
      kind: 'EC2NodeClass',
      name: 'test-nodeclass',
    },
    requirements: [
      {
        key: 'kubernetes.io/arch',
        operator: 'In',
        values: ['amd64'],
      },
      {
        key: 'node.kubernetes.io/instance-type',
        operator: 'In',
        values: ['t3.medium'],
      },
    ],
  });

  // DisruptionBudget using addManifest
  chart.addManifest(
    {
      apiVersion: 'policy/v1',
      kind: 'PodDisruptionBudget',
      metadata: {
        name: 'test-disruption-budget',
        labels: {
          app: 'unified-karpenter',
          'helm.sh/chart': 'test-chart',
        },
      },
      spec: {
        minAvailable: 1,
        selector: {
          matchLabels: {
            app: 'unified-karpenter',
          },
        },
      },
    },
    'test-disruption-budget',
  );

  // Legacy Provisioner for compatibility testing
  chart.addManifest(
    `
apiVersion: karpenter.sh/v1beta1
kind: Provisioner
metadata:
  name: test-karpenter-provisioner
  labels:
    app: test-karpenter-provisioner
    helm.sh/chart: test-chart
spec:
  requirements:
  - key: kubernetes.io/arch
    operator: In
    values: [amd64]
  - key: kubernetes.io/os
    operator: In
    values: [linux]
  limits:
    resources:
      cpu: '1000'
  providerRef:
    name: test-karpenter-provider
  ttlSecondsAfterEmpty: 30
`,
    'test-karpenter-provisioner',
  );

  return chart;
}
