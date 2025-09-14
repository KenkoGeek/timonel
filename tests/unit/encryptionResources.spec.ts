/**
 * @fileoverview Unit tests for EncryptionResources
 * @since 2.9.0
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { App, Chart } from 'cdk8s';

import { EncryptionResources } from '../../src/lib/resources/security/encryption.js';

describe('EncryptionResources', () => {
  let app: App;
  let chart: Chart;
  let encryptionResources: EncryptionResources;

  beforeEach(() => {
    app = new App();
    chart = new Chart(app, 'test-chart');
    encryptionResources = new EncryptionResources(chart, 'test-encryption');
  });

  describe('addLetsEncryptHTTP01ClusterIssuer', () => {
    it("should create a production Let's Encrypt ClusterIssuer with HTTP01 challenge", () => {
      const issuer = encryptionResources.addLetsEncryptHTTP01ClusterIssuer(
        'letsencrypt-prod',
        'admin@example.com',
        'nginx',
      );

      expect(issuer.apiVersion).toBe('cert-manager.io/v1');
      expect(issuer.kind).toBe('ClusterIssuer');
      expect(issuer.metadata.name).toBe('letsencrypt-prod');

      const issuerJson = issuer.toJson();
      const spec = issuerJson.spec as Record<string, unknown>;
      expect((spec.acme as Record<string, unknown>).server).toBe(
        'https://acme-v02.api.letsencrypt.org/directory',
      );
      expect((spec.acme as Record<string, unknown>).email).toBe('admin@example.com');
      expect(
        ((spec.acme as Record<string, unknown>).privateKeySecretRef as Record<string, unknown>)
          .name,
      ).toBe('letsencrypt-prod-private-key');
      expect((spec.acme as Record<string, unknown>).solvers).toHaveLength(1);
      expect(
        (
          ((spec.acme as Record<string, unknown>).solvers as unknown[])[0] as Record<
            string,
            unknown
          >
        ).http01,
      ).toBeDefined();
    });

    it("should create a staging Let's Encrypt ClusterIssuer when staging is true", () => {
      const issuer = encryptionResources.addLetsEncryptHTTP01ClusterIssuer(
        'letsencrypt-staging',
        'admin@example.com',
        'nginx',
        true,
      );

      const issuerJson = issuer.toJson();
      const spec = issuerJson.spec as Record<string, unknown>;
      expect((spec.acme as Record<string, unknown>).server).toBe(
        'https://acme-staging-v02.api.letsencrypt.org/directory',
      );
    });
  });

  describe('addCertificate', () => {
    it('should create a Certificate resource', () => {
      const certificate = encryptionResources.addCertificate({
        name: 'example-tls',
        secretName: 'example-tls-secret',
        issuerRef: {
          name: 'letsencrypt-prod',
          kind: 'ClusterIssuer',
        },
        dnsNames: ['example.com', 'www.example.com'],
      });

      expect(certificate.apiVersion).toBe('cert-manager.io/v1');
      expect(certificate.kind).toBe('Certificate');
      expect(certificate.metadata.name).toBe('example-tls');

      const certificateJson = certificate.toJson();
      const spec = certificateJson.spec as Record<string, unknown>;
      expect(spec.secretName).toBe('example-tls-secret');
      expect((spec.issuerRef as Record<string, unknown>).name).toBe('letsencrypt-prod');
      expect((spec.issuerRef as Record<string, unknown>).kind).toBe('ClusterIssuer');
      expect((spec.issuerRef as Record<string, unknown>).group).toBe('cert-manager.io');
      expect(spec.dnsNames).toEqual(['example.com', 'www.example.com']);
    });
  });
});
