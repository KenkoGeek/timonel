/**
 * @fileoverview Certificate management and encryption resources for Kubernetes
 * @since 2.9.0
 */

import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../baseResourceProvider.js';

/**
 * ACME challenge types for Let's Encrypt
 * @since 2.9.0
 */
export type ACMEChallengeType = 'http01' | 'dns01';

/**
 * ACME HTTP01 challenge configuration
 * @since 2.9.0
 */
export interface ACMEHTTP01Config {
  /** Ingress class to use for HTTP01 challenges */
  ingressClass?: string;
  /** Service type for HTTP01 challenges */
  serviceType?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
}

/**
 * Route53 DNS provider configuration
 * @since 2.9.0
 */
export interface Route53Config {
  /** AWS region for Route53 */
  region: string;
  /** Hosted zone ID (must start with 'Z') */
  hostedZoneID?: string;
  /** IAM role ARN (must be a valid ARN format) */
  role?: string;
  /** Access key ID secret reference */
  accessKeyID?: {
    name: string;
    key: string;
  };
  /** Secret access key secret reference */
  secretAccessKey?: {
    name: string;
    key: string;
  };
}

/**
 * Validates Route53 configuration
 * @param config - Route53 configuration to validate
 * @throws Error if validation fails
 * @since 2.9.0
 */
export function validateRoute53Config(config: Route53Config): void {
  if (config.region && !/^[a-z]{2}-[a-z]+-\d{1}$/.test(config.region)) {
    throw new Error('Invalid AWS region format');
  }
  if (config.hostedZoneID && !/^Z[A-Z0-9]+$/.test(config.hostedZoneID)) {
    throw new Error('Invalid hosted zone ID format');
  }
  if (config.role && !/^arn:aws:iam::\d{12}:role\/[\w+=,.@-]+$/.test(config.role)) {
    throw new Error('Invalid IAM role ARN format');
  }
}

/**
 * ACME DNS01 challenge configuration
 * @since 2.9.0
 */
export interface ACMEDNS01Config {
  /** DNS provider configuration */
  route53?: Route53Config;
  /** CloudFlare DNS provider */
  cloudflare?: {
    /** API token secret reference */
    apiToken?: {
      name: string;
      key: string;
    };
    /** API key secret reference */
    apiKey?: {
      name: string;
      key: string;
    };
    /** Email for CloudFlare account */
    email?: string;
  };
}

/**
 * ACME issuer configuration
 * @since 2.9.0
 */
export interface ACMEIssuerConfig {
  /** ACME server URL */
  server: string;
  /** Email for ACME registration */
  email: string;
  /** Private key secret name */
  privateKeySecretRef: string;
  /** Challenge configuration */
  solvers: Array<{
    /** Challenge type */
    http01?: ACMEHTTP01Config;
    dns01?: ACMEDNS01Config;
    /** Selector for domains */
    selector?: {
      dnsNames?: string[];
      dnsZones?: string[];
    };
  }>;
}

/**
 * Certificate specification
 * @since 2.9.0
 */
export interface CertificateSpec {
  /** Certificate name */
  name: string;
  /** Secret name to store the certificate */
  secretName: string;
  /** Issuer reference */
  issuerRef: {
    name: string;
    kind?: 'Issuer' | 'ClusterIssuer';
    group?: string;
  };
  /** DNS names for the certificate */
  dnsNames: string[];
  /** Certificate duration */
  duration?: string;
  /** Certificate renewal before expiry */
  renewBefore?: string;
  /** Subject configuration */
  subject?: {
    organizations?: string[];
    countries?: string[];
    organizationalUnits?: string[];
    localities?: string[];
    provinces?: string[];
  };
  /** Key algorithm */
  keyAlgorithm?: 'rsa' | 'ecdsa';
  /** Key size */
  keySize?: number;
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * ClusterIssuer specification
 * @since 2.9.0
 */
export interface ClusterIssuerSpec {
  /** Issuer name */
  name: string;
  /** ACME configuration */
  acme?: ACMEIssuerConfig;
  /** CA configuration */
  ca?: {
    secretName: string;
  };
  /** Vault configuration */
  vault?: {
    server: string;
    path: string;
    auth: {
      kubernetes?: {
        mountPath: string;
        role: string;
        secretRef: {
          name: string;
          key: string;
        };
      };
    };
  };
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Encryption and certificate management resources provider
 * @extends BaseResourceProvider
 * @since 2.9.0
 */
export class EncryptionResources extends BaseResourceProvider {
  private static readonly CERT_MANAGER_API_VERSION = 'cert-manager.io/v1';
  private static readonly LETSENCRYPT_STAGING_SERVER =
    'https://acme-staging-v02.api.letsencrypt.org/directory';
  private static readonly LETSENCRYPT_PRODUCTION_SERVER =
    'https://acme-v02.api.letsencrypt.org/directory';

  /**
   * Creates a Let's Encrypt ClusterIssuer with HTTP01 challenge
   * @param name - Issuer name
   * @param email - Email for ACME registration
   * @param ingressClass - Ingress class for HTTP01 challenges
   * @param staging - Use staging server (default: false)
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created ClusterIssuer ApiObject
   * @example
   * ```typescript
   * // Production Let's Encrypt issuer with NGINX
   * encryptionResources.addLetsEncryptHTTP01ClusterIssuer(
   *   'letsencrypt-prod',
   *   'admin@example.com',
   *   'nginx'
   * );
   * ```
   * @since 2.9.0
   */
  addLetsEncryptHTTP01ClusterIssuer(
    name: string,
    email: string,
    ingressClass: string = 'nginx',
    staging: boolean = false,
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    const server = staging
      ? EncryptionResources.LETSENCRYPT_STAGING_SERVER
      : EncryptionResources.LETSENCRYPT_PRODUCTION_SERVER;

    return this.addClusterIssuer({
      name,
      acme: {
        server,
        email,
        privateKeySecretRef: `${name}-private-key`,
        solvers: [
          {
            http01: {
              ingressClass,
            },
          },
        ],
      },
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }

  /**
   * Creates a Let's Encrypt ClusterIssuer with DNS01 challenge for Route53
   * @param name - Issuer name
   * @param email - Email for ACME registration
   * @param region - AWS region
   * @param hostedZoneID - Route53 hosted zone ID
   * @param role - IAM role ARN for Route53 access
   * @param staging - Use staging server (default: false)
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created ClusterIssuer ApiObject
   * @example
   * ```typescript
   * // Production Let's Encrypt issuer with Route53 DNS01
   * encryptionResources.addLetsEncryptRoute53ClusterIssuer(
   *   'letsencrypt-dns-prod',
   *   'admin@example.com',
   *   'us-east-1',
   *   'Z1234567890ABC',
   *   'arn:aws:iam::123456789012:role/cert-manager-route53'
   * );
   * ```
   * @since 2.9.0
   */
  addLetsEncryptRoute53ClusterIssuer(
    name: string,
    email: string,
    region: string,
    hostedZoneID?: string,
    role?: string,
    staging: boolean = false,
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    const server = staging
      ? EncryptionResources.LETSENCRYPT_STAGING_SERVER
      : EncryptionResources.LETSENCRYPT_PRODUCTION_SERVER;

    const route53Config: Route53Config = {
      region,
      ...(hostedZoneID && { hostedZoneID }),
      ...(role && { role }),
    };

    // Validate configuration
    validateRoute53Config(route53Config);

    return this.addClusterIssuer({
      name,
      acme: {
        server,
        email,
        privateKeySecretRef: `${name}-private-key`,
        solvers: [
          {
            dns01: {
              route53: route53Config,
            },
          },
        ],
      },
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }

  /**
   * Creates a ClusterIssuer resource
   * @param spec - ClusterIssuer specification
   * @returns Created ClusterIssuer ApiObject
   * @since 2.9.0
   */
  addClusterIssuer(spec: ClusterIssuerSpec): ApiObject {
    const issuerSpec: Record<string, unknown> = {};

    if (spec.acme) {
      issuerSpec['acme'] = this.buildACMEConfig(spec.acme);
    }

    if (spec.ca) {
      issuerSpec['ca'] = {
        secretName: spec.ca.secretName,
      };
    }

    if (spec.vault) {
      issuerSpec['vault'] = spec.vault;
    }

    return this.createApiObject(
      spec.name,
      EncryptionResources.CERT_MANAGER_API_VERSION,
      'ClusterIssuer',
      issuerSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Build ACME configuration
   * @private
   */
  private buildACMEConfig(acme: ACMEIssuerConfig): Record<string, unknown> {
    return {
      server: acme.server,
      email: acme.email,
      privateKeySecretRef: {
        name: acme.privateKeySecretRef,
      },
      solvers: acme.solvers.map((solver) => this.buildSolverConfig(solver)),
    };
  }

  /**
   * Build solver configuration
   * @private
   */
  private buildSolverConfig(solver: ACMEIssuerConfig['solvers'][0]): Record<string, unknown> {
    const solverConfig: Record<string, unknown> = {};

    if (solver.http01) {
      solverConfig['http01'] = {
        ingress: {
          ...(solver.http01.ingressClass && { class: solver.http01.ingressClass }),
          ...(solver.http01.serviceType && { serviceType: solver.http01.serviceType }),
        },
      };
    }

    if (solver.dns01) {
      solverConfig['dns01'] = this.buildDNS01Config(solver.dns01);
    }

    if (solver.selector) {
      solverConfig['selector'] = solver.selector;
    }

    return solverConfig;
  }

  /**
   * Build DNS01 configuration
   * @private
   */
  private buildDNS01Config(dns01: ACMEDNS01Config): Record<string, unknown> {
    const dns01Config: Record<string, unknown> = {};

    if (dns01.route53) {
      dns01Config['route53'] = {
        region: dns01.route53.region,
        ...(dns01.route53.hostedZoneID && { hostedZoneID: dns01.route53.hostedZoneID }),
        ...(dns01.route53.role && { role: dns01.route53.role }),
        ...(dns01.route53.accessKeyID && { accessKeyID: dns01.route53.accessKeyID }),
        ...(dns01.route53.secretAccessKey && { secretAccessKey: dns01.route53.secretAccessKey }),
      };
    }

    if (dns01.cloudflare) {
      dns01Config['cloudflare'] = {
        ...(dns01.cloudflare.email && { email: dns01.cloudflare.email }),
        ...(dns01.cloudflare.apiToken && { apiTokenSecretRef: dns01.cloudflare.apiToken }),
        ...(dns01.cloudflare.apiKey && { apiKeySecretRef: dns01.cloudflare.apiKey }),
      };
    }

    return dns01Config;
  }

  /**
   * Creates a Certificate resource
   * @param spec - Certificate specification
   * @returns Created Certificate ApiObject
   * @example
   * ```typescript
   * // Create a certificate for multiple domains
   * encryptionResources.addCertificate({
   *   name: 'example-tls',
   *   secretName: 'example-tls-secret',
   *   issuerRef: {
   *     name: 'letsencrypt-prod',
   *     kind: 'ClusterIssuer'
   *   },
   *   dnsNames: ['example.com', 'www.example.com']
   * });
   * ```
   * @since 2.9.0
   */
  addCertificate(spec: CertificateSpec): ApiObject {
    const certificateSpec: Record<string, unknown> = {
      secretName: spec.secretName,
      issuerRef: {
        name: spec.issuerRef.name,
        kind: spec.issuerRef.kind || 'ClusterIssuer',
        group: spec.issuerRef.group || 'cert-manager.io',
      },
      dnsNames: spec.dnsNames,
    };

    if (spec.duration) {
      certificateSpec['duration'] = spec.duration;
    }

    if (spec.renewBefore) {
      certificateSpec['renewBefore'] = spec.renewBefore;
    }

    if (spec.subject) {
      certificateSpec['subject'] = spec.subject;
    }

    if (spec.keyAlgorithm) {
      certificateSpec['keyAlgorithm'] = spec.keyAlgorithm;
    }

    if (spec.keySize) {
      certificateSpec['keySize'] = spec.keySize;
    }

    return this.createApiObject(
      spec.name,
      EncryptionResources.CERT_MANAGER_API_VERSION,
      'Certificate',
      certificateSpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a Certificate with automatic TLS secret for Ingress
   * @param name - Certificate name
   * @param secretName - Secret name for TLS certificate
   * @param issuerName - ClusterIssuer name
   * @param dnsNames - DNS names for the certificate
   * @param duration - Certificate duration (default: 2160h = 90 days)
   * @param renewBefore - Renew before expiry (default: 720h = 30 days)
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created Certificate ApiObject
   * @example
   * ```typescript
   * // Create a certificate for Ingress TLS
   * encryptionResources.addIngressCertificate(
   *   'web-tls',
   *   'web-tls-secret',
   *   'letsencrypt-prod',
   *   ['example.com', 'www.example.com']
   * );
   * ```
   * @since 2.9.0
   */
  addIngressCertificate(
    name: string,
    secretName: string,
    issuerName: string,
    dnsNames: string[],
    duration: string = '2160h',
    renewBefore: string = '720h',
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    return this.addCertificate({
      name,
      secretName,
      issuerRef: {
        name: issuerName,
        kind: 'ClusterIssuer',
      },
      dnsNames,
      duration,
      renewBefore,
      keyAlgorithm: 'rsa',
      keySize: 2048,
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }
}
