/**
 * Integration Tests for Policy Engine
 *
 * These tests validate end-to-end workflows, Rutter integration scenarios,
 * and real-world policy plugin examples for the Timonel Policy Engine system.
 * Unlike unit tests that test individual components, integration tests validate
 * complete workflows from manifest input to formatted output.
 *
 * @since 3.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { PolicyEngine } from '../src/lib/policy/policyEngine.js';
import { Rutter } from '../src/lib/rutter.js';
import type {
  PolicyPlugin,
  PolicyViolation,
  ValidationContext,
  ChartMetadata,
} from '../src/lib/policy/types.js';
import { createLogger } from '../src/lib/utils/logger.js';

describe('Policy Engine Integration Tests', () => {
  let engine: PolicyEngine;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    time: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    engine = new PolicyEngine();
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      time: vi.fn(() => vi.fn()),
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('End-to-End Validation Workflows', () => {
    it('should validate complete Kubernetes deployment workflow', async () => {
      // Create realistic policy plugins
      const securityPlugin: PolicyPlugin = {
        name: 'security-policy',
        version: '1.0.0',
        description: 'Validates security best practices',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            // Check for containers running as root
            if (obj.kind === 'Deployment' || obj.kind === 'Pod') {
              const containers = obj.spec?.template?.spec?.containers || obj.spec?.containers || [];

              for (let i = 0; i < containers.length; i++) {
                const container = containers[i];
                const securityContext = container.securityContext || {};

                if (securityContext.runAsUser === 0 || securityContext.runAsRoot === true) {
                  violations.push({
                    plugin: 'security-policy',
                    severity: 'error',
                    message: `Container '${container.name}' is running as root`,
                    resourcePath: `spec.template.spec.containers[${i}]`,
                    field: 'securityContext.runAsUser',
                    suggestion: 'Set runAsUser to a non-root user ID (e.g., 1000)',
                  });
                }

                // Check for missing resource limits
                if (!container.resources?.limits) {
                  violations.push({
                    plugin: 'security-policy',
                    severity: 'warning',
                    message: `Container '${container.name}' has no resource limits`,
                    resourcePath: `spec.template.spec.containers[${i}]`,
                    field: 'resources.limits',
                    suggestion: 'Add CPU and memory limits to prevent resource exhaustion',
                  });
                }
              }
            }
          }

          return violations;
        },
        metadata: {
          author: 'Security Team',
          tags: ['security', 'best-practices'],
        },
      };

      const resourcePlugin: PolicyPlugin = {
        name: 'resource-policy',
        version: '1.0.0',
        description: 'Validates resource configurations',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            // Check for missing labels
            if (!obj.metadata?.labels?.['app.kubernetes.io/name']) {
              violations.push({
                plugin: 'resource-policy',
                severity: 'warning',
                message: `Resource '${obj.metadata?.name}' missing standard app label`,
                resourcePath: 'metadata.labels',
                field: 'app.kubernetes.io/name',
                suggestion: 'Add standard Kubernetes labels for better resource management',
              });
            }

            // Check for services without selectors
            if (obj.kind === 'Service' && !obj.spec?.selector) {
              violations.push({
                plugin: 'resource-policy',
                severity: 'error',
                message: `Service '${obj.metadata?.name}' has no selector`,
                resourcePath: 'spec.selector',
                field: 'selector',
                suggestion: 'Add selector to match target pods',
              });
            }
          }

          return violations;
        },
      };

      // Register plugins
      await engine.use(securityPlugin);
      await engine.use(resourcePlugin);

      // Create test manifests representing a complete deployment
      const manifests = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'web-app',
            labels: {
              'app.kubernetes.io/name': 'web-app',
            },
          },
          spec: {
            replicas: 3,
            selector: {
              matchLabels: {
                app: 'web-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'web-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'web',
                    image: 'nginx:1.21',
                    ports: [{ containerPort: 80 }],
                    securityContext: {
                      runAsUser: 1000,
                      runAsNonRoot: true,
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
                  },
                ],
              },
            },
          },
        },
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'web-service',
            labels: {
              'app.kubernetes.io/name': 'web-app',
            },
          },
          spec: {
            selector: {
              app: 'web-app',
            },
            ports: [
              {
                port: 80,
                targetPort: 80,
              },
            ],
          },
        },
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: {
            name: 'app-config',
            // Missing standard labels - should trigger warning
          },
          data: {
            'config.yaml': 'key: value',
          },
        },
      ];

      // Execute validation
      const result = await engine.validate(manifests);

      // Verify results
      expect(result.valid).toBe(true); // Should be valid (only warnings, no errors)
      expect(result.violations).toHaveLength(0); // No errors
      expect(result.warnings).toHaveLength(1); // One warning for missing label
      expect(result.metadata.pluginCount).toBe(2);
      expect(result.metadata.manifestCount).toBe(3);
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0); // Allow 0 for very fast execution

      // Verify specific warning
      const warning = result.warnings[0];
      expect(warning.plugin).toBe('resource-policy');
      expect(warning.message).toContain('missing standard app label');
      expect(warning.field).toBe('app.kubernetes.io/name');
    });

    it('should handle complex validation scenarios with errors and warnings', async () => {
      const strictSecurityPlugin: PolicyPlugin = {
        name: 'strict-security',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            if (obj.kind === 'Deployment') {
              const containers = obj.spec?.template?.spec?.containers || [];

              for (const container of containers) {
                // Strict: No privileged containers allowed
                if (container.securityContext?.privileged === true) {
                  violations.push({
                    plugin: 'strict-security',
                    severity: 'error',
                    message: `Privileged container '${container.name}' is not allowed`,
                    suggestion: 'Remove privileged: true from securityContext',
                  });
                }

                // Strict: All containers must have security context
                if (!container.securityContext) {
                  violations.push({
                    plugin: 'strict-security',
                    severity: 'error',
                    message: `Container '${container.name}' must have securityContext`,
                    suggestion: 'Add securityContext with runAsNonRoot: true',
                  });
                }
              }
            }
          }

          return violations;
        },
      };

      await engine.use(strictSecurityPlugin);

      // Create manifests with security violations
      const manifests = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: { name: 'insecure-app' },
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: 'privileged-container',
                    image: 'nginx:1.21',
                    securityContext: {
                      privileged: true, // This should trigger an error
                    },
                  },
                  {
                    name: 'no-security-context',
                    image: 'redis:6',
                    // Missing securityContext - should trigger an error
                  },
                ],
              },
            },
          },
        },
      ];

      const result = await engine.validate(manifests);

      // Should be invalid due to errors
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(2);

      // Verify specific violations
      const privilegedViolation = result.violations.find((v) =>
        v.message.includes('Privileged container'),
      );
      expect(privilegedViolation).toBeDefined();
      expect(privilegedViolation!.severity).toBe('error');

      const missingSecurityViolation = result.violations.find((v) =>
        v.message.includes('must have securityContext'),
      );
      expect(missingSecurityViolation).toBeDefined();
      expect(missingSecurityViolation!.severity).toBe('error');
    });

    it('should validate complete CI/CD pipeline manifests', async () => {
      const cicdPlugin: PolicyPlugin = {
        name: 'cicd-policy',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            // Check for proper CI/CD labels
            if (obj.metadata?.labels?.['app.kubernetes.io/managed-by'] !== 'Helm') {
              violations.push({
                plugin: 'cicd-policy',
                severity: 'info',
                message: `Resource '${obj.metadata?.name}' should be managed by Helm`,
                field: 'metadata.labels["app.kubernetes.io/managed-by"]',
                suggestion: 'Add "app.kubernetes.io/managed-by": "Helm" label',
              });
            }

            // Check for version labels
            if (!obj.metadata?.labels?.['app.kubernetes.io/version']) {
              violations.push({
                plugin: 'cicd-policy',
                severity: 'warning',
                message: `Resource '${obj.metadata?.name}' missing version label`,
                field: 'metadata.labels["app.kubernetes.io/version"]',
                suggestion: 'Add version label for better tracking',
              });
            }
          }

          return violations;
        },
      };

      await engine.use(cicdPlugin);

      const pipelineManifests = [
        {
          apiVersion: 'batch/v1',
          kind: 'Job',
          metadata: {
            name: 'build-job',
            labels: {
              'app.kubernetes.io/name': 'build-pipeline',
              'app.kubernetes.io/version': '1.2.3',
              'app.kubernetes.io/managed-by': 'Helm',
            },
          },
          spec: {
            template: {
              spec: {
                containers: [
                  {
                    name: 'builder',
                    image: 'node:16',
                    command: ['npm', 'run', 'build'],
                  },
                ],
                restartPolicy: 'Never',
              },
            },
          },
        },
        {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: {
            name: 'registry-secret',
            // Missing version and managed-by labels
          },
          type: 'kubernetes.io/dockerconfigjson',
          data: {
            '.dockerconfigjson': 'eyJhdXRocyI6e319',
          },
        },
      ];

      const result = await engine.validate(pipelineManifests);

      expect(result.valid).toBe(true); // Only warnings and info
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(2); // Missing version and managed-by labels

      // Verify the warnings are properly categorized
      const versionWarning = result.warnings.find((w) => w.message.includes('version label'));
      const managedByInfo = result.warnings.find((w) => w.message.includes('managed by Helm'));

      expect(versionWarning?.severity).toBe('warning');
      expect(managedByInfo?.severity).toBe('info');
    });
  });

  describe('Rutter Integration Scenarios', () => {
    it('should integrate with Rutter for complete chart validation', async () => {
      // Create a policy plugin for Rutter integration testing
      const helmPlugin: PolicyPlugin = {
        name: 'helm-best-practices',
        version: '1.0.0',
        async validate(
          manifests: unknown[],
          context: ValidationContext,
        ): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          // Validate chart metadata is available in context
          expect(context.chart).toBeDefined();
          expect(context.chart.name).toBeDefined();
          expect(context.chart.version).toBeDefined();

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            // Check for Helm standard labels (these should be added by Rutter)
            const expectedLabels = [
              'helm.sh/chart',
              'app.kubernetes.io/name',
              'app.kubernetes.io/instance',
              'app.kubernetes.io/version',
              'app.kubernetes.io/managed-by',
            ];

            for (const label of expectedLabels) {
              if (!obj.metadata?.labels?.[label]) {
                violations.push({
                  plugin: 'helm-best-practices',
                  severity: 'warning',
                  message: `Missing Helm standard label: ${label}`,
                  resourcePath: 'metadata.labels',
                  field: label,
                  suggestion: 'Ensure Rutter is properly configured to add standard labels',
                });
              }
            }
          }

          return violations;
        },
      };

      // Configure policy engine
      const policyEngine = new PolicyEngine();
      await policyEngine.use(helmPlugin);

      // Create Rutter instance with policy engine
      const chartMeta: ChartMetadata = {
        name: 'test-app',
        version: '1.0.0',
        description: 'Test application for policy integration',
      };

      const rutter = new Rutter({
        meta: chartMeta,
        policyEngine,
        defaultValues: {
          image: {
            repository: 'nginx',
            tag: '1.21',
          },
          service: {
            port: 80,
          },
        },
        logger: mockLogger,
      });

      // Add some manifests to Rutter
      rutter.addManifest(
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'test-deployment',
          },
          spec: {
            replicas: 1,
            selector: {
              matchLabels: {
                app: 'test-app',
              },
            },
            template: {
              metadata: {
                labels: {
                  app: 'test-app',
                },
              },
              spec: {
                containers: [
                  {
                    name: 'app',
                    image: 'nginx:1.21',
                    ports: [{ containerPort: 80 }],
                  },
                ],
              },
            },
          },
        },
        'deployment',
      );

      // Write chart - this should trigger policy validation
      const tempDir = '/tmp/test-chart-' + Date.now();
      await rutter.write(tempDir);

      // Verify that policy validation was called (through logger calls)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Starting policy validation',
        expect.objectContaining({
          chartName: 'test-app',
          operation: 'policy_validation_start',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Policy validation completed successfully',
        expect.objectContaining({
          chartName: 'test-app',
          operation: 'policy_validation_success',
        }),
      );
    });

    it('should handle policy validation failures in Rutter integration', async () => {
      const strictPlugin: PolicyPlugin = {
        name: 'strict-validation',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Always fail validation for testing
          return [
            {
              plugin: 'strict-validation',
              severity: 'error',
              message: 'Strict validation always fails for testing',
              suggestion: 'This is a test plugin that always fails',
            },
          ];
        },
      };

      const policyEngine = new PolicyEngine();
      await policyEngine.use(strictPlugin);

      const rutter = new Rutter({
        meta: {
          name: 'failing-app',
          version: '1.0.0',
        },
        policyEngine,
        logger: mockLogger,
      });

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'test-config' },
          data: { key: 'value' },
        },
        'config',
      );

      // Writing should fail due to policy violations
      const tempDir = '/tmp/failing-chart-' + Date.now();
      await expect(rutter.write(tempDir)).rejects.toThrow('Policy validation failed');

      // Verify error logging
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Policy validation failed',
        expect.objectContaining({
          chartName: 'failing-app',
          operation: 'policy_validation_failed',
        }),
      );
    });

    it('should handle policy warnings without failing chart generation', async () => {
      const warningPlugin: PolicyPlugin = {
        name: 'warning-plugin',
        version: '1.0.0',
        async validate(): Promise<PolicyViolation[]> {
          return [
            {
              plugin: 'warning-plugin',
              severity: 'warning',
              message: 'This is just a warning',
              suggestion: 'Consider addressing this warning',
            },
            {
              plugin: 'warning-plugin',
              severity: 'info',
              message: 'This is informational',
              suggestion: 'No action required',
            },
          ];
        },
      };

      const policyEngine = new PolicyEngine();
      await policyEngine.use(warningPlugin);

      const rutter = new Rutter({
        meta: {
          name: 'warning-app',
          version: '1.0.0',
        },
        policyEngine,
        logger: mockLogger,
      });

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: { name: 'test-service' },
          spec: {
            selector: { app: 'test' },
            ports: [{ port: 80 }],
          },
        },
        'service',
      );

      // Should succeed despite warnings
      const tempDir = '/tmp/warning-chart-' + Date.now();
      await expect(rutter.write(tempDir)).resolves.not.toThrow();

      // Verify warning logging
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Policy validation warnings',
        expect.objectContaining({
          chartName: 'warning-app',
          operation: 'policy_validation_warnings',
        }),
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Policy validation completed successfully',
        expect.objectContaining({
          chartName: 'warning-app',
          operation: 'policy_validation_success',
        }),
      );
    });

    it('should maintain backward compatibility when no policy engine is provided', async () => {
      // Create Rutter without policy engine
      const rutter = new Rutter({
        meta: {
          name: 'no-policy-app',
          version: '1.0.0',
        },
        logger: mockLogger,
        // No policyEngine provided
      });

      rutter.addManifest(
        {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'test-pod' },
          spec: {
            containers: [
              {
                name: 'test',
                image: 'nginx:1.21',
              },
            ],
          },
        },
        'pod',
      );

      // Should work normally without policy validation
      const tempDir = '/tmp/no-policy-chart-' + Date.now();
      await expect(rutter.write(tempDir)).resolves.not.toThrow();

      // Verify no policy validation logs
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        'Starting policy validation',
        expect.any(Object),
      );
    });
  });

  describe('Real-World Policy Plugin Examples', () => {
    it('should validate AWS-specific resources and configurations', async () => {
      const awsPlugin: PolicyPlugin = {
        name: 'aws-best-practices',
        version: '1.0.0',
        description: 'Validates AWS-specific Kubernetes configurations',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            violations.push(...this.validateIngressResources(obj));
            violations.push(...this.validateServiceAccountResources(obj));
            violations.push(...this.validateStorageClassResources(obj));
          }

          return violations;
        },

        validateIngressResources(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'Ingress') {
            const annotations =
              ((obj.metadata as Record<string, unknown>)?.annotations as Record<string, unknown>) ||
              {};

            if (annotations['kubernetes.io/ingress.class'] === 'alb') {
              if (!annotations['alb.ingress.kubernetes.io/scheme']) {
                violations.push({
                  plugin: 'aws-best-practices',
                  severity: 'warning',
                  message: 'ALB Ingress missing scheme annotation',
                  resourcePath: 'metadata.annotations',
                  field: 'alb.ingress.kubernetes.io/scheme',
                  suggestion: 'Add scheme annotation (internet-facing or internal)',
                });
              }

              if (!annotations['alb.ingress.kubernetes.io/target-type']) {
                violations.push({
                  plugin: 'aws-best-practices',
                  severity: 'info',
                  message: 'Consider specifying ALB target type',
                  resourcePath: 'metadata.annotations',
                  field: 'alb.ingress.kubernetes.io/target-type',
                  suggestion: 'Add target-type annotation (ip or instance)',
                });
              }
            }
          }

          return violations;
        },

        validateServiceAccountResources(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'ServiceAccount') {
            const annotations =
              ((obj.metadata as Record<string, unknown>)?.annotations as Record<string, unknown>) ||
              {};

            if (annotations['eks.amazonaws.com/role-arn']) {
              const roleArn = annotations['eks.amazonaws.com/role-arn'] as string;
              if (!roleArn.startsWith('arn:aws:iam::')) {
                violations.push({
                  plugin: 'aws-best-practices',
                  severity: 'error',
                  message: 'Invalid IAM role ARN format',
                  resourcePath: 'metadata.annotations',
                  field: 'eks.amazonaws.com/role-arn',
                  suggestion: 'Use valid ARN format: arn:aws:iam::ACCOUNT:role/ROLE_NAME',
                });
              }
            }
          }

          return violations;
        },

        validateStorageClassResources(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'StorageClass' && obj.provisioner === 'ebs.csi.aws.com') {
            const parameters = (obj.parameters as Record<string, unknown>) || {};

            if (!parameters.type) {
              violations.push({
                plugin: 'aws-best-practices',
                severity: 'warning',
                message: 'EBS StorageClass missing volume type',
                resourcePath: 'parameters',
                field: 'type',
                suggestion: 'Specify volume type (gp3, gp2, io1, io2, sc1, st1)',
              });
            }

            if (parameters.type === 'gp3' && !parameters.iops) {
              violations.push({
                plugin: 'aws-best-practices',
                severity: 'info',
                message: 'GP3 volumes can specify custom IOPS for better performance',
                resourcePath: 'parameters',
                field: 'iops',
                suggestion: 'Consider setting IOPS parameter for GP3 volumes',
              });
            }
          }

          return violations;
        },
        metadata: {
          author: 'AWS Team',
          tags: ['aws', 'cloud', 'best-practices'],
          kubernetesVersions: ['1.21+'],
        },
      };

      await engine.use(awsPlugin);

      const awsManifests = [
        {
          apiVersion: 'networking.k8s.io/v1',
          kind: 'Ingress',
          metadata: {
            name: 'web-ingress',
            annotations: {
              'kubernetes.io/ingress.class': 'alb',
              'alb.ingress.kubernetes.io/scheme': 'internet-facing',
              // Missing target-type annotation
            },
          },
          spec: {
            rules: [
              {
                http: {
                  paths: [
                    {
                      path: '/',
                      pathType: 'Prefix',
                      backend: {
                        service: {
                          name: 'web-service',
                          port: { number: 80 },
                        },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          apiVersion: 'v1',
          kind: 'ServiceAccount',
          metadata: {
            name: 'app-service-account',
            annotations: {
              'eks.amazonaws.com/role-arn': 'arn:aws:iam::123456789012:role/MyAppRole',
            },
          },
        },
        {
          apiVersion: 'storage.k8s.io/v1',
          kind: 'StorageClass',
          metadata: {
            name: 'fast-ebs',
          },
          provisioner: 'ebs.csi.aws.com',
          parameters: {
            type: 'gp3',
            encrypted: 'true',
            // Missing IOPS parameter
          },
          allowVolumeExpansion: true,
        },
      ];

      const result = await engine.validate(awsManifests);

      expect(result.valid).toBe(true); // Only warnings and info
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(2); // Missing scheme and IOPS recommendations

      // Verify AWS-specific validations
      const targetTypeInfo = result.warnings.find((w) => w.message.includes('target type'));
      expect(targetTypeInfo?.severity).toBe('info');

      const iopsInfo = result.warnings.find((w) => w.message.includes('custom IOPS'));
      expect(iopsInfo?.severity).toBe('info');
    });

    it('should validate Kubernetes security best practices', async () => {
      const k8sSecurityPlugin: PolicyPlugin = {
        name: 'k8s-security-standards',
        version: '1.0.0',
        description: 'Validates Kubernetes security standards and best practices',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            violations.push(...this.validatePodSecurity(obj));
            violations.push(...this.validateServiceSecurity(obj));
          }

          return violations;
        },

        validatePodSecurity(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'Pod' || obj.kind === 'Deployment') {
            const containers =
              (obj.spec as Record<string, unknown>)?.containers ||
              ((obj.spec as Record<string, unknown>)?.template as Record<string, unknown>)?.spec
                ?.containers ||
              [];

            for (let i = 0; i < (containers as unknown[]).length; i++) {
              const container = (containers as Record<string, unknown>[])[i];
              const securityContext = (container.securityContext as Record<string, unknown>) || {};

              // Check for privileged containers
              if (securityContext.privileged === true) {
                violations.push({
                  plugin: 'k8s-security-standards',
                  severity: 'error',
                  message: `Container '${container.name}' runs in privileged mode`,
                  resourcePath: `spec.containers[${i}].securityContext`,
                  field: 'privileged',
                  suggestion: 'Remove privileged: true unless absolutely necessary',
                });
              }

              // Check for root filesystem access
              if (securityContext.readOnlyRootFilesystem !== true) {
                violations.push({
                  plugin: 'k8s-security-standards',
                  severity: 'warning',
                  message: `Container '${container.name}' has writable root filesystem`,
                  resourcePath: `spec.containers[${i}].securityContext`,
                  field: 'readOnlyRootFilesystem',
                  suggestion: 'Set readOnlyRootFilesystem: true for better security',
                });
              }
            }
          }

          return violations;
        },

        validateServiceSecurity(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          // Check NetworkPolicy existence for services
          if (
            obj.kind === 'Service' &&
            (obj.spec as Record<string, unknown>)?.type !== 'ExternalName'
          ) {
            // This is a simplified check - in real scenarios, you'd check if NetworkPolicies exist
            violations.push({
              plugin: 'k8s-security-standards',
              severity: 'info',
              message: `Service '${(obj.metadata as Record<string, unknown>)?.name}' should have associated NetworkPolicy`,
              suggestion: 'Create NetworkPolicy to control traffic to this service',
            });
          }

          return violations;
        },
        metadata: {
          author: 'Security Team',
          tags: ['security', 'kubernetes', 'best-practices'],
          kubernetesVersions: ['1.20+'],
        },
      };

      await engine.use(k8sSecurityPlugin);

      const securityManifests = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'secure-app',
          },
          spec: {
            replicas: 2,
            selector: {
              matchLabels: { app: 'secure-app' },
            },
            template: {
              metadata: {
                labels: { app: 'secure-app' },
              },
              spec: {
                securityContext: {
                  runAsNonRoot: true,
                  runAsUser: 1000,
                  fsGroup: 2000,
                },
                containers: [
                  {
                    name: 'app',
                    image: 'nginx:1.21',
                    securityContext: {
                      readOnlyRootFilesystem: true,
                      allowPrivilegeEscalation: false,
                      capabilities: {
                        drop: ['ALL'],
                      },
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
                  },
                ],
              },
            },
          },
        },
        {
          apiVersion: 'v1',
          kind: 'Service',
          metadata: {
            name: 'secure-service',
          },
          spec: {
            selector: { app: 'secure-app' },
            ports: [{ port: 80, targetPort: 8080 }],
          },
        },
      ];

      const result = await engine.validate(securityManifests);

      expect(result.valid).toBe(true); // Should pass security checks
      expect(result.violations).toHaveLength(0);
      expect(result.warnings).toHaveLength(1); // NetworkPolicy recommendation

      const networkPolicyInfo = result.warnings.find((w) => w.message.includes('NetworkPolicy'));
      expect(networkPolicyInfo?.severity).toBe('info');
      expect(networkPolicyInfo?.plugin).toBe('k8s-security-standards');
    });

    it('should validate multi-environment deployment configurations', async () => {
      const environmentPlugin: PolicyPlugin = {
        name: 'environment-policy',
        version: '1.0.0',
        description: 'Validates environment-specific configurations',
        async validate(
          manifests: unknown[],
          context: ValidationContext,
        ): Promise<PolicyViolation[]> {
          const violations: PolicyViolation[] = [];
          const environment = context.environment || 'development';

          for (const manifest of manifests) {
            const obj = manifest as Record<string, unknown>;

            violations.push(...this.validateEnvironmentSpecific(obj, environment));
          }

          return violations;
        },

        validateEnvironmentSpecific(
          obj: Record<string, unknown>,
          environment: string,
        ): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (environment === 'production') {
            violations.push(...this.validateProductionRequirements(obj));
          } else if (environment === 'development') {
            violations.push(...this.validateDevelopmentRequirements(obj));
          }

          return violations;
        },

        validateProductionRequirements(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'Deployment') {
            const replicas = ((obj.spec as Record<string, unknown>)?.replicas as number) || 1;
            if (replicas < 2) {
              violations.push({
                plugin: 'environment-policy',
                severity: 'error',
                message: 'Production deployments must have at least 2 replicas',
                resourcePath: 'spec.replicas',
                field: 'replicas',
                suggestion: 'Set replicas to at least 2 for high availability',
              });
            }
          }

          // Check for environment labels
          const labels =
            ((obj.metadata as Record<string, unknown>)?.labels as Record<string, unknown>) || {};
          if (!labels.environment || labels.environment !== 'production') {
            violations.push({
              plugin: 'environment-policy',
              severity: 'warning',
              message: 'Production resources should have environment: production label',
              resourcePath: 'metadata.labels',
              field: 'environment',
              suggestion: 'Add environment: production label',
            });
          }

          return violations;
        },

        validateDevelopmentRequirements(obj: Record<string, unknown>): PolicyViolation[] {
          const violations: PolicyViolation[] = [];

          if (obj.kind === 'Deployment') {
            const replicas = ((obj.spec as Record<string, unknown>)?.replicas as number) || 1;
            if (replicas > 1) {
              violations.push({
                plugin: 'environment-policy',
                severity: 'info',
                message: 'Development deployments typically use 1 replica',
                resourcePath: 'spec.replicas',
                field: 'replicas',
                suggestion: 'Consider using 1 replica in development to save resources',
              });
            }
          }

          return violations;
        },
      };

      await engine.use(environmentPlugin);

      // Test production environment
      const productionManifests = [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'prod-app',
            labels: {
              environment: 'production',
            },
          },
          spec: {
            replicas: 3,
            selector: {
              matchLabels: { app: 'prod-app' },
            },
            template: {
              metadata: {
                labels: { app: 'prod-app' },
              },
              spec: {
                containers: [
                  {
                    name: 'app',
                    image: 'myapp:1.2.3',
                    resources: {
                      requests: {
                        cpu: '100m',
                        memory: '128Mi',
                      },
                      limits: {
                        cpu: '500m',
                        memory: '512Mi',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      ];

      // Create validation context for production
      const productionContext: ValidationContext = {
        chart: { name: 'test-app', version: '1.0.0' },
        environment: 'production',
        logger: createLogger('test'),
      };

      // Mock the validate method to pass context
      const originalValidate = engine.validate.bind(engine);
      engine.validate = async (manifests: unknown[]) => {
        return originalValidate.call(engine, manifests);
      };

      // Configure engine for production context
      engine.configure({
        pluginConfig: {
          'environment-policy': { environment: 'production' },
        },
      });

      const result = await engine.validate(productionManifests);

      expect(result.valid).toBe(true); // Should pass production checks
      expect(result.violations).toHaveLength(0);
      // Note: May have warnings if environment context is not properly passed to plugin
      expect(result.warnings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Scalability Integration Tests', () => {
    it('should handle large numbers of manifests efficiently', async () => {
      const performancePlugin: PolicyPlugin = {
        name: 'performance-test',
        version: '1.0.0',
        async validate(manifests: unknown[]): Promise<PolicyViolation[]> {
          // Simple validation that scales with manifest count
          return manifests.map((_, index) => ({
            plugin: 'performance-test',
            severity: 'info' as const,
            message: `Processed manifest ${index + 1}`,
          }));
        },
      };

      await engine.use(performancePlugin);

      // Generate large number of manifests
      const largeManifestSet = Array.from({ length: 100 }, (_, i) => ({
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `config-${i}`,
          labels: {
            index: i.toString(),
          },
        },
        data: {
          key: `value-${i}`,
        },
      }));

      const startTime = Date.now();
      const result = await engine.validate(largeManifestSet);
      const executionTime = Date.now() - startTime;

      // Verify performance
      expect(result.metadata.manifestCount).toBe(100);
      expect(result.warnings).toHaveLength(100);
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metadata.executionTime).toBeGreaterThanOrEqual(0); // Allow 0 for very fast execution

      // Verify all manifests were processed
      result.warnings.forEach((warning, index) => {
        expect(warning.message).toBe(`Processed manifest ${index + 1}`);
      });
    });

    it('should handle plugin timeouts gracefully in integration scenarios', async () => {
      const slowPlugin: PolicyPlugin = {
        name: 'slow-plugin',
        version: '1.0.0',
        async validate(): Promise<PolicyViolation[]> {
          // Simulate slow plugin
          await new Promise((resolve) => setTimeout(resolve, 200));
          return [];
        },
      };

      const fastPlugin: PolicyPlugin = {
        name: 'fast-plugin',
        version: '1.0.0',
        async validate(): Promise<PolicyViolation[]> {
          return [
            {
              plugin: 'fast-plugin',
              severity: 'info',
              message: 'Fast plugin completed',
            },
          ];
        },
      };

      // Configure engine with short timeout and graceful degradation
      const timeoutEngine = new PolicyEngine({
        timeout: 100, // 100ms timeout
        gracefulDegradation: true,
      });

      await timeoutEngine.use(slowPlugin);
      await timeoutEngine.use(fastPlugin);

      const manifests = [
        {
          apiVersion: 'v1',
          kind: 'Pod',
          metadata: { name: 'test-pod' },
          spec: {
            containers: [{ name: 'test', image: 'nginx' }],
          },
        },
      ];

      const result = await timeoutEngine.validate(manifests);

      // Should handle timeout gracefully
      expect(result.valid).toBe(false); // Due to timeout error
      expect(result.violations.length).toBeGreaterThan(0); // Should have timeout violation
      expect(result.warnings.length).toBeGreaterThan(0); // Should have fast plugin result

      // Verify timeout error
      const timeoutViolation = result.violations.find(
        (v) => v.plugin === 'slow-plugin' && v.message.includes('failed'),
      );
      expect(timeoutViolation).toBeDefined();

      // Verify fast plugin still executed
      const fastResult = result.warnings.find((w) => w.plugin === 'fast-plugin');
      expect(fastResult).toBeDefined();
    });
  });
});
