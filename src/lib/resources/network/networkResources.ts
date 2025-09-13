/**
 * @fileoverview Network resources for Kubernetes networking
 * @since 2.7.0
 */

import type { ApiObject } from 'cdk8s';

import { BaseResourceProvider } from '../baseResourceProvider.js';

/**
 * Network policy rule specification
 * @since 2.7.0
 */
export interface NetworkPolicyRule {
  /** Ports to allow */
  ports?: Array<{
    port?: number | string;
    protocol?: 'TCP' | 'UDP' | 'SCTP';
  }>;
  /** Pod selector for allowed pods */
  podSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  /** Namespace selector for allowed namespaces */
  namespaceSelector?: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
}

/**
 * Network policy specification
 * @since 2.7.0
 */
export interface NetworkPolicySpec {
  /** Resource name */
  name: string;
  /** Pod selector to apply policy to */
  podSelector: {
    matchLabels?: Record<string, string>;
    matchExpressions?: Array<{
      key: string;
      operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
      values?: string[];
    }>;
  };
  /** Policy types to apply */
  policyTypes?: Array<'Ingress' | 'Egress'>;
  /** Ingress rules */
  ingress?: NetworkPolicyRule[];
  /** Egress rules */
  egress?: NetworkPolicyRule[];
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * TLS configuration for Ingress
 * @since 2.8.0
 */
export interface IngressTLSConfig {
  /** Hosts covered by the TLS certificate */
  hosts?: string[];
  /** Name of the secret containing the TLS certificate and key */
  secretName?: string;
}

/**
 * Environment types for Ingress security validation
 * @since 2.8.0
 */
export type IngressEnvironment = 'development' | 'staging' | 'production';

/**
 * Ingress specification with enhanced TLS validation and security defaults
 * @since 2.7.0
 */
export interface IngressSpec {
  /** Resource name */
  name: string;
  /** Ingress class name */
  ingressClassName?: string;
  /** TLS configuration with validation */
  tls?: IngressTLSConfig[];
  /** Ingress rules */
  rules?: Array<{
    host?: string;
    http?: {
      paths: Array<{
        path?: string;
        pathType?: 'Exact' | 'Prefix' | 'ImplementationSpecific';
        backend: {
          service: {
            name: string;
            port: {
              number?: number;
              name?: string;
            };
          };
        };
      }>;
    };
  }>;
  /** Environment for security validation (production requires TLS) */
  environment?: IngressEnvironment;
  /** Force TLS requirement regardless of environment */
  requireTLS?: boolean;
  /** Automatically redirect HTTP to HTTPS */
  forceSSLRedirect?: boolean;
  /** Resource labels */
  labels?: Record<string, string>;
  /** Resource annotations */
  annotations?: Record<string, string>;
}

/**
 * Network resources provider for NetworkPolicy and Ingress
 * @extends BaseResourceProvider
 * @since 2.7.0
 */
export class NetworkResources extends BaseResourceProvider {
  private static readonly TLS_REQUIRED_ERROR_MESSAGE =
    'TLS configuration is required for production Ingress resources. Please configure the "tls" field with valid certificate references.';
  private static readonly NETWORKING_API_VERSION = 'networking.k8s.io/v1';

  /**
   * Creates a NetworkPolicy resource
   * @param spec - NetworkPolicy specification
   * @returns Created NetworkPolicy ApiObject
   * @since 2.7.0
   */
  addNetworkPolicy(spec: NetworkPolicySpec): ApiObject {
    const policySpec: Record<string, unknown> = {
      podSelector: spec.podSelector,
    };

    if (spec.policyTypes) {
      policySpec['policyTypes'] = spec.policyTypes;
    }

    if (spec.ingress) {
      policySpec['ingress'] = spec.ingress;
    }

    if (spec.egress) {
      policySpec['egress'] = spec.egress;
    }

    return this.createApiObject(
      spec.name,
      NetworkResources.NETWORKING_API_VERSION,
      'NetworkPolicy',
      policySpec,
      spec.labels,
      spec.annotations,
    );
  }

  /**
   * Creates a deny-all NetworkPolicy that blocks all ingress and egress traffic
   * @param name - Policy name
   * @param podSelector - Pod selector to apply policy to
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created NetworkPolicy ApiObject
   * @since 2.7.0
   */
  addDenyAllNetworkPolicy(
    name: string,
    podSelector: NetworkPolicySpec['podSelector'] = {},
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    return this.addNetworkPolicy({
      name,
      podSelector,
      policyTypes: ['Ingress', 'Egress'],
      ingress: [],
      egress: [],
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }

  /**
   * Creates a NetworkPolicy that allows traffic from specific pods
   * @param name - Policy name
   * @param podSelector - Pod selector to apply policy to
   * @param fromPodSelector - Pod selector for allowed source pods
   * @param ports - Optional ports to allow
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created NetworkPolicy ApiObject
   * @since 2.7.0
   */
  addAllowFromPodsNetworkPolicy(
    name: string,
    podSelector: NetworkPolicySpec['podSelector'],
    fromPodSelector: NetworkPolicyRule['podSelector'],
    ports?: NetworkPolicyRule['ports'],
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    const ingressRule: NetworkPolicyRule = {};

    if (fromPodSelector) {
      ingressRule.podSelector = fromPodSelector;
    }

    if (ports) {
      ingressRule.ports = ports;
    }

    return this.addNetworkPolicy({
      name,
      podSelector,
      policyTypes: ['Ingress'],
      ingress: [ingressRule],
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }

  /**
   * Creates a NetworkPolicy that allows traffic from specific namespaces
   * @param name - Policy name
   * @param podSelector - Pod selector to apply policy to
   * @param fromNamespaceSelector - Namespace selector for allowed source namespaces
   * @param ports - Optional ports to allow
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created NetworkPolicy ApiObject
   * @since 2.7.0
   */
  addAllowFromNamespaceNetworkPolicy(
    name: string,
    podSelector: NetworkPolicySpec['podSelector'],
    fromNamespaceSelector: NetworkPolicyRule['namespaceSelector'],
    ports?: NetworkPolicyRule['ports'],
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    const ingressRule: NetworkPolicyRule = {};

    if (fromNamespaceSelector) {
      ingressRule.namespaceSelector = fromNamespaceSelector;
    }

    if (ports) {
      ingressRule.ports = ports;
    }

    return this.addNetworkPolicy({
      name,
      podSelector,
      policyTypes: ['Ingress'],
      ingress: [ingressRule],
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }

  /**
   * Validates TLS configuration for security compliance
   * @param spec - Ingress specification to validate
   * @throws Error if TLS validation fails
   * @since 2.8.0
   */
  private validateIngressSecurity(spec: IngressSpec): void {
    const isProductionEnvironment = spec.environment === 'production';
    const tlsRequired = spec.requireTLS || isProductionEnvironment;

    // Check if TLS is required but not configured
    if (tlsRequired && (!spec.tls || spec.tls.length === 0)) {
      throw new Error(NetworkResources.TLS_REQUIRED_ERROR_MESSAGE);
    }

    // Validate TLS configuration if present
    if (spec.tls && spec.tls.length > 0) {
      spec.tls.forEach((tlsConfig, index) => {
        if (!tlsConfig.secretName) {
          throw new Error(
            `TLS configuration at index ${index} must specify a secretName. ` +
              'The secret should contain "tls.crt" and "tls.key" data.',
          );
        }

        // Validate secret name format (RFC 1123 DNS subdomain)
        // This regex is safe as it only matches alphanumeric characters and hyphens
        // eslint-disable-next-line security/detect-unsafe-regex
        const secretNameRegex = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
        if (!secretNameRegex.test(tlsConfig.secretName)) {
          throw new Error(
            `Invalid TLS secret name "${tlsConfig.secretName}" at index ${index}. ` +
              'Secret names must be valid RFC 1123 DNS subdomains (lowercase alphanumeric and hyphens).',
          );
        }

        // Validate hosts if specified
        if (tlsConfig.hosts && tlsConfig.hosts.length > 0) {
          tlsConfig.hosts.forEach((host, hostIndex) => {
            if (!this.isValidHostname(host)) {
              throw new Error(
                `Invalid hostname "${host}" in TLS configuration at index ${index}, host ${hostIndex}. ` +
                  'Hostnames must be valid DNS names or wildcard patterns.',
              );
            }
          });
        }
      });
    }

    // Validate that TLS hosts match Ingress rule hosts
    if (spec.tls && spec.rules) {
      const tlsHosts = new Set(spec.tls.flatMap((tls) => tls.hosts || []));
      const ruleHosts = spec.rules
        .map((rule) => rule.host)
        .filter((host): host is string => Boolean(host));

      for (const ruleHost of ruleHosts) {
        if (!tlsHosts.has(ruleHost)) {
          console.warn(
            `Warning: Host "${ruleHost}" in Ingress rules is not covered by TLS configuration. ` +
              'Consider adding it to the TLS hosts for secure communication.',
          );
        }
      }
    }
  }

  /**
   * Validates hostname format (supports wildcards)
   * @param hostname - Hostname to validate
   * @returns True if hostname is valid
   * @since 2.8.0
   */
  private isValidHostname(hostname: string): boolean {
    if (!hostname || hostname.length === 0) {
      return false;
    }

    // Allow wildcard patterns like *.example.com
    // This regex is safe as it only matches specific DNS patterns
    const wildcardRegex =
      // eslint-disable-next-line security/detect-unsafe-regex
      /^\*\.(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    if (hostname.startsWith('*.')) {
      return wildcardRegex.test(hostname);
    }

    // Standard hostname validation - safe regex for DNS names
    const hostnameRegex =
      // eslint-disable-next-line security/detect-unsafe-regex
      /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    return hostnameRegex.test(hostname) && hostname.length <= 253;
  }

  /**
   * Applies security defaults to Ingress annotations
   * @param spec - Ingress specification
   * @returns Enhanced annotations with security defaults
   * @since 2.8.0
   */
  private applySecurityDefaults(spec: IngressSpec): Record<string, string> {
    const annotations = { ...spec.annotations };

    // Apply SSL redirect if TLS is configured or force SSL redirect is enabled
    if ((spec.tls && spec.tls.length > 0) || spec.forceSSLRedirect) {
      // NGINX Ingress Controller annotations
      annotations['nginx.ingress.kubernetes.io/ssl-redirect'] = 'true';
      annotations['nginx.ingress.kubernetes.io/force-ssl-redirect'] = 'true';

      // Traefik annotations
      annotations['traefik.ingress.kubernetes.io/redirect-entry-point'] = 'https';

      // HAProxy annotations
      annotations['haproxy.org/ssl-redirect'] = 'true';
    }

    // Add security headers for production environments
    if (spec.environment === 'production' || spec.requireTLS) {
      // NGINX security headers
      annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = `
        more_set_headers "X-Frame-Options: DENY";
        more_set_headers "X-Content-Type-Options: nosniff";
        more_set_headers "X-XSS-Protection: 1; mode=block";
        more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
      `.trim();
    }

    return annotations;
  }

  /**
   * Creates a secure Ingress with TLS validation and environment-aware defaults
   * @param spec - Enhanced Ingress specification
   * @returns Created Ingress ApiObject
   * @example
   * ```typescript
   * // Production Ingress with mandatory TLS
   * networkResources.addSecureIngress({
   *   name: 'web-ingress',
   *   environment: 'production',
   *   tls: [{
   *     hosts: ['example.com'],
   *     secretName: 'example-tls'
   *   }],
   *   rules: [{
   *     host: 'example.com',
   *     http: {
   *       paths: [{
   *         path: '/',
   *         pathType: 'Prefix',
   *         backend: {
   *           service: { name: 'web-service', port: { number: 80 } }
   *         }
   *       }]
   *     }
   *   }]
   * });
   * ```
   * @since 2.8.0
   */
  addSecureIngress(spec: IngressSpec): ApiObject {
    // Validate TLS configuration and security requirements
    this.validateIngressSecurity(spec);

    // Apply security defaults to annotations
    const enhancedAnnotations = this.applySecurityDefaults(spec);

    // Create the Ingress with enhanced security
    const ingressSpec: Record<string, unknown> = {};

    if (spec.ingressClassName) {
      ingressSpec['ingressClassName'] = spec.ingressClassName;
    }

    if (spec.tls) {
      ingressSpec['tls'] = spec.tls;
    }

    if (spec.rules) {
      ingressSpec['rules'] = spec.rules;
    }

    return this.createApiObject(
      spec.name,
      NetworkResources.NETWORKING_API_VERSION,
      'Ingress',
      ingressSpec,
      spec.labels,
      enhancedAnnotations,
    );
  }

  /**
   * Creates an Ingress resource with optional TLS validation
   * @param spec - Ingress specification
   * @returns Created Ingress ApiObject
   * @deprecated Use addSecureIngress for enhanced security validation
   * @since 2.7.0
   */
  addIngress(spec: IngressSpec): ApiObject {
    // Apply basic validation if environment is specified
    if (spec.environment || spec.requireTLS) {
      this.validateIngressSecurity(spec);
      const enhancedAnnotations = this.applySecurityDefaults(spec);

      const ingressSpec: Record<string, unknown> = {};

      if (spec.ingressClassName) {
        ingressSpec['ingressClassName'] = spec.ingressClassName;
      }

      if (spec.tls) {
        ingressSpec['tls'] = spec.tls;
      }

      if (spec.rules) {
        ingressSpec['rules'] = spec.rules;
      }

      return this.createApiObject(
        spec.name,
        NetworkResources.NETWORKING_API_VERSION,
        'Ingress',
        ingressSpec,
        spec.labels,
        enhancedAnnotations,
      );
    }

    // Legacy behavior for backward compatibility
    const ingressSpec: Record<string, unknown> = {};

    if (spec.ingressClassName) {
      ingressSpec['ingressClassName'] = spec.ingressClassName;
    }

    if (spec.tls) {
      ingressSpec['tls'] = spec.tls;
    }

    if (spec.rules) {
      ingressSpec['rules'] = spec.rules;
    }

    return this.createApiObject(
      spec.name,
      NetworkResources.NETWORKING_API_VERSION,
      'Ingress',
      ingressSpec,
      spec.labels,
      spec.annotations,
    );
  }
}
