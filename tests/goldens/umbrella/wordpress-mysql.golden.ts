/**
 * @fileoverview Golden files for WordPress+MySQL umbrella chart tests
 * @since 0.2.0
 */

/**
 * Expected Chart.yaml content for WordPress+MySQL umbrella chart
 */
export const expectedChartYaml = `apiVersion: v2
name: wordpress-umbrella
description: WordPress with MySQL umbrella chart for complete CMS deployment
type: application
version: 1.0.0
keywords:
  - wordpress
  - mysql
  - cms
  - blog
  - umbrella
home: https://wordpress.org
sources:
  - https://github.com/wordpress/wordpress
  - https://github.com/mysql/mysql-server
maintainers:
  - name: Chart Factory
    email: maintainer@example.com
dependencies:
  - name: wordpress
    version: "1.0.0"
    condition: wordpress.enabled
    tags:
      - frontend
      - web
  - name: mysql
    version: "8.0.0"
    condition: mysql.enabled
    tags:
      - database
      - storage
`;

/**
 * Expected values.yaml content for WordPress+MySQL umbrella chart
 */
export const expectedValuesYaml = `# Global values shared across all subcharts
global:
  storageClass: gp2
  imageRegistry: ""

# WordPress configuration
wordpress:
  enabled: true
  replicaCount: 1
  persistence:
    enabled: true
    size: 10Gi
  resources:
    requests:
      memory: 512Mi
      cpu: 250m
    limits:
      memory: 1Gi
      cpu: 500m

# MySQL configuration
mysql:
  enabled: true
  auth:
    rootPassword: secretrootpassword
    username: wordpress
    password: secretpassword
    database: wordpress
  persistence:
    enabled: true
    size: 8Gi
  resources:
    requests:
      memory: 256Mi
      cpu: 250m
    limits:
      memory: 512Mi
      cpu: 500m
`;

/**
 * Expected values-production.yaml content for production environment
 */
export const expectedProductionValuesYaml = `# Production environment values
global:
  storageClass: gp3

wordpress:
  replicaCount: 3
  persistence:
    size: 20Gi
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m

mysql:
  persistence:
    size: 50Gi
  resources:
    requests:
      memory: 1Gi
      cpu: 500m
    limits:
      memory: 2Gi
      cpu: 1000m
`;

/**
 * Expected values-staging.yaml content for staging environment
 */
export const expectedStagingValuesYaml = `# Staging environment values
wordpress:
  replicaCount: 2
  persistence:
    size: 15Gi

mysql:
  persistence:
    size: 20Gi
`;

/**
 * Expected WordPress subchart Chart.yaml
 */
export const expectedWordPressChartYaml = `apiVersion: v2
name: wordpress
description: WordPress application chart
type: application
version: 1.0.0
keywords:
  - wordpress
  - cms
  - blog
`;

/**
 * Expected WordPress subchart values.yaml
 */
export const expectedWordPressValuesYaml = `replicaCount: 1
image:
  repository: wordpress
  tag: 6.3.0-apache
  pullPolicy: IfNotPresent
service:
  type: ClusterIP
  port: 80
persistence:
  enabled: true
  storageClass: gp2
  size: 10Gi
resources:
  requests:
    memory: 512Mi
    cpu: 250m
  limits:
    memory: 1Gi
    cpu: 500m
mysql:
  host: mysql
  auth:
    username: wordpress
    database: wordpress
    existingSecret: mysql-secret
`;

/**
 * Expected WordPress deployment template
 */
export const expectedWordPressDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "wordpress.fullname" . }}
  labels:
    {{- include "wordpress.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      {{- include "wordpress.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "wordpress.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: wordpress
          image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 80
              protocol: TCP
          env:
            - name: WORDPRESS_DB_HOST
              value: {{ .Values.mysql.host }}
            - name: WORDPRESS_DB_USER
              value: {{ .Values.mysql.auth.username }}
            - name: WORDPRESS_DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.mysql.auth.existingSecret }}
                  key: mysql-password
            - name: WORDPRESS_DB_NAME
              value: {{ .Values.mysql.auth.database }}
          volumeMounts:
            - name: wordpress-data
              mountPath: /var/www/html
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        - name: wordpress-data
          persistentVolumeClaim:
            claimName: {{ include "wordpress.fullname" . }}-data
`;

/**
 * Expected MySQL subchart Chart.yaml
 */
export const expectedMySQLChartYaml = `apiVersion: v2
name: mysql
description: MySQL database chart
type: application
version: 8.0.0
keywords:
  - mysql
  - database
  - sql
`;

/**
 * Expected MySQL subchart values.yaml
 */
export const expectedMySQLValuesYaml = `image:
  repository: mysql
  tag: 8.0.35
  pullPolicy: IfNotPresent
auth:
  rootPassword: secretrootpassword
  username: wordpress
  password: secretpassword
  database: wordpress
  existingSecret: mysql-secret
persistence:
  enabled: true
  storageClass: gp2
  size: 8Gi
resources:
  requests:
    memory: 256Mi
    cpu: 250m
  limits:
    memory: 512Mi
    cpu: 500m
`;

/**
 * Expected MySQL deployment template
 */
export const expectedMySQLDeployment = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "mysql.fullname" . }}
  labels:
    {{- include "mysql.labels" . | nindent 4 }}
spec:
  replicas: 1
  selector:
    matchLabels:
      {{- include "mysql.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "mysql.selectorLabels" . | nindent 8 }}
    spec:
      containers:
        - name: mysql
          image: {{ .Values.image.repository }}:{{ .Values.image.tag }}
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: mysql
              containerPort: 3306
              protocol: TCP
          env:
            - name: MYSQL_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret }}
                  key: mysql-root-password
            - name: MYSQL_DATABASE
              value: {{ .Values.auth.database }}
            - name: MYSQL_USER
              value: {{ .Values.auth.username }}
            - name: MYSQL_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: {{ .Values.auth.existingSecret }}
                  key: mysql-password
          volumeMounts:
            - name: mysql-data
              mountPath: /var/lib/mysql
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        - name: mysql-data
          persistentVolumeClaim:
            claimName: {{ include "mysql.fullname" . }}-data
`;

/**
 * Expected MySQL secret template
 */
export const expectedMySQLSecret = `apiVersion: v1
kind: Secret
metadata:
  name: {{ .Values.auth.existingSecret }}
  labels:
    {{- include "mysql.labels" . | nindent 4 }}
type: Opaque
data:
  mysql-root-password: {{ .Values.auth.rootPassword | b64enc }}
  mysql-password: {{ .Values.auth.password | b64enc }}
`;

/**
 * Expected directory structure for the umbrella chart
 */
export const expectedDirectoryStructure = [
  'Chart.yaml',
  'values.yaml',
  'values-production.yaml',
  'values-staging.yaml',
  'charts/',
  'charts/wordpress/',
  'charts/wordpress/Chart.yaml',
  'charts/wordpress/values.yaml',
  'charts/mysql/',
  'charts/mysql/Chart.yaml',
  'charts/mysql/values.yaml',
];

/**
 * Expected file count for validation
 */
export const expectedFileCount = {
  total: 15,
  chartFiles: 3, // umbrella + 2 subcharts
  valuesFiles: 4, // umbrella values + production + staging + subchart values
  templateFiles: 8, // 3 wordpress + 4 mysql + 1 secret
};

/**
 * Expected subchart metadata
 */
export const expectedSubchartMetadata = {
  wordpress: {
    name: 'wordpress',
    version: '1.0.0',
    description: 'WordPress application chart',
    keywords: ['wordpress', 'cms', 'blog'],
  },
  mysql: {
    name: 'mysql',
    version: '8.0.0',
    description: 'MySQL database chart',
    keywords: ['mysql', 'database', 'sql'],
  },
};

/**
 * Expected umbrella chart dependencies
 */
export const expectedDependencies = [
  {
    name: 'wordpress',
    version: '1.0.0',
    condition: 'wordpress.enabled',
    tags: ['frontend', 'web'],
    repository: 'file://./charts/wordpress',
  },
  {
    name: 'mysql',
    version: '8.0.0',
    condition: 'mysql.enabled',
    tags: ['database', 'storage'],
    repository: 'file://./charts/mysql',
  },
];

/**
 * Expected global values structure
 */
export const expectedGlobalValues = {
  global: {
    storageClass: 'gp2',
    imageRegistry: '',
  },
};

/**
 * Expected environment-specific overrides
 */
export const expectedEnvironmentOverrides = {
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
};
