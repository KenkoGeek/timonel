import { App } from 'cdk8s';
import { Rutter } from 'timonel';
import { pathToFileURL } from 'url';

/**
 * Creates a MySQL backend with persistent storage and clusterIP service.
 * @returns Configured Rutter instance for Helm chart generation
 * @since 2.12.0
 */
export default function createChart() {
  const app = new App({ outdir: 'dist' });

  const rutter = new Rutter({
    meta: {
      name: 'mysql',
      version: '1.0.0',
      description: 'MySQL backend with persistent volume',
    },
    scope: app,
    defaultValues: {
      storageClassName: 'standard',
      storageSize: '20Gi',
      mysqlRootPassword: 'rootpassword',
      mysqlDatabase: 'wordpress',
      mysqlUser: 'wordpress',
      mysqlPassword: 'changeme',
    },
  });

  /**
   * Secret housing MySQL connection credentials sourced by the statefulset.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'mysql-credentials',
      },
      stringData: {
        MYSQL_ROOT_PASSWORD: '{{ .Values.mysqlRootPassword }}',
        MYSQL_DATABASE: '{{ .Values.mysqlDatabase }}',
        MYSQL_USER: '{{ .Values.mysqlUser }}',
        MYSQL_PASSWORD: '{{ .Values.mysqlPassword }}',
      },
    },
    'credentials-secret',
  );

  /**
   * StatefulSet manages a single MySQL replica with durable volume claims.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: {
        name: 'mysql',
        labels: {
          'app.kubernetes.io/name': 'mysql',
        },
      },
      spec: {
        serviceName: 'mysql',
        replicas: 1,
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'mysql',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'mysql',
            },
          },
          spec: {
            containers: [
              {
                name: 'mysql',
                image: 'mysql:8.0',
                ports: [
                  {
                    containerPort: 3306,
                    name: 'mysql',
                  },
                ],
                env: [
                  {
                    name: 'MYSQL_ROOT_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'mysql-credentials',
                        key: 'MYSQL_ROOT_PASSWORD',
                      },
                    },
                  },
                  {
                    name: 'MYSQL_DATABASE',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'mysql-credentials',
                        key: 'MYSQL_DATABASE',
                      },
                    },
                  },
                  {
                    name: 'MYSQL_USER',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'mysql-credentials',
                        key: 'MYSQL_USER',
                      },
                    },
                  },
                  {
                    name: 'MYSQL_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: 'mysql-credentials',
                        key: 'MYSQL_PASSWORD',
                      },
                    },
                  },
                ],
                volumeMounts: [
                  {
                    name: 'mysql-data',
                    mountPath: '/var/lib/mysql',
                  },
                ],
                resources: {
                  requests: {
                    cpu: '250m',
                    memory: '512Mi',
                  },
                  limits: {
                    cpu: '500m',
                    memory: '1Gi',
                  },
                },
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: {
              name: 'mysql-data',
            },
            spec: {
              accessModes: ['ReadWriteOnce'],
              storageClassName: '{{ .Values.storageClassName }}',
              resources: {
                requests: {
                  storage: '{{ .Values.storageSize }}',
                },
              },
            },
          },
        ],
      },
    },
    'statefulset',
  );

  /**
   * ClusterIP service enabling internal connectivity to the database pods.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'mysql',
        labels: {
          'app.kubernetes.io/name': 'mysql',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': 'mysql',
        },
        ports: [
          {
            port: 3306,
            targetPort: 3306,
            protocol: 'TCP',
            name: 'mysql',
          },
        ],
      },
    },
    'service',
  );

  return rutter;
}

const isExecutedDirectly = Boolean(
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url,
);

if (isExecutedDirectly) {
  const chart = createChart();
  chart.write('dist');
}
