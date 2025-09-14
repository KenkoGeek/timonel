import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Chart, App } from 'cdk8s';

import { NetworkResources } from '../../src/lib/resources/network/networkResources.js';
import type { IngressSpec } from '../../src/lib/resources/network/networkResources.js';

describe('Ingress TLS Security Validation', () => {
  let networkResources: NetworkResources;
  let chart: Chart;

  beforeEach(() => {
    const app = new App();
    chart = new Chart(app, 'test-chart');
    networkResources = new NetworkResources();
    // Set the chart context for the resource provider
    (networkResources as unknown as { chart: Chart }).chart = chart;
  });

  describe('addSecureIngress', () => {
    it('should create secure Ingress with valid TLS configuration', () => {
      const spec: IngressSpec = {
        name: 'secure-web-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['secure.example.com'],
            secretName: 'secure-example-tls',
          },
        ],
        rules: [
          {
            host: 'secure.example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress).toBeDefined();
      expect(ingress.kind).toBe('Ingress');
      expect(ingress.apiVersion).toBe('networking.k8s.io/v1');
      expect(ingress.metadata.name).toBe('secure-web-ingress');
    });

    it('should throw error for production environment without TLS', () => {
      const spec: IngressSpec = {
        name: 'insecure-ingress',
        environment: 'production',
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addSecureIngress(spec)).toThrow(
        'TLS configuration is required for production Ingress resources',
      );
    });

    it('should throw error for requireTLS without TLS configuration', () => {
      const spec: IngressSpec = {
        name: 'required-tls-ingress',
        requireTLS: true,
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addSecureIngress(spec)).toThrow(
        'TLS configuration is required for production Ingress resources',
      );
    });

    it('should throw error for TLS configuration without secretName', () => {
      const spec: IngressSpec = {
        name: 'invalid-tls-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['example.com'],
            // Missing secretName
          },
        ],
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addSecureIngress(spec)).toThrow(
        'TLS configuration at index 0 must specify a secretName',
      );
    });

    it('should throw error for invalid secret name format', () => {
      const spec: IngressSpec = {
        name: 'invalid-secret-name-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['example.com'],
            secretName: 'Invalid_Secret_Name', // Invalid characters
          },
        ],
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addSecureIngress(spec)).toThrow(
        'Invalid TLS secret name "Invalid_Secret_Name"',
      );
    });

    it('should throw error for invalid hostname format', () => {
      const spec: IngressSpec = {
        name: 'invalid-hostname-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['invalid..hostname'], // Invalid hostname
            secretName: 'valid-secret-name',
          },
        ],
        rules: [
          {
            host: 'invalid..hostname',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addSecureIngress(spec)).toThrow(
        'Invalid hostname "invalid..hostname"',
      );
    });

    it('should accept valid wildcard hostnames', () => {
      const spec: IngressSpec = {
        name: 'wildcard-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['*.example.com'],
            secretName: 'wildcard-tls',
          },
        ],
        rules: [
          {
            host: '*.example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress).toBeDefined();
      expect(ingress.kind).toBe('Ingress');
    });

    it('should apply SSL redirect annotations when TLS is configured', () => {
      const spec: IngressSpec = {
        name: 'ssl-redirect-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['example.com'],
            secretName: 'example-tls',
          },
        ],
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress.metadata.annotations).toMatchObject({
        'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
      });
    });

    it('should apply security headers for production environment', () => {
      const spec: IngressSpec = {
        name: 'security-headers-ingress',
        environment: 'production',
        tls: [
          {
            hosts: ['example.com'],
            secretName: 'example-tls',
          },
        ],
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress.metadata.annotations).toHaveProperty(
        'nginx.ingress.kubernetes.io/configuration-snippet',
      );
      expect(
        ingress.metadata.annotations['nginx.ingress.kubernetes.io/configuration-snippet'],
      ).toContain('X-Frame-Options: DENY');
    });

    it('should allow development environment without TLS', () => {
      const spec: IngressSpec = {
        name: 'dev-ingress',
        environment: 'development',
        rules: [
          {
            host: 'dev.example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress).toBeDefined();
      expect(ingress.kind).toBe('Ingress');
    });

    it('should force SSL redirect when forceSSLRedirect is true', () => {
      const spec: IngressSpec = {
        name: 'force-ssl-ingress',
        environment: 'development',
        forceSSLRedirect: true,
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress.metadata.annotations).toMatchObject({
        'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
      });
    });
  });

  describe('addIngress (backward compatibility)', () => {
    it('should work without validation when no environment is specified', () => {
      const spec: IngressSpec = {
        name: 'legacy-ingress',
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addIngress(spec);

      expect(ingress).toBeDefined();
      expect(ingress.kind).toBe('Ingress');
    });

    it('should apply validation when environment is specified', () => {
      const spec: IngressSpec = {
        name: 'validated-legacy-ingress',
        environment: 'production',
        rules: [
          {
            host: 'example.com',
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      expect(() => networkResources.addIngress(spec)).toThrow(
        'TLS configuration is required for production Ingress resources',
      );
    });
  });

  describe('hostname validation edge cases', () => {
    it('should handle hostname edge cases correctly', () => {
      const maxLengthHostname = 'a'.repeat(63) + '.example.com';
      const maxLengthLabel = 'a'.repeat(64); // Too long
      const invalidWildcard = 'foo.*.example.com';

      // Valid max length hostname
      expect(() =>
        networkResources.addSecureIngress({
          name: 'edge-case-ingress',
          environment: 'production',
          tls: [
            {
              hosts: [maxLengthHostname],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: maxLengthHostname,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).not.toThrow();

      // Invalid max length label
      expect(() =>
        networkResources.addSecureIngress({
          name: 'invalid-label-ingress',
          environment: 'production',
          tls: [
            {
              hosts: [maxLengthLabel + '.example.com'],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: maxLengthLabel + '.example.com',
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).toThrow('Invalid hostname');

      // Invalid wildcard pattern
      expect(() =>
        networkResources.addSecureIngress({
          name: 'invalid-wildcard-ingress',
          environment: 'production',
          tls: [
            {
              hosts: [invalidWildcard],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: invalidWildcard,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).toThrow('Invalid hostname');
    });

    it('should validate hostname length limits', () => {
      const tooLongHostname = 'a'.repeat(254); // Exceeds 253 character limit

      expect(() =>
        networkResources.addSecureIngress({
          name: 'too-long-hostname',
          environment: 'production',
          tls: [
            {
              hosts: [tooLongHostname],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: tooLongHostname,
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).toThrow('Invalid hostname');
    });

    it('should validate wildcard patterns correctly', () => {
      // Valid wildcard
      expect(() =>
        networkResources.addSecureIngress({
          name: 'valid-wildcard',
          environment: 'production',
          tls: [
            {
              hosts: ['*.valid.example.com'],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: '*.valid.example.com',
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).not.toThrow();

      // Invalid wildcard (not at start)
      expect(() =>
        networkResources.addSecureIngress({
          name: 'invalid-wildcard-position',
          environment: 'production',
          tls: [
            {
              hosts: ['sub.*.example.com'],
              secretName: 'tls-secret',
            },
          ],
          rules: [
            {
              host: 'sub.*.example.com',
              http: {
                paths: [
                  {
                    path: '/',
                    pathType: 'Prefix',
                    backend: {
                      service: { name: 'web', port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
        }),
      ).toThrow('Invalid hostname');
    });
  });

  describe('TLS host validation', () => {
    it('should warn when rule hosts are not covered by TLS', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const spec: IngressSpec = {
        name: 'mismatched-hosts-ingress',
        environment: 'staging',
        tls: [
          {
            hosts: ['secure.example.com'],
            secretName: 'example-tls',
          },
        ],
        rules: [
          {
            host: 'insecure.example.com', // Not in TLS hosts
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: { name: 'web-service', port: { number: 80 } },
                  },
                },
              ],
            },
          },
        ],
      };

      const ingress = networkResources.addSecureIngress(spec);

      expect(ingress).toBeDefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Host "insecure.example.com" in Ingress rules is not covered by TLS configuration',
        ),
      );

      consoleSpy.mockRestore();
    });
  });
});
