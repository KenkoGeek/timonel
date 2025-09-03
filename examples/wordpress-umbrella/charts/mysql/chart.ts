import { Rutter } from '../../../../src';
import { valuesRef } from '../../../../src/lib/helm';

// MySQL subchart
const rutter = new Rutter({
  meta: {
    name: 'mysql',
    version: '0.1.0',
    description: 'MySQL database for WordPress',
    appVersion: '8.0',
  },
  defaultValues: {
    image: { repository: 'mysql', tag: '8.0' },
    auth: {
      rootPassword: 'rootpassword',
      database: 'wordpress',
      username: 'wordpress',
      password: 'wordpresspassword',
    },
    persistence: {
      enabled: true,
      size: '8Gi',
    },
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '250m', memory: '256Mi' },
    },
  },
});

// MySQL Secret
rutter.addSecret({
  name: 'mysql-secret',
  stringData: {
    'mysql-root-password': valuesRef('auth.rootPassword') as string,
    'mysql-password': valuesRef('auth.password') as string,
  },
});

// MySQL PVC
rutter.addPersistentVolumeClaim({
  name: 'mysql-pvc',
  accessModes: ['ReadWriteOnce'],
  resources: {
    requests: {
      storage: valuesRef('persistence.size') as string,
    },
  },
});

// MySQL Deployment
rutter.addDeployment({
  name: 'mysql',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: 1,
  containerPort: 3306,
  env: {
    MYSQL_ROOT_PASSWORD: valuesRef('auth.rootPassword') as string,
    MYSQL_DATABASE: valuesRef('auth.database') as string,
    MYSQL_USER: valuesRef('auth.username') as string,
    MYSQL_PASSWORD: valuesRef('auth.password') as string,
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
  resources: {
    limits: {
      cpu: valuesRef('resources.limits.cpu') as string,
      memory: valuesRef('resources.limits.memory') as string,
    },
    requests: {
      cpu: valuesRef('resources.requests.cpu') as string,
      memory: valuesRef('resources.requests.memory') as string,
    },
  },
});

// MySQL Service
rutter.addService({
  name: 'mysql-service',
  ports: [{ port: 3306, targetPort: 3306 }],
  selector: { app: 'mysql' },
});

export default function run(outDir: string) {
  rutter.write(outDir);
}

// Export rutter for umbrella chart
export { rutter };
