/**
 * @fileoverview Consolidated test suite for Timonel - Helm umbrella chart generator
 * Tests that synth creates charts without errors with conditional namespace and ingress
 * @since 2.9.0
 */
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

import { describe, expect, it } from 'vitest';
import { ApiObject, App, Chart, Duration } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';

import { Rutter } from '../src/lib/rutter.js';
import { createUmbrella } from '../src/lib/umbrella.js';
import type { SubchartSpec } from '../src/lib/umbrella.js';
import { createHelper, formatHelpers } from '../src/lib/utils/helmHelpers.js';

/**
 * Fix generated Helm chart templates by adding missing helper functions using Timonel's helper library
 */
function fixChartTemplates(chartDir: string): void {
  // Create custom helpers for frontend using Timonel's helper library
  const frontendHelpers = [
    createHelper(
      'frontend.name',
      '{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}',
    ),
    createHelper(
      'frontend.fullname',
      `{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}`,
    ),
    createHelper(
      'frontend.chart',
      '{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}',
    ),
    createHelper(
      'frontend.labels',
      `helm.sh/chart: {{ include "frontend.chart" . }}
{{ include "frontend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}`,
    ),
    createHelper(
      'frontend.selectorLabels',
      `app.kubernetes.io/name: {{ include "frontend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}`,
    ),
  ];

  // Create custom helpers for backend using Timonel's helper library
  const backendHelpers = [
    createHelper(
      'backend.name',
      '{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}',
    ),
    createHelper(
      'backend.fullname',
      `{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}`,
    ),
    createHelper(
      'backend.chart',
      '{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}',
    ),
    createHelper(
      'backend.labels',
      `helm.sh/chart: {{ include "backend.chart" . }}
{{ include "backend.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}`,
    ),
    createHelper(
      'backend.selectorLabels',
      `app.kubernetes.io/name: {{ include "backend.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}`,
    ),
  ];

  // Fix frontend helper templates
  const frontendHelpersPath = join(chartDir, 'charts', 'frontend', 'templates', '_helpers.tpl');
  if (existsSync(frontendHelpersPath)) {
    const existingHelpers = readFileSync(frontendHelpersPath, 'utf8');
    if (!existingHelpers.includes('frontend.name')) {
      const additionalHelpers = '\n\n' + formatHelpers(frontendHelpers);
      writeFileSync(frontendHelpersPath, existingHelpers + additionalHelpers);
    }
  }

  // Fix backend helper templates
  const backendHelpersPath = join(chartDir, 'charts', 'backend', 'templates', '_helpers.tpl');
  if (existsSync(backendHelpersPath)) {
    const existingHelpers = readFileSync(backendHelpersPath, 'utf8');
    if (!existingHelpers.includes('backend.name')) {
      const additionalHelpers = '\n\n' + formatHelpers(backendHelpers);
      writeFileSync(backendHelpersPath, existingHelpers + additionalHelpers);
    }
  }

  // Fix backend values.yaml for namespace configuration
  const backendValuesPath = join(chartDir, 'charts', 'backend', 'values.yaml');
  if (existsSync(backendValuesPath)) {
    const backendValues = readFileSync(backendValuesPath, 'utf8');
    if (!backendValues.includes('namespace:')) {
      const namespaceConfig = `
namespace:
  enabled: true
`;
      writeFileSync(backendValuesPath, backendValues + namespaceConfig);
    }
  }

  // Fix environment variables with numeric values without quotes
  const fixEnvVariables = (filePath: string) => {
    if (existsSync(filePath)) {
      let content = readFileSync(filePath, 'utf8');
      // Fix PORT environment variable with numeric value - convert to string
      content = content.replace(/(\s+value:\s+)(\d+)(\s*$)/gm, '$1"$2"$3');
      // Fix template values to ensure they're strings using | quote filter
      content = content.replace(
        /(\s+value:\s+)({{[^}]+}})(\s*$)/gm,
        (match, prefix, templateValue, suffix) => {
          // If it's a numeric template value, add | quote filter
          if (templateValue.includes('targetPort') || templateValue.includes('port')) {
            const cleanTemplate = templateValue.replace('}}', ' | quote }}');
            return `${prefix}${cleanTemplate}${suffix}`;
          }
          // Otherwise, just add quotes
          return `${prefix}"${templateValue}"${suffix}`;
        },
      );
      writeFileSync(filePath, content);
    }
  };

  // Apply fixes to deployment files
  const backendDeploymentPath = join(
    chartDir,
    'charts',
    'backend',
    'templates',
    'backend-deployment-generated.yaml',
  );
  const frontendDeploymentPath = join(
    chartDir,
    'charts',
    'frontend',
    'templates',
    'frontend-deployment-generated.yaml',
  );
  fixEnvVariables(backendDeploymentPath);
  fixEnvVariables(frontendDeploymentPath);
}

describe('Timonel - Simple Umbrella Integration Test', () => {
  it('should create umbrella chart with backend and frontend without errors', () => {
    // Create backend chart with values
    const backendChart = new Rutter({
      meta: {
        name: 'backend',
        version: '1.0.0',
        description: 'Backend service',
      },
      defaultValues: {
        replicaCount: 2,
        image: {
          repository: 'nginx',
          tag: '1.21',
          pullPolicy: 'IfNotPresent',
        },
        service: {
          type: 'ClusterIP',
          port: 8080,
          targetPort: 8080,
        },
        resources: {
          limits: {
            cpu: '500m',
            memory: '512Mi',
          },
          requests: {
            cpu: '250m',
            memory: '256Mi',
          },
        },
        autoscaling: {
          enabled: false,
          minReplicas: 1,
          maxReplicas: 10,
          targetCPUUtilizationPercentage: 80,
        },
        nodeSelector: {},
        tolerations: [],
        affinity: {},
      },
    });

    // Backend deployment - usando kplus para abstracciones de alto nivel
    const backendApp = new App();
    const backendCdk8sChart = new Chart(backendApp, 'backend');

    // Crear deployment usando kplus.Deployment con configuración simplificada
    const backendDeployment = new kplus.Deployment(backendCdk8sChart, 'backend-deployment', {
      metadata: {
        name: '{{ include "backend.fullname" . }}',
        labels: {
          'app.kubernetes.io/name': '{{ include "backend.name" . }}',
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
          'app.kubernetes.io/version': '{{ .Chart.AppVersion }}',
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'helm.sh/chart': '{{ include "backend.chart" . }}',
        },
      },
      replicas: 2,
      podMetadata: {
        labels: {
          'app.kubernetes.io/name': '{{ include "backend.name" . }}',
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
        },
      },
      securityContext: {
        user: 1000,
        group: 2000,
        ensureNonRoot: true,
      },
      containers: [
        {
          name: 'backend',
          image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
          imagePullPolicy: kplus.ImagePullPolicy.IF_NOT_PRESENT,
          ports: [
            {
              name: 'http',
              number: 8080,
              protocol: kplus.Protocol.TCP,
            },
          ],
          securityContext: {
            allowPrivilegeEscalation: false,
            readOnlyRootFilesystem: true,
            ensureNonRoot: true,
            user: 1000,
          },
          envVariables: {
            NODE_ENV: kplus.EnvValue.fromValue('production'),
            PORT: kplus.EnvValue.fromValue('8080'),
          },
          liveness: kplus.Probe.fromHttpGet('/health', {
            port: 8080,
            initialDelaySeconds: Duration.seconds(30),
            periodSeconds: Duration.seconds(10),
            timeoutSeconds: Duration.seconds(5),
            failureThreshold: 3,
          }),
          readiness: kplus.Probe.fromHttpGet('/ready', {
            port: 8080,
            initialDelaySeconds: Duration.seconds(5),
            periodSeconds: Duration.seconds(5),
            timeoutSeconds: Duration.seconds(3),
            failureThreshold: 3,
          }),
        },
      ],
    });

    // Add temporary volume using kplus
    const tmpVolume = kplus.Volume.fromEmptyDir(backendCdk8sChart, 'tmp-volume', 'tmp');
    backendDeployment.containers[0].mount('/tmp', tmpVolume);

    // Synthesize and add k8plus manifests to Rutter chart
    backendApp.synth();

    // Get synthesized manifests from chart and add them to Rutter chart
    const backendManifests = backendCdk8sChart.toJson();
    for (const manifest of backendManifests) {
      // Generate a valid ID without special characters
      const manifestId = `backend-${manifest.kind?.toLowerCase()}-generated`;
      backendChart.addManifest(manifest, manifestId);
    }

    // Backend service will be handled by k8plus deployment configuration

    // Add conditional namespace manifest to backend chart
    backendChart.addConditionalManifest(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: 'test-app',
          labels: {
            'app.kubernetes.io/name': 'test-app',
            'app.kubernetes.io/managed-by': 'helm',
          },
        },
      },
      'namespace.enabled',
      'namespace',
    );

    // Create frontend chart with values
    const frontendChart = new Rutter({
      meta: {
        name: 'frontend',
        version: '1.0.0',
        description: 'Frontend service',
      },
      defaultValues: {
        replicaCount: 3,
        image: {
          repository: 'nginx',
          tag: '1.21',
          pullPolicy: 'IfNotPresent',
        },
        service: {
          type: 'ClusterIP',
          port: 80,
          targetPort: 80,
        },
        ingress: {
          enabled: true,
          className: 'nginx',
          annotations: {
            'nginx.ingress.kubernetes.io/rewrite-target': '/',
          },
          hosts: [
            {
              host: 'frontend.local',
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                },
              ],
            },
          ],
          tls: [],
        },
        resources: {
          limits: {
            cpu: '200m',
            memory: '256Mi',
          },
          requests: {
            cpu: '100m',
            memory: '128Mi',
          },
        },
        autoscaling: {
          enabled: false,
          minReplicas: 1,
          maxReplicas: 5,
          targetCPUUtilizationPercentage: 80,
        },
      },
    });

    // Frontend deployment
    const frontendApp = new App();
    const frontendCdk8sChart = new Chart(frontendApp, 'frontend');

    new ApiObject(frontendCdk8sChart, 'frontend-deployment', {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: '{{ include "frontend.fullname" . }}',
        labels: {
          'app.kubernetes.io/name': '{{ include "frontend.name" . }}',
          'app.kubernetes.io/instance': '{{ .Release.Name }}',
          'app.kubernetes.io/version': '{{ .Chart.AppVersion }}',
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'helm.sh/chart': '{{ include "frontend.chart" . }}',
        },
      },
      spec: {
        replicas: '{{ .Values.replicaCount }}',
        selector: {
          matchLabels: {
            'app.kubernetes.io/name': '{{ include "frontend.name" . }}',
            'app.kubernetes.io/instance': '{{ .Release.Name }}',
          },
        },
        template: {
          metadata: {
            labels: {
              'app.kubernetes.io/name': '{{ include "frontend.name" . }}',
              'app.kubernetes.io/instance': '{{ .Release.Name }}',
            },
          },
          spec: {
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 1001,
              fsGroup: 2001,
            },
            containers: [
              {
                name: 'frontend',
                image: '{{ .Values.image.repository }}:{{ .Values.image.tag }}',
                imagePullPolicy: '{{ .Values.image.pullPolicy }}',
                ports: [
                  {
                    name: 'http',
                    containerPort: '{{ .Values.service.targetPort }}',
                    protocol: 'TCP',
                  },
                ],
                securityContext: {
                  allowPrivilegeEscalation: false,
                  readOnlyRootFilesystem: true,
                  runAsNonRoot: true,
                  runAsUser: 1001,
                  capabilities: {
                    drop: ['ALL'],
                  },
                },
                env: [
                  {
                    name: 'NODE_ENV',
                    value: 'production',
                  },
                  {
                    name: 'PORT',
                    value: '{{ .Values.service.targetPort }}',
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: '/',
                    port: '{{ .Values.service.targetPort }}',
                  },
                  initialDelaySeconds: 30,
                  periodSeconds: 10,
                  timeoutSeconds: 5,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  httpGet: {
                    path: '/',
                    port: '{{ .Values.service.targetPort }}',
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                  timeoutSeconds: 3,
                  failureThreshold: 3,
                },
                resources: '{{ toYaml .Values.resources | nindent 12 }}',
                volumeMounts: [
                  {
                    name: 'tmp',
                    mountPath: '/tmp',
                  },
                ],
              },
            ],
            volumes: [
              {
                name: 'tmp',
                emptyDir: {},
              },
            ],
          },
        },
      },
    });

    // Synthesize and add cdk8s manifests to Rutter chart
    frontendApp.synth();

    // Get synthesized manifests from chart and add them to Rutter chart
    const frontendManifests = frontendCdk8sChart.toJson();
    for (const manifest of frontendManifests) {
      // Generate a valid ID without special characters
      const manifestId = `frontend-${manifest.kind?.toLowerCase()}-generated`;
      frontendChart.addManifest(manifest, manifestId);
    }

    // Frontend service will be handled by cdk8s deployment configuration

    // Define subcharts for backend and frontend
    const subcharts: SubchartSpec[] = [
      {
        name: 'backend',
        rutter: backendChart,
        version: '1.0.0',
        condition: 'backend.enabled',
      },
      {
        name: 'frontend',
        rutter: frontendChart,
        version: '1.0.0',
        condition: 'frontend.enabled',
      },
    ];

    // Create umbrella chart with conditional manifests
    const umbrellaChart = new Rutter({
      meta: {
        name: 'simple-app-umbrella',
        version: '1.0.0',
        description: 'Umbrella chart for simple app',
      },
      defaultValues: {},
    });

    // Add conditional namespace to umbrella chart
    umbrellaChart.addConditionalManifest(
      {
        apiVersion: 'v1',
        kind: 'Namespace',
        metadata: {
          name: 'simple-app',
          labels: {
            'app.kubernetes.io/name': 'simple-app',
          },
        },
      },
      'namespace.enabled',
      'namespace',
    );

    // Add conditional ingress to umbrella chart
    umbrellaChart.addConditionalManifest(
      {
        apiVersion: 'networking.k8s.io/v1',
        kind: 'Ingress',
        metadata: {
          name: 'simple-app-ingress',
          namespace: 'simple-app',
          annotations: {
            'kubernetes.io/ingress.class': 'nginx',
          },
        },
        spec: {
          rules: [
            {
              host: 'simple-app.local',
              http: {
                paths: [
                  {
                    path: '/api',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: 'backend',
                        port: {
                          number: 8080,
                        },
                      },
                    },
                  },
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: {
                        name: 'frontend',
                        port: {
                          number: 3000,
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
      'ingress.enabled',
      'ingress',
    );

    // Create umbrella chart
    const umbrella = createUmbrella({
      meta: {
        name: 'simple-app',
        version: '1.0.0',
        description: 'Simple app with backend and frontend',
      },
      subcharts,
      defaultValues: {
        namespace: {
          enabled: true,
        },
        ingress: {
          enabled: true,
        },
        backend: {
          enabled: true,
        },
        frontend: {
          enabled: true,
        },
      },
    });

    // Test that umbrella creation completes without errors
    expect(() => {
      expect(umbrella).toBeDefined();
    }).not.toThrow();

    // Test write operation to create umbrella-write folder
    expect(() => {
      const tempDir = './temp-test/umbrella-write';
      umbrella.write(tempDir);

      // Fix generated chart templates after writing
      fixChartTemplates(tempDir);
    }).not.toThrow();

    // Verify umbrella chart was created
    expect(umbrella).toBeDefined();
  });
});
