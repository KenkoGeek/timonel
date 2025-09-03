import { createUmbrella } from '../../src';

// Import subcharts
import { rutter as mysql } from './charts/mysql/chart';
import { rutter as wordpress } from './charts/wordpress/chart';

// Create WordPress umbrella chart
const umbrella = createUmbrella({
  meta: {
    name: 'wordpress-stack',
    version: '1.0.0',
    description: 'Complete WordPress stack with MySQL database',
    appVersion: '6.4.0',
    keywords: ['wordpress', 'mysql', 'cms', 'blog'],
  },
  subcharts: [
    { name: 'mysql', rutter: mysql },
    { name: 'wordpress', rutter: wordpress },
  ],
  defaultValues: {
    global: {
      // Global values shared across subcharts
      storageClass: 'gp2',
      namespace: 'wordpress',
    },
    // MySQL configuration
    mysql: {
      enabled: true,
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
    },
    // WordPress configuration
    wordpress: {
      enabled: true,
      image: {
        repository: 'wordpress',
        tag: '6.4-apache',
      },
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
    },
  },
  envValues: {
    dev: {
      mysql: {
        persistence: { size: '5Gi' },
      },
      wordpress: {
        service: { type: 'NodePort' },
        persistence: { size: '5Gi' },
      },
    },
    prod: {
      mysql: {
        persistence: { size: '20Gi' },
        resources: {
          limits: { cpu: '1000m', memory: '1Gi' },
          requests: { cpu: '500m', memory: '512Mi' },
        },
      },
      wordpress: {
        service: { type: 'LoadBalancer' },
        persistence: { size: '50Gi' },
        resources: {
          limits: { cpu: '1000m', memory: '1Gi' },
          requests: { cpu: '500m', memory: '512Mi' },
        },
      },
    },
  },
});

export default function run(outDir: string) {
  umbrella.write(outDir);
}
