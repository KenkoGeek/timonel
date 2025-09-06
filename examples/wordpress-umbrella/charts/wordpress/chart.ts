import { Rutter, valuesRef } from 'timonel';

// WordPress subchart
const rutter = new Rutter({
  meta: {
    name: 'wordpress',
    version: '0.1.0',
    description: 'WordPress application',
    appVersion: '6.4',
  },
  manifestName: 'wordpress-app',
  singleManifestFile: false, // Separate files for application components
  defaultValues: {
    image: { repository: 'wordpress', tag: '6.4-apache' },
    service: {
      type: 'LoadBalancer',
      port: 80,
    },
    persistence: {
      enabled: true,
      size: '10Gi',
    },
    database: {
      host: 'mysql',
      name: 'wordpress',
      user: 'wordpress',
      password: 'wordpresspassword',
    },
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '250m', memory: '256Mi' },
    },
  },
});

// WordPress PVC
rutter.addPersistentVolumeClaim({
  name: 'wordpress-pvc',
  accessModes: ['ReadWriteOnce'],
  resources: {
    requests: {
      storage: valuesRef('persistence.size') as string,
    },
  },
});

// WordPress Deployment
rutter.addDeployment({
  name: 'wordpress',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: 1,
  containerPort: 80,
  env: {
    WORDPRESS_DB_HOST: valuesRef('database.host') as string,
    WORDPRESS_DB_NAME: valuesRef('database.name') as string,
    WORDPRESS_DB_USER: valuesRef('database.user') as string,
    WORDPRESS_DB_PASSWORD: valuesRef('database.password') as string,
  },
  volumeMounts: [
    {
      name: 'wordpress-storage',
      mountPath: '/var/www/html',
    },
  ],
  volumes: [
    {
      name: 'wordpress-storage',
      persistentVolumeClaim: 'wordpress-pvc',
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

// WordPress Service
rutter.addService({
  name: 'wordpress-service',
  ports: [{ port: 80, targetPort: 80 }],
  type: valuesRef('service.type') as 'LoadBalancer' | 'ClusterIP' | 'NodePort' | 'ExternalName',
  selector: { app: 'wordpress' },
});

export default function run(outDir: string) {
  rutter.write(outDir);
}

// Export rutter for umbrella chart
export { rutter };
