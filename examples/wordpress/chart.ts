import { Rutter, valuesRef } from 'timonel';

const rutter = new Rutter({
  meta: {
    name: 'wordpress',
    version: '1.0.0',
    description: 'WordPress deployment with MySQL database',
    appVersion: '6.4.0',
    keywords: ['wordpress', 'cms', 'mysql', 'blog'],
  },
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

export default function run(outDir: string) {
  rutter.write(outDir);
}

export { rutter };
