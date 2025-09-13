/**
 * @fileoverview Unit tests for enhanced NGINX Ingress functionality
 * @since 2.9.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { App, Chart } from 'cdk8s';

import { NetworkResources } from '../../src/lib/resources/network/networkResources.js';

describe('NetworkResources - NGINX Ingress Enhancement', () => {
  let app: App;
  let chart: Chart;
  let networkResources: NetworkResources;

  beforeEach(() => {
    app = new App();
    chart = new Chart(app, 'test-chart');
    networkResources = new NetworkResources(chart, 'test-network');
  });

  describe('addSecureIngress', () => {
    it('should create a secure Ingress with TLS validation', () => {
      const ingress = networkResources.addSecureIngress({
        name: 'secure-ingress',
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
      });

      expect(ingress.apiVersion).toBe('networking.k8s.io/v1');
      expect(ingress.kind).toBe('Ingress');
      expect(ingress.metadata.name).toBe('secure-ingress');

      const spec = ingress.spec as Record<string, unknown>;
      expect(spec.tls).toHaveLength(1);
      expect(((spec.tls as unknown[])[0] as Record<string, unknown>).hosts).toEqual([
        'example.com',
      ]);
      expect(((spec.tls as unknown[])[0] as Record<string, unknown>).secretName).toBe(
        'example-tls',
      );
    });

    it('should apply security annotations for production environment', () => {
      const ingress = networkResources.addSecureIngress({
        name: 'production-ingress',
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
      });

      const annotations = ingress.metadata.annotations as Record<string, string>;
      expect(annotations['nginx.ingress.kubernetes.io/ssl-redirect']).toBe('true');
      expect(annotations['nginx.ingress.kubernetes.io/force-ssl-redirect']).toBe('true');
      expect(annotations['nginx.ingress.kubernetes.io/configuration-snippet']).toContain(
        'X-Frame-Options: DENY',
      );
    });
  });
});
