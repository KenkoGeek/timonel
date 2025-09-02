import { ChartFactory, numberRef, valuesRef } from 'timonel';

/**
 * WordPress with MySQL Database Helm Chart Example
 *
 * This example demonstrates how to use Timonel to create a Helm chart
 * for deploying WordPress with MySQL database on Kubernetes.
 */

const factory = new ChartFactory({
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
const MYSQL_SECRET_NAME = 'mysql-secret';
factory.addSecret({
  name: MYSQL_SECRET_NAME,
  data: {
    'mysql-root-password': valuesRef('mysql.rootPassword') as string,
    'mysql-password': valuesRef('mysql.password') as string,
  },
});

// MySQL PersistentVolumeClaim
factory.addPersistentVolumeClaim({
  name: 'mysql-pvc',
  accessModes: ['ReadWriteOnce'],
  size: valuesRef('mysql.storage') as string,
});

// MySQL Deployment
factory.addDeployment({
  name: 'mysql-db',
  image: valuesRef('mysql.image') as string,
  replicas: 1,
  containerPort: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: {
      valueFrom: {
        secretKeyRef: {
          name: MYSQL_SECRET_NAME,
          key: 'mysql-root-password',
        },
      },
    },
    MYSQL_DATABASE: valuesRef('mysql.database') as string,
    MYSQL_USER: valuesRef('mysql.user') as string,
    MYSQL_PASSWORD: {
      valueFrom: {
        secretKeyRef: {
          name: MYSQL_SECRET_NAME,
          key: 'mysql-password',
        },
      },
    },
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
      persistentVolumeClaim: {
        claimName: 'mysql-pvc',
      },
    },
  ],
});

// MySQL Service
factory.addService({
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
factory.addDeployment({
  name: 'wordpress-app',
  image: valuesRef('wordpress.image') as string,
  replicas: numberRef('wordpress.replicas') as unknown as number,
  containerPort: 80,
  env: {
    WORDPRESS_DB_HOST: 'mysql-service:3306',
    WORDPRESS_DB_NAME: valuesRef('mysql.database') as string,
    WORDPRESS_DB_USER: valuesRef('mysql.user') as string,
    WORDPRESS_DB_PASSWORD: {
      valueFrom: {
        secretKeyRef: {
          name: MYSQL_SECRET_NAME,
          key: 'mysql-password',
        },
      },
    },
  },
  resources: {
    requests: {
      cpu: valuesRef('wordpress.resources.requests.cpu') as string,
      memory: valuesRef('wordpress.resources.requests.memory') as string,
    },
  },
});

// WordPress Service
factory.addService({
  name: 'wordpress-service',
  type: valuesRef('service.type') as string,
  ports: [
    {
      port: numberRef('service.port') as unknown as number,
      targetPort: 80,
      protocol: 'TCP',
    },
  ],
  selector: {
    app: 'wordpress-app',
  },
});

export default function run(outDir: string) {
  factory.write(outDir);
}

export { factory };
