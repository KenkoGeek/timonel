/**
 * @fileoverview Consolidated test suite for Timonel - Helm umbrella chart generator
 * Tests that synth creates charts without errors with conditional namespace and ingress
 * @since 2.9.0
 */

import { describe, expect, it } from 'vitest';
import { ApiObject, App, Chart, Duration } from 'cdk8s';
import * as kplus from 'cdk8s-plus-33';

import { Rutter } from '../src/lib/rutter.js';
import { createUmbrella } from '../src/lib/umbrella.js';
import type { SubchartSpec } from '../src/lib/umbrella.js';

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

    // Agregar volumen temporal usando kplus
    const tmpVolume = kplus.Volume.fromEmptyDir(backendCdk8sChart, 'tmp-volume', 'tmp');
    backendDeployment.containers[0].mount('/tmp', tmpVolume);

    backendApp.synth();

    // Add backend service
    backendChart.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'backend',
          labels: {
            app: 'backend',
          },
        },
        spec: {
          type: '{{ .Values.service.type }}',
          ports: [
            {
              port: '{{ .Values.service.port }}',
              targetPort: '{{ .Values.service.targetPort }}',
              protocol: 'TCP',
              name: 'http',
            },
          ],
          selector: {
            app: 'backend',
          },
        },
      },
      'backend-service',
    );

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

    // Add frontend service
    frontendChart.addManifest(
      {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          name: 'frontend',
          labels: {
            app: 'frontend',
          },
        },
        spec: {
          type: '{{ .Values.service.type }}',
          ports: [
            {
              port: '{{ .Values.service.port }}',
              targetPort: '{{ .Values.service.targetPort }}',
              protocol: 'TCP',
              name: 'http',
            },
          ],
          selector: {
            app: 'frontend',
          },
        },
      },
      'frontend-service',
    );

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
    }).not.toThrow();

    // Verify umbrella chart was created
    expect(umbrella).toBeDefined();
  });
});
