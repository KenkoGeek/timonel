/**
 * @fileoverview Fixture data for WordPress+MySQL umbrella chart tests
 * @since 0.2.0
 */

import { Rutter } from '../../../src/lib/rutter.js';
import type { UmbrellaRutterProps } from '../../../src/lib/umbrella.js';
import type { ChartMetadata } from '../../../src/lib/rutter.js';

/**
 * Creates a WordPress chart fixture with realistic configuration
 */
export function createWordPressFixture(): Rutter {
  const wordpressMeta: ChartMetadata = {
    name: 'wordpress',
    version: '1.0.0',
    description: 'WordPress application chart',
    keywords: ['wordpress', 'cms', 'blog'],
  };

  const wordpressChart = new Rutter({
    meta: wordpressMeta,
    defaultValues: {
      replicaCount: 1,
      image: {
        repository: 'wordpress',
        tag: '6.3.0-apache',
        pullPolicy: 'IfNotPresent',
      },
      service: {
        type: 'ClusterIP',
        port: 80,
      },
      persistence: {
        enabled: true,
        storageClass: 'gp2',
        size: '10Gi',
      },
      resources: {
        requests: {
          memory: '512Mi',
          cpu: '250m',
        },
        limits: {
          memory: '1Gi',
          cpu: '500m',
        },
      },
      mysql: {
        host: 'mysql',
        auth: {
          username: 'wordpress',
          database: 'wordpress',
          existingSecret: 'mysql-secret',
        },
      },
    },
  });

  // Add WordPress deployment
  wordpressChart.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: '{{ include "wordpress.fullname" . }}',
        labels: '{{- include "wordpress.labels" . | nindent 4 }}',
      },
      spec: {
        replicas: '{{ .Values.replicaCount }}',
        selector: {
          matchLabels: '{{- include "wordpress.selectorLabels" . | nindent 6 }}',
        },
        template: {
          metadata: {
            labels: '{{- include "wordpress.selectorLabels" . | nindent 8 }}',
          },
          spec: {
            containers: [
              {
                name: 'wordpress',
                image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
                imagePullPolicy: '{{ .Values.image.pullPolicy }}',
                ports: [
                  {
                    name: 'http',
                    containerPort: 80,
                    protocol: 'TCP',
                  },
                ],
                env: [
                  {
                    name: 'WORDPRESS_DB_HOST',
                    value: '{{ .Values.mysql.host }}',
                  },
                  {
                    name: 'WORDPRESS_DB_USER',
                    value: '{{ .Values.mysql.auth.username }}',
                  },
                  {
                    name: 'WORDPRESS_DB_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: '{{ .Values.mysql.auth.existingSecret }}',
                        key: 'mysql-password',
                      },
                    },
                  },
                  {
                    name: 'WORDPRESS_DB_NAME',
                    value: '{{ .Values.mysql.auth.database }}',
                  },
                ],
                volumeMounts: [
                  {
                    name: 'wordpress-data',
                    mountPath: '/var/www/html',
                  },
                ],
                resources: '{{ toYaml .Values.resources | nindent 12 }}',
              },
            ],
            volumes: [
              {
                name: 'wordpress-data',
                persistentVolumeClaim: {
                  claimName: '{{ include "wordpress.fullname" . }}-data',
                },
              },
            ],
          },
        },
      },
    },
    'deployment',
  );

  // Add WordPress service
  wordpressChart.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: '{{ include "wordpress.fullname" . }}',
        labels: '{{- include "wordpress.labels" . | nindent 4 }}',
      },
      spec: {
        type: '{{ .Values.service.type }}',
        ports: [
          {
            port: '{{ .Values.service.port }}',
            targetPort: 'http',
            protocol: 'TCP',
            name: 'http',
          },
        ],
        selector: '{{- include "wordpress.selectorLabels" . | nindent 4 }}',
      },
    },
    'service',
  );

  // Add WordPress PVC
  wordpressChart.addManifest(
    {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: '{{ include "wordpress.fullname" . }}-data',
        labels: '{{- include "wordpress.labels" . | nindent 4 }}',
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: '{{ .Values.persistence.storageClass }}',
        resources: {
          requests: {
            storage: '{{ .Values.persistence.size }}',
          },
        },
      },
    },
    'pvc',
  );

  return wordpressChart;
}

/**
 * Creates a MySQL chart fixture with realistic configuration
 */
export function createMySQLFixture(): Rutter {
  const mysqlMeta: ChartMetadata = {
    name: 'mysql',
    version: '8.0.0',
    description: 'MySQL database chart',
    keywords: ['mysql', 'database', 'sql'],
  };

  const mysqlChart = new Rutter({
    meta: mysqlMeta,
    defaultValues: {
      image: {
        repository: 'mysql',
        tag: '8.0.35',
        pullPolicy: 'IfNotPresent',
      },
      auth: {
        rootPassword: 'secretrootpassword',
        username: 'wordpress',
        password: 'secretpassword',
        database: 'wordpress',
        existingSecret: 'mysql-secret',
      },
      persistence: {
        enabled: true,
        storageClass: 'gp2',
        size: '8Gi',
      },
      resources: {
        requests: {
          memory: '256Mi',
          cpu: '250m',
        },
        limits: {
          memory: '512Mi',
          cpu: '500m',
        },
      },
    },
  });

  // Add MySQL deployment
  mysqlChart.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: '{{ include "mysql.fullname" . }}',
        labels: '{{- include "mysql.labels" . | nindent 4 }}',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: '{{- include "mysql.selectorLabels" . | nindent 6 }}',
        },
        template: {
          metadata: {
            labels: '{{- include "mysql.selectorLabels" . | nindent 8 }}',
          },
          spec: {
            containers: [
              {
                name: 'mysql',
                image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
                imagePullPolicy: '{{ .Values.image.pullPolicy }}',
                ports: [
                  {
                    name: 'mysql',
                    containerPort: 3306,
                    protocol: 'TCP',
                  },
                ],
                env: [
                  {
                    name: 'MYSQL_ROOT_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: '{{ .Values.auth.existingSecret }}',
                        key: 'mysql-root-password',
                      },
                    },
                  },
                  {
                    name: 'MYSQL_DATABASE',
                    value: '{{ .Values.auth.database }}',
                  },
                  {
                    name: 'MYSQL_USER',
                    value: '{{ .Values.auth.username }}',
                  },
                  {
                    name: 'MYSQL_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: '{{ .Values.auth.existingSecret }}',
                        key: 'mysql-password',
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
                resources: '{{ toYaml .Values.resources | nindent 12 }}',
              },
            ],
            volumes: [
              {
                name: 'mysql-data',
                persistentVolumeClaim: {
                  claimName: '{{ include "mysql.fullname" . }}-data',
                },
              },
            ],
          },
        },
      },
    },
    'deployment',
  );

  // Add MySQL service
  mysqlChart.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: '{{ include "mysql.fullname" . }}',
        labels: '{{- include "mysql.labels" . | nindent 4 }}',
      },
      spec: {
        type: 'ClusterIP',
        ports: [
          {
            port: 3306,
            targetPort: 'mysql',
            protocol: 'TCP',
            name: 'mysql',
          },
        ],
        selector: '{{- include "mysql.selectorLabels" . | nindent 4 }}',
      },
    },
    'service',
  );

  // Add MySQL PVC
  mysqlChart.addManifest(
    {
      apiVersion: 'v1',
      kind: 'PersistentVolumeClaim',
      metadata: {
        name: '{{ include "mysql.fullname" . }}-data',
        labels: '{{- include "mysql.labels" . | nindent 4 }}',
      },
      spec: {
        accessModes: ['ReadWriteOnce'],
        storageClassName: '{{ .Values.persistence.storageClass }}',
        resources: {
          requests: {
            storage: '{{ .Values.persistence.size }}',
          },
        },
      },
    },
    'pvc',
  );

  // Add MySQL secret
  mysqlChart.addManifest(
    {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: '{{ .Values.auth.existingSecret }}',
        labels: '{{- include "mysql.labels" . | nindent 4 }}',
      },
      type: 'Opaque',
      data: {
        'mysql-root-password': '{{ .Values.auth.rootPassword | b64enc }}',
        'mysql-password': '{{ .Values.auth.password | b64enc }}',
      },
    },
    'secret',
  );

  return mysqlChart;
}

/**
 * Creates a complete WordPress+MySQL umbrella chart fixture
 */
export function createWordPressMySQLUmbrellaFixture(): UmbrellaRutterProps {
  const wordpressChart = createWordPressFixture();
  const mysqlChart = createMySQLFixture();

  return {
    meta: {
      name: 'wordpress-umbrella',
      version: '1.0.0',
      description: 'WordPress with MySQL umbrella chart for complete CMS deployment',
      keywords: ['wordpress', 'mysql', 'cms', 'blog', 'umbrella'],
      home: 'https://wordpress.org',
      sources: ['https://github.com/wordpress/wordpress', 'https://github.com/mysql/mysql-server'],
      maintainers: [
        {
          name: 'Chart Factory',
          email: 'maintainer@example.com',
        },
      ],
    },
    subcharts: [
      {
        name: 'wordpress',
        rutter: wordpressChart,
        version: '1.0.0',
        condition: 'wordpress.enabled',
        tags: ['frontend', 'web'],
      },
      {
        name: 'mysql',
        rutter: mysqlChart,
        version: '8.0.0',
        condition: 'mysql.enabled',
        tags: ['database', 'storage'],
      },
    ],
    defaultValues: {
      global: {
        storageClass: 'gp2',
        imageRegistry: '',
      },
      wordpress: {
        enabled: true,
        replicaCount: 1,
        persistence: {
          enabled: true,
          size: '10Gi',
        },
        resources: {
          requests: {
            memory: '512Mi',
            cpu: '250m',
          },
          limits: {
            memory: '1Gi',
            cpu: '500m',
          },
        },
      },
      mysql: {
        enabled: true,
        auth: {
          rootPassword: 'secretrootpassword',
          username: 'wordpress',
          password: 'secretpassword',
          database: 'wordpress',
        },
        persistence: {
          enabled: true,
          size: '8Gi',
        },
        resources: {
          requests: {
            memory: '256Mi',
            cpu: '250m',
          },
          limits: {
            memory: '512Mi',
            cpu: '500m',
          },
        },
      },
    },
    envValues: {
      production: {
        global: {
          storageClass: 'gp3',
        },
        wordpress: {
          replicaCount: 3,
          persistence: {
            size: '20Gi',
          },
          resources: {
            requests: {
              memory: '1Gi',
              cpu: '500m',
            },
            limits: {
              memory: '2Gi',
              cpu: '1000m',
            },
          },
        },
        mysql: {
          persistence: {
            size: '50Gi',
          },
          resources: {
            requests: {
              memory: '1Gi',
              cpu: '500m',
            },
            limits: {
              memory: '2Gi',
              cpu: '1000m',
            },
          },
        },
      },
      staging: {
        wordpress: {
          replicaCount: 2,
          persistence: {
            size: '15Gi',
          },
        },
        mysql: {
          persistence: {
            size: '20Gi',
          },
        },
      },
    },
  };
}

/**
 * Creates a minimal umbrella chart fixture for testing edge cases
 */
export function createMinimalUmbrellaFixture(): UmbrellaRutterProps {
  const minimalChart = new Rutter({
    meta: {
      name: 'simple-app',
      version: '1.0.0',
    },
  });

  // Add a simple deployment
  minimalChart.addManifest(
    {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: 'simple-app',
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            app: 'simple-app',
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'simple-app',
            },
          },
          spec: {
            containers: [
              {
                name: 'app',
                image: 'nginx:latest',
                ports: [
                  {
                    containerPort: 80,
                  },
                ],
              },
            ],
          },
        },
      },
    },
    'deployment',
  );

  return {
    meta: {
      name: 'minimal-umbrella',
      version: '1.0.0',
    },
    subcharts: [
      {
        name: 'simple-app',
        rutter: minimalChart,
      },
    ],
  };
}
