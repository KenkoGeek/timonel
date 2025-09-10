import { Rutter, valuesRef } from 'timonel';

const rutter = new Rutter({
  meta: {
    name: 'wordpress',
    version: '1.0.0',
    description: 'WordPress deployment with MySQL database',
    appVersion: '6.4.0',
    keywords: ['wordpress', 'cms', 'mysql', 'blog'],
  },
  manifestName: 'wordpress-app',
  singleManifestFile: true,
  defaultValues: {
    wordpress: {
      image: 'wordpress:6.4.0-apache',
      replicas: 2,
      resources: {
        requests: {
          cpu: '200m',
          memory: '256Mi',
        },
      },
      autoscaling: {
        enabled: true,
        minReplicas: 1,
        maxReplicas: 10,
        targetCPUUtilizationPercentage: 70,
        targetMemoryUtilizationPercentage: 80,
      },
    },
    mysql: {
      image: 'mysql:8.0',
      rootPassword: 'changeme123',
      database: 'wordpress',
      user: 'wpuser',
      password: 'wppass123',
      storage: '10Gi',
    },
    service: {
      type: 'LoadBalancer',
      port: 80,
    },
  },
  envValues: {
    dev: {
      wordpress: { replicas: 1 },
      mysql: { storage: '5Gi' },
    },
    staging: {
      wordpress: { replicas: 2 },
      mysql: { storage: '8Gi' },
    },
    prod: {
      wordpress: { replicas: 3 },
      mysql: { storage: '20Gi' },
    },
  },
});

// MySQL Secret
rutter.addSecret({
  name: 'mysql-secret',
  data: {
    'mysql-root-password': '{{ .Values.mysql.rootPassword | b64enc }}',
    'mysql-password': '{{ .Values.mysql.password | b64enc }}',
  },
});

// AWS EBS StorageClass for MySQL
rutter.addAWSEBSStorageClass({
  name: 'mysql-ebs-gp3',
  volumeType: 'gp3',
  fsType: 'ext4',
  encrypted: true,
  allowVolumeExpansion: true,
  volumeBindingMode: 'WaitForFirstConsumer',
});

// MySQL PersistentVolumeClaim using EBS
rutter.addAWSEBSPersistentVolumeClaim({
  name: 'mysql-pvc',
  storageClassName: 'mysql-ebs-gp3',
  size: valuesRef('mysql.storage') as string,
  accessModes: ['ReadWriteOnce'],
});

// MySQL Deployment
rutter.addDeployment({
  name: 'mysql-db',
  image: valuesRef('mysql.image') as string,
  replicas: 1,
  containerPort: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: 'changeme123',
    MYSQL_DATABASE: valuesRef('mysql.database') as string,
    MYSQL_USER: valuesRef('mysql.user') as string,
    MYSQL_PASSWORD: 'wppass123',
  },
  volumeMounts: [
    {
      name: 'mysql-storage',
      mountPath: '/var/lib/mysql',
    },
  ],
  volumes: [
    {
      name: 'mysql-storage',
      persistentVolumeClaim: 'mysql-pvc',
    },
  ],
});

// MySQL Service
rutter.addService({
  name: 'mysql-service',
  ports: [
    {
      port: 3306,
      targetPort: 3306,
      protocol: 'TCP',
    },
  ],
  selector: {
    app: 'mysql-db',
  },
});

// WordPress Deployment
const WORDPRESS_APP_NAME = 'wordpress-app';
const NETWORK_POLICY_LABELS = {
  app: 'wordpress',
  component: 'network-policy',
};
rutter.addDeployment({
  name: WORDPRESS_APP_NAME,
  image: valuesRef('wordpress.image') as string,
  replicas: 1,
  containerPort: 80,
  env: {
    WORDPRESS_DB_HOST: 'mysql-service:3306',
    WORDPRESS_DB_NAME: valuesRef('mysql.database') as string,
    WORDPRESS_DB_USER: valuesRef('mysql.user') as string,
    WORDPRESS_DB_PASSWORD: 'wppass123',
  },
  resources: {
    requests: {
      cpu: valuesRef('wordpress.resources.requests.cpu') as string,
      memory: valuesRef('wordpress.resources.requests.memory') as string,
    },
  },
});

// WordPress Service
rutter.addService({
  name: 'wordpress-service',
  type: valuesRef('service.type') as 'LoadBalancer' | 'ClusterIP' | 'NodePort' | 'ExternalName',
  ports: [
    {
      port: 80,
      targetPort: 80,
      protocol: 'TCP',
    },
  ],
  selector: {
    app: WORDPRESS_APP_NAME,
  },
});

// WordPress HorizontalPodAutoscaler
const UTILIZATION_TYPE = 'Utilization' as const;
rutter.addHorizontalPodAutoscaler({
  name: 'wordpress-hpa',
  scaleTargetRef: {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    name: WORDPRESS_APP_NAME,
  },
  minReplicas: 1,
  maxReplicas: 10,
  metrics: [
    {
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: UTILIZATION_TYPE,
          averageUtilization: 70,
        },
      },
    },
    {
      type: 'Resource',
      resource: {
        name: 'memory',
        target: {
          type: UTILIZATION_TYPE,
          averageUtilization: 80,
        },
      },
    },
  ],
  behavior: {
    scaleUp: {
      stabilizationWindowSeconds: 60,
      policies: [
        {
          type: 'Percent',
          value: 100,
          periodSeconds: 15,
        },
        {
          type: 'Pods',
          value: 2,
          periodSeconds: 60,
        },
      ],
      selectPolicy: 'Max',
    },
    scaleDown: {
      stabilizationWindowSeconds: 300,
      policies: [
        {
          type: 'Percent',
          value: 10,
          periodSeconds: 60,
        },
      ],
    },
  },
});

// WordPress VerticalPodAutoscaler
rutter.addVerticalPodAutoscaler({
  name: 'wordpress-vpa',
  targetRef: {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    name: WORDPRESS_APP_NAME,
  },
  updatePolicy: {
    updateMode: 'Auto',
  },
  resourcePolicy: {
    containerPolicies: [
      {
        containerName: WORDPRESS_APP_NAME,
        mode: 'Auto',
        minAllowed: {
          cpu: '100m',
          memory: '128Mi',
        },
        maxAllowed: {
          cpu: '1000m',
          memory: '2Gi',
        },
        controlledResources: ['cpu', 'memory'],
        controlledValues: 'RequestsAndLimits',
      },
    ],
  },
});

// WordPress PodDisruptionBudget
rutter.addPodDisruptionBudget({
  name: 'wordpress-pdb',
  minAvailable: 1,
  selector: {
    matchLabels: {
      app: WORDPRESS_APP_NAME,
    },
  },
});

// AWS EFS StorageClass for shared storage
rutter.addAWSEFSStorageClass({
  name: 'wordpress-efs',
  reclaimPolicy: 'Retain',
  volumeBindingMode: 'Immediate',
});

// EFS PVC for WordPress uploads (shared across pods)
rutter.addAWSEFSPersistentVolumeClaim({
  name: 'wordpress-uploads-pvc',
  storageClassName: 'wordpress-efs',
  size: '10Gi',
  accessModes: ['ReadWriteMany'],
});

// AWS IRSA ServiceAccount for WordPress (S3 access)
rutter.addAWSIRSAServiceAccount({
  name: 'wordpress-s3-sa',
  roleArn: 'arn:aws:iam::123456789012:role/WordPressS3Role',
  audience: 'sts.amazonaws.com',
  stsEndpointType: 'regional',
  tokenExpiration: 3600,
  labels: {
    app: 'wordpress',
    component: 's3-access',
  },
});

// General ServiceAccount with IRSA support
rutter.addServiceAccount({
  name: 'wordpress-app-sa',
  awsRoleArn: 'arn:aws:iam::123456789012:role/WordPressAppRole',
  awsAudience: 'sts.amazonaws.com',
  awsStsEndpointType: 'regional',
  awsTokenExpiration: 7200,
  automountServiceAccountToken: true,
  labels: {
    app: 'wordpress',
    component: 'application',
  },
});

// AWS SecretProviderClass for Secrets Manager
rutter.addAWSSecretProviderClass({
  name: 'wordpress-secrets',
  region: 'us-west-2',
  objects: [
    {
      objectName: 'wordpress/database/credentials',
      objectType: 'secretsmanager',
      objectAlias: 'db-credentials',
    },
    {
      objectName: 'wordpress/api/keys',
      objectType: 'secretsmanager',
      jmesPath: '["api_key", "secret_key"]',
    },
  ],
  labels: {
    app: 'wordpress',
    component: 'secrets',
  },
});

// AWS SecretProviderClass for Parameter Store
rutter.addAWSSecretProviderClass({
  name: 'wordpress-config',
  region: 'us-west-2',
  objects: [
    {
      objectName: '/wordpress/config/debug',
      objectType: 'ssmparameter',
      objectAlias: 'wp-debug',
    },
    {
      objectName: '/wordpress/config/cache-timeout',
      objectType: 'ssmparameter',
      objectAlias: 'cache-timeout',
    },
  ],
  labels: {
    app: 'wordpress',
    component: 'config',
  },
});

// AWS ALB Ingress for WordPress
rutter.addAWSALBIngress({
  name: 'wordpress-ingress',
  scheme: 'internet-facing',
  targetType: 'ip',
  healthCheckPath: '/',
  healthCheckIntervalSeconds: 30,
  healthyThresholdCount: 2,
  unhealthyThresholdCount: 3,
  tags: {
    Environment: 'production',
    Application: 'wordpress',
  },
  rules: [
    {
      paths: [
        {
          path: '/',
          pathType: 'Prefix',
          backend: {
            service: {
              name: 'wordpress-service',
              port: { number: 80 },
            },
          },
        },
      ],
    },
  ],
});

// Network Security Policies - Zero Trust Implementation
// Deny all traffic by default (both ingress and egress)
rutter.addDenyAllNetworkPolicy('default-deny-all');

// Allow WordPress to access MySQL database
rutter.addAllowFromPodsNetworkPolicy({
  name: 'allow-wordpress-to-mysql',
  targetPodSelector: { app: 'mysql-db' },
  sourcePodSelector: { app: WORDPRESS_APP_NAME },
  ports: [{ protocol: 'TCP', port: 3306 }],
  labels: NETWORK_POLICY_LABELS,
});

// Allow external traffic to WordPress (from ALB)
rutter.addNetworkPolicy({
  name: 'allow-external-to-wordpress',
  podSelector: { matchLabels: { app: WORDPRESS_APP_NAME } },
  policyTypes: ['Ingress'],
  ingress: [
    {
      ports: [{ protocol: 'TCP', port: 80 }],
    },
  ],
  labels: NETWORK_POLICY_LABELS,
});

// Strict egress policy for WordPress - only allow necessary outbound traffic
rutter.addNetworkPolicy({
  name: 'wordpress-egress-policy',
  podSelector: { matchLabels: { app: WORDPRESS_APP_NAME } },
  policyTypes: ['Egress'],
  egress: [
    // Allow access to MySQL database
    {
      to: [{ podSelector: { matchLabels: { app: 'mysql-db' } } }],
      ports: [{ protocol: 'TCP', port: 3306 }],
    },
    // Allow DNS resolution
    {
      to: [{ namespaceSelector: { matchLabels: { name: 'kube-system' } } }],
      ports: [
        { protocol: 'UDP', port: 53 },
        { protocol: 'TCP', port: 53 },
      ],
    },
    // Allow HTTPS to external services (WordPress updates, plugins)
    {
      to: [
        {
          ipBlock: { cidr: '0.0.0.0/0', except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] },
        },
      ],
      ports: [{ protocol: 'TCP', port: 443 }],
    },
    // Allow HTTP to external services (if needed)
    {
      to: [
        {
          ipBlock: { cidr: '0.0.0.0/0', except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'] },
        },
      ],
      ports: [{ protocol: 'TCP', port: 80 }],
    },
  ],
  labels: NETWORK_POLICY_LABELS,
});

// Strict egress policy for MySQL - minimal outbound access
rutter.addNetworkPolicy({
  name: 'mysql-egress-policy',
  podSelector: { matchLabels: { app: 'mysql-db' } },
  policyTypes: ['Egress'],
  egress: [
    // Allow DNS resolution only
    {
      to: [{ namespaceSelector: { matchLabels: { name: 'kube-system' } } }],
      ports: [
        { protocol: 'UDP', port: 53 },
        { protocol: 'TCP', port: 53 },
      ],
    },
  ],
  labels: NETWORK_POLICY_LABELS,
});

// Database migration Job (one-time)
rutter.addJob({
  name: 'wordpress-db-migration',
  image: 'wordpress:6.4.0-cli',
  command: ['wp'],
  args: ['core', 'update-db'],
  env: {
    WORDPRESS_DB_HOST: 'mysql-service:3306',
    WORDPRESS_DB_NAME: 'wordpress',
    WORDPRESS_DB_USER: 'wpuser',
    WORDPRESS_DB_PASSWORD: 'wppass123',
  },
  restartPolicy: 'OnFailure',
  backoffLimit: 3,
  activeDeadlineSeconds: 600,
  ttlSecondsAfterFinished: 86400,
  labels: {
    app: 'wordpress',
    component: 'migration',
  },
});

// WordPress backup CronJob (scheduled)
rutter.addCronJob({
  name: 'wordpress-backup',
  schedule: '0 2 * * *', // Daily at 2 AM
  image: 'wordpress:6.4.0-cli',
  command: ['wp'],
  args: ['db', 'export', '/backup/wordpress-backup.sql'],
  env: {
    WORDPRESS_DB_HOST: 'mysql-service:3306',
    WORDPRESS_DB_NAME: 'wordpress',
    WORDPRESS_DB_USER: 'wpuser',
    WORDPRESS_DB_PASSWORD: 'wppass123',
  },
  restartPolicy: 'OnFailure',
  concurrencyPolicy: 'Forbid',
  successfulJobsHistoryLimit: 3,
  failedJobsHistoryLimit: 1,
  labels: {
    app: 'wordpress',
    component: 'backup',
  },
});

// Karpenter EC2 NodeClass for WordPress workloads
rutter.addKarpenterEC2NodeClass({
  name: 'wordpress-nodeclass',
  amiFamily: 'AL2023',
  instanceStorePolicy: 'NVME',
  subnetSelectorTerms: [
    {
      tags: {
        'karpenter.sh/discovery': 'wordpress-cluster',
        'kubernetes.io/role/internal-elb': '1',
      },
    },
  ],
  securityGroupSelectorTerms: [
    {
      tags: {
        'karpenter.sh/discovery': 'wordpress-cluster',
      },
    },
  ],
  role: 'KarpenterNodeInstanceProfile',
  metadataOptions: {
    httpEndpoint: 'enabled',
    httpProtocolIPv6: 'disabled',
    httpPutResponseHopLimit: 2,
    httpTokens: 'required',
  },
  blockDeviceMappings: [
    {
      deviceName: '/dev/xvda',
      ebs: {
        volumeSize: '100',
        volumeType: 'gp3',
        encrypted: true,
        deleteOnTermination: true,
        iops: 3000,
        throughput: 125,
      },
    },
  ],
  tags: {
    Environment: 'production',
    Application: 'wordpress',
    ManagedBy: 'karpenter',
  },
  labels: {
    'karpenter.sh/nodeclass': 'wordpress',
  },
});

// Karpenter NodePool for general WordPress workloads
rutter.addKarpenterNodePool({
  name: 'wordpress-general',
  requirements: [
    {
      key: 'eks.amazonaws.com/instance-category',
      operator: 'In',
      values: ['c', 'm', 'r'],
    },
    {
      key: 'eks.amazonaws.com/instance-cpu',
      operator: 'In',
      values: ['4', '8', '16'],
    },
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
  ],
  limits: {
    cpu: '1000',
    memory: '1000Gi',
  },
  disruption: {
    consolidationPolicy: 'WhenUnderutilized',
    consolidateAfter: '30s',
    expireAfter: '2160h', // 90 days
  },
  nodeClassRef: {
    name: 'wordpress-nodeclass',
  },
  taints: [
    {
      key: 'wordpress.example.com/workload',
      value: 'web',
      effect: 'NoSchedule',
    },
  ],
  labels: {
    'karpenter.sh/nodepool': 'wordpress-general',
    app: 'wordpress',
  },
});

// Karpenter NodePool for database workloads (performance optimized)
const databaseDisruption = rutter.createKarpenterDisruption({
  consolidationPolicy: 'WhenEmpty', // Conservative for database
  consolidateAfter: '300s',
  expireAfter: '4320h', // 180 days
  budgets: [
    {
      schedule: '0 9 * * mon-fri', // Business hours weekdays
      duration: '8h',
      nodes: '0', // No disruption during business hours
      reasons: ['Underutilized', 'Empty'],
    },
    {
      schedule: '0 2 * * sat', // Saturday maintenance window
      duration: '4h',
      nodes: '50%', // Allow up to 50% disruption during maintenance
      reasons: ['Underutilized', 'Empty', 'Drifted'],
    },
  ],
});

rutter.addKarpenterNodePool({
  name: 'wordpress-database',
  requirements: [
    {
      key: 'eks.amazonaws.com/instance-category',
      operator: 'In',
      values: ['r', 'm'], // Memory optimized for database
    },
    {
      key: 'eks.amazonaws.com/instance-cpu',
      operator: 'In',
      values: ['8', '16', '32'],
    },
    {
      key: 'kubernetes.io/arch',
      operator: 'In',
      values: ['amd64'],
    },
    {
      key: 'karpenter.sh/capacity-type',
      operator: 'In',
      values: ['on-demand'], // On-demand for database stability
    },
  ],
  limits: {
    cpu: '500',
    memory: '500Gi',
  },
  disruption: databaseDisruption,
  nodeClassRef: {
    name: 'wordpress-nodeclass',
  },
  taints: [
    {
      key: 'wordpress.example.com/workload',
      value: 'database',
      effect: 'NoSchedule',
    },
  ],
  labels: {
    'karpenter.sh/nodepool': 'wordpress-database',
    app: 'wordpress',
    component: 'database',
  },
});

// Karpenter NodeClaim for dedicated high-performance node
rutter.addKarpenterNodeClaim({
  name: 'wordpress-dedicated-node',
  requirements: [
    {
      key: 'eks.amazonaws.com/instance-category',
      operator: 'In',
      values: ['c'], // Compute optimized
    },
    {
      key: 'eks.amazonaws.com/instance-cpu',
      operator: 'In',
      values: ['16', '32'],
    },
    {
      key: 'karpenter.sh/capacity-type',
      operator: 'In',
      values: ['on-demand'],
    },
  ],
  nodeClassRef: {
    name: 'wordpress-nodeclass',
  },
  taints: [
    {
      key: 'wordpress.example.com/dedicated',
      value: 'true',
      effect: 'NoSchedule',
    },
  ],
  startupTaints: [
    {
      key: 'node.cilium.io/agent-not-ready',
      value: 'true',
      effect: 'NoExecute',
    },
  ],
  expireAfter: '168h', // 7 days
  terminationGracePeriod: '30s',
  labels: {
    'karpenter.sh/nodeclaim': 'wordpress-dedicated',
    app: 'wordpress',
    tier: 'dedicated',
  },
});

// Advanced Karpenter scheduling configuration
const advancedScheduling = rutter.addKarpenterScheduling({
  name: 'wordpress-advanced-scheduling',
  nodeSelector: {
    'karpenter.sh/capacity-type': 'on-demand',
  },
  nodeAffinity: {
    requiredDuringSchedulingIgnoredDuringExecution: {
      nodeSelectorTerms: [
        {
          matchExpressions: [
            {
              key: 'eks.amazonaws.com/instance-category',
              operator: 'In',
              values: ['c', 'm', 'r'],
            },
            {
              key: 'topology.kubernetes.io/zone',
              operator: 'In',
              values: ['us-west-2a', 'us-west-2b', 'us-west-2c'],
            },
          ],
        },
      ],
    },
    preferredDuringSchedulingIgnoredDuringExecution: [
      {
        weight: 100,
        preference: {
          matchExpressions: [
            {
              key: 'eks.amazonaws.com/instance-generation',
              operator: 'Gt',
              values: ['4'],
            },
          ],
        },
      },
    ],
  },
  topologySpreadConstraints: [
    {
      maxSkew: 1,
      topologyKey: 'topology.kubernetes.io/zone',
      whenUnsatisfiable: 'DoNotSchedule',
      labelSelector: {
        matchLabels: {
          app: 'wordpress',
        },
      },
      minDomains: 2,
    },
    {
      maxSkew: 2,
      topologyKey: 'kubernetes.io/hostname',
      whenUnsatisfiable: 'ScheduleAnyway',
      labelSelector: {
        matchLabels: {
          app: 'wordpress',
        },
      },
    },
  ],
  tolerations: [
    {
      key: 'wordpress.example.com/workload',
      operator: 'Equal',
      value: 'web',
      effect: 'NoSchedule',
    },
    {
      key: 'node.kubernetes.io/not-ready',
      operator: 'Exists',
      effect: 'NoExecute',
      tolerationSeconds: 300,
    },
  ],
  priorityClassName: 'high-priority',
  schedulerName: 'default-scheduler',
  labels: {
    'scheduling.wordpress.com/type': 'advanced',
  },
});

// Note: The advancedScheduling configuration can be used in pod specs
// Example usage would be in a Deployment's pod template spec

export default function run(outDir: string) {
  rutter.write(outDir);
}

export { rutter, advancedScheduling };
