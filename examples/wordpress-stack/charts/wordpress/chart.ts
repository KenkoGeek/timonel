import { App } from 'cdk8s';
import { Rutter } from 'timonel';
import { pathToFileURL } from 'url';

/**
 * Creates the WordPress workload with ingress and autoscaling enabled.
 * @returns Configured Rutter instance for Helm chart generation
 * @since 2.12.0
 */
export default function createChart() {
  const app = new App({ outdir: 'dist' });

  const rutter = new Rutter({
    meta: {
      name: 'wordpress',
      version: '1.0.0',
      description: 'WordPress frontend with ingress and autoscaling',
    },
    scope: app,
    defaultValues: {
      image: 'wordpress:6.5.4-apache',
      servicePort: 80,
      ingressHost: 'wordpress.local',
      minReplicas: 2,
      maxReplicas: 5,
      targetCpuUtilization: 60,
    },
  });

  /**
   * Primary deployment for the WordPress frontend including basic configuration
   * and resource requests to support scaling triggers.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'wordpress',
        labels: {
          'app.kubernetes.io/name': 'wordpress',
        },
      },
      spec: {
        replicas: '{{ .Values.minReplicas }}',
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': 'wordpress',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': 'wordpress',
            },
          },
          spec: {
            containers: [
              {
                name: 'wordpress',
                image: '{{ .Values.image }}',
                ports: [
                  {
                    containerPort: '{{ .Values.servicePort }}',
                    name: 'http',
                  },
                ],
                env: [
                  { name: 'WORDPRESS_DB_HOST', value: 'mysql' },
                  { name: 'WORDPRESS_DB_USER', value: 'wordpress' },
                  { name: 'WORDPRESS_DB_PASSWORD', value: 'changeme' },
                  { name: 'WORDPRESS_DB_NAME', value: 'wordpress' },
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
                volumeMounts: [
                  {
                    name: 'wordpress-content',
                    mountPath: '/var/www/html',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'wordpress-content',
                emptyDir: {},
              },
            ],
          },
        },
      },
    },
    'deployment',
  );

  /**
   * Exposes the WordPress deployment within the cluster using a ClusterIP
   * service.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'wordpress',
        labels: {
          'app.kubernetes.io/name': 'wordpress',
        },
      },
      spec: {
        type: 'ClusterIP',
        selector: {
          'app.kubernetes.io/name': 'wordpress',
        },
        ports: [
          {
            port: '{{ .Values.servicePort }}',
            targetPort: '{{ .Values.servicePort }}',
            protocol: 'TCP',
            name: 'http',
          },
        ],
      },
    },
    'service',
  );

  /**
   * Publishes the application externally through an ingress controller, mapping
   * traffic to the backing service.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: {
        name: 'wordpress',
        annotations: {
          'nginx.ingress.kubernetes.io/rewrite-target': '/',
        },
      },
      spec: {
        ingressClassName: 'nginx',
        rules: [
          {
            host: '{{ .Values.ingressHost }}',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'wordpress',
                      port: {
                        number: '{{ .Values.servicePort }}',
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    },
    'ingress',
  );

  /**
   * HorizontalPodAutoscaler keeps the deployment responsive by scaling between
   * the configured replica bounds.
   * @since 2.12.0
   */
  rutter.addManifest(
    {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: 'wordpress',
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: 'wordpress',
        },
        minReplicas: '{{ .Values.minReplicas }}',
        maxReplicas: '{{ .Values.maxReplicas }}',
        metrics: [
          {
            type: 'Resource',
            resource: {
              name: 'cpu',
              target: {
                type: 'Utilization',
                averageUtilization: '{{ .Values.targetCpuUtilization }}',
              },
            },
          },
        ],
      },
    },
    'hpa',
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
