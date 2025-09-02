import { ChartFactory, valuesRef } from 'timonel';

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
factory.addSecret({
  name: 'mysql-secret',
  data: {
    'mysql-root-password': '{{ .Values.mysql.rootPassword | b64enc }}',
    'mysql-password': '{{ .Values.mysql.password | b64enc }}',
  },
});

// MySQL PersistentVolumeClaim
factory.addPersistentVolumeClaim({
  name: 'mysql-pvc',
  accessModes: ['ReadWriteOnce'],
  resources: {
    requests: {
      storage: valuesRef('mysql.storage') as string,
    },
  },
});

// MySQL Deployment
factory.addDeployment({
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
factory.addService({
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
    app: 'wordpress-app',
  },
});

export default function run(outDir: string) {
  factory.write(outDir);
}

export { factory };
