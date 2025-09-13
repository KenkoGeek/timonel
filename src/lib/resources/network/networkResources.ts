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
 * NGINX Ingress specific configuration
 * @since 2.9.0
 */
export interface NginxIngressConfig {
  /** Enable SSL redirect */
  sslRedirect?: boolean;
  /** Force SSL redirect */
  forceSSLRedirect?: boolean;
  /** SSL protocols */
  sslProtocols?: string;
  /** SSL ciphers */
  sslCiphers?: string;
  /** Enable HSTS */
  enableHSTS?: boolean;
  /** HSTS max age */
  hstsMaxAge?: number;
  /** Include HSTS subdomains */
  hstsIncludeSubdomains?: boolean;
  /** Enable HSTS preload */
  hstsPreload?: boolean;
  /** Proxy body size */
  proxyBodySize?: string;
  /** Proxy connect timeout */
  proxyConnectTimeout?: number;
  /** Proxy send timeout */
  proxySendTimeout?: number;
  /** Proxy read timeout */
  proxyReadTimeout?: number;
  /** Enable CORS */
  enableCORS?: boolean;
  /** CORS allow origin */
  corsAllowOrigin?: string;
  /** CORS allow methods */
  corsAllowMethods?: string;
  /** CORS allow headers */
  corsAllowHeaders?: string;
  /** Rate limiting */
  rateLimiting?: {
    rps?: number;
    rpm?: number;
    connections?: number;
  };
  /** Custom configuration snippet */
  configurationSnippet?: string;
  /** Server snippet */
  serverSnippet?: string;
  /** Rewrite target */
  rewriteTarget?: string;
  /** Use regex in rewrite */
  useRegex?: boolean;
  /** Backend protocol */
  backendProtocol?: 'HTTP' | 'HTTPS' | 'GRPC' | 'GRPCS';
  /** Upstream hash by */
  upstreamHashBy?: string;
  /** Session affinity */
  sessionAffinity?: 'cookie';
  /** Session cookie name */
  sessionCookieName?: string;
  /** Session cookie expires */
  sessionCookieExpires?: number;
  /** Session cookie max age */
  sessionCookieMaxAge?: number;
  /** Session cookie path */
  sessionCookiePath?: string;
  /** Whitelist source range */
  whitelistSourceRange?: string[];
}

/**
 * Cert-manager integration configuration
 * @since 2.9.0
 */
export interface CertManagerConfig {
  /** ClusterIssuer name */
  clusterIssuer?: string;
  /** Issuer name */
  issuer?: string;
  /** ACME challenge type */
  acmeChallenge?: 'http01' | 'dns01';
  /** Certificate class */
  certificateClass?: string;
}

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
  /** NGINX specific configuration */
  nginx?: NginxIngressConfig;
  /** Cert-manager integration */
  certManager?: CertManagerConfig;
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
   * Validates hostname format (supports wildcards) with ReDoS protection
   * @param hostname - Hostname to validate
   * @returns True if hostname is valid
   * @since 2.8.0
   */
  private isValidHostname(hostname: string): boolean {
    if (!hostname || hostname.length === 0 || hostname.length > 253) {
      return false;
    }

    // Split hostname into parts and validate each part
    const parts = hostname.split('.');
    if (parts.length < 2) return false;

    // Handle wildcard
    if (hostname.startsWith('*.')) {
      parts.shift(); // Remove wildcard part
      if (parts.length < 2) return false; // Must have at least two parts after wildcard
    }

    // Validate each part
    return parts.every((part) => {
      if (part.length === 0 || part.length > 63) return false;
      if (part.startsWith('-') || part.endsWith('-')) return false;
      return /^[a-z0-9-]+$/i.test(part);
    });
  }

  /**
   * Applies NGINX Ingress specific annotations
   * @param spec - Ingress specification
   * @param annotations - Base annotations to enhance
   * @returns Enhanced annotations with NGINX specific settings
   * @since 2.9.0
   */
  private applyNginxAnnotations(
    spec: IngressSpec,
    annotations: Record<string, string>,
  ): Record<string, string> {
    if (!spec.nginx) return annotations;

    const nginxAnnotations = { ...annotations };

    this.applySSLAnnotations(spec.nginx, nginxAnnotations);
    this.applyHSTSAnnotations(spec.nginx, nginxAnnotations);
    this.applyProxyAnnotations(spec.nginx, nginxAnnotations);
    this.applyCORSAnnotations(spec.nginx, nginxAnnotations);
    this.applyRateLimitingAnnotations(spec.nginx, nginxAnnotations);
    this.applyRewriteAnnotations(spec.nginx, nginxAnnotations);
    this.applyBackendAnnotations(spec.nginx, nginxAnnotations);
    this.applySessionAffinityAnnotations(spec.nginx, nginxAnnotations);
    this.applySecurityAnnotations(spec.nginx, nginxAnnotations);
    this.applyCustomAnnotations(spec.nginx, nginxAnnotations);

    return nginxAnnotations;
  }

  /**
   * Apply SSL/TLS annotations
   * @private
   */
  private applySSLAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.sslRedirect !== undefined) {
      annotations['nginx.ingress.kubernetes.io/ssl-redirect'] = nginx.sslRedirect.toString();
    }
    if (nginx.forceSSLRedirect !== undefined) {
      annotations['nginx.ingress.kubernetes.io/force-ssl-redirect'] =
        nginx.forceSSLRedirect.toString();
    }
    if (nginx.sslProtocols) {
      annotations['nginx.ingress.kubernetes.io/ssl-protocols'] = nginx.sslProtocols;
    }
    if (nginx.sslCiphers) {
      annotations['nginx.ingress.kubernetes.io/ssl-ciphers'] = nginx.sslCiphers;
    }
  }

  /**
   * Apply HSTS annotations
   * @private
   */
  private applyHSTSAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.enableHSTS !== undefined) {
      annotations['nginx.ingress.kubernetes.io/hsts'] = nginx.enableHSTS.toString();
    }
    if (nginx.hstsMaxAge !== undefined) {
      annotations['nginx.ingress.kubernetes.io/hsts-max-age'] = nginx.hstsMaxAge.toString();
    }
    if (nginx.hstsIncludeSubdomains !== undefined) {
      annotations['nginx.ingress.kubernetes.io/hsts-include-subdomains'] =
        nginx.hstsIncludeSubdomains.toString();
    }
    if (nginx.hstsPreload !== undefined) {
      annotations['nginx.ingress.kubernetes.io/hsts-preload'] = nginx.hstsPreload.toString();
    }
  }

  /**
   * Apply proxy annotations
   * @private
   */
  private applyProxyAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.proxyBodySize) {
      annotations['nginx.ingress.kubernetes.io/proxy-body-size'] = nginx.proxyBodySize;
    }
    if (nginx.proxyConnectTimeout !== undefined) {
      annotations['nginx.ingress.kubernetes.io/proxy-connect-timeout'] =
        nginx.proxyConnectTimeout.toString();
    }
    if (nginx.proxySendTimeout !== undefined) {
      annotations['nginx.ingress.kubernetes.io/proxy-send-timeout'] =
        nginx.proxySendTimeout.toString();
    }
    if (nginx.proxyReadTimeout !== undefined) {
      annotations['nginx.ingress.kubernetes.io/proxy-read-timeout'] =
        nginx.proxyReadTimeout.toString();
    }
  }

  /**
   * Apply CORS annotations
   * @private
   */
  private applyCORSAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.enableCORS !== undefined) {
      annotations['nginx.ingress.kubernetes.io/enable-cors'] = nginx.enableCORS.toString();
    }
    if (nginx.corsAllowOrigin) {
      annotations['nginx.ingress.kubernetes.io/cors-allow-origin'] = nginx.corsAllowOrigin;
    }
    if (nginx.corsAllowMethods) {
      annotations['nginx.ingress.kubernetes.io/cors-allow-methods'] = nginx.corsAllowMethods;
    }
    if (nginx.corsAllowHeaders) {
      annotations['nginx.ingress.kubernetes.io/cors-allow-headers'] = nginx.corsAllowHeaders;
    }
  }

  /**
   * Apply rate limiting annotations
   * @private
   */
  private applyRateLimitingAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.rateLimiting) {
      if (nginx.rateLimiting.rps !== undefined) {
        annotations['nginx.ingress.kubernetes.io/rate-limit-rps'] =
          nginx.rateLimiting.rps.toString();
      }
      if (nginx.rateLimiting.rpm !== undefined) {
        annotations['nginx.ingress.kubernetes.io/rate-limit-rpm'] =
          nginx.rateLimiting.rpm.toString();
      }
      if (nginx.rateLimiting.connections !== undefined) {
        annotations['nginx.ingress.kubernetes.io/rate-limit-connections'] =
          nginx.rateLimiting.connections.toString();
      }
    }
  }

  /**
   * Apply rewrite annotations
   * @private
   */
  private applyRewriteAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.rewriteTarget) {
      annotations['nginx.ingress.kubernetes.io/rewrite-target'] = nginx.rewriteTarget;
    }
    if (nginx.useRegex !== undefined) {
      annotations['nginx.ingress.kubernetes.io/use-regex'] = nginx.useRegex.toString();
    }
  }

  /**
   * Apply backend annotations
   * @private
   */
  private applyBackendAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.backendProtocol) {
      annotations['nginx.ingress.kubernetes.io/backend-protocol'] = nginx.backendProtocol;
    }
    if (nginx.upstreamHashBy) {
      annotations['nginx.ingress.kubernetes.io/upstream-hash-by'] = nginx.upstreamHashBy;
    }
  }

  /**
   * Apply session affinity annotations
   * @private
   */
  private applySessionAffinityAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.sessionAffinity) {
      annotations['nginx.ingress.kubernetes.io/affinity'] = nginx.sessionAffinity;
    }
    if (nginx.sessionCookieName) {
      annotations['nginx.ingress.kubernetes.io/affinity-cookie-name'] = nginx.sessionCookieName;
    }
    if (nginx.sessionCookieExpires !== undefined) {
      annotations['nginx.ingress.kubernetes.io/affinity-cookie-expires'] =
        nginx.sessionCookieExpires.toString();
    }
    if (nginx.sessionCookieMaxAge !== undefined) {
      annotations['nginx.ingress.kubernetes.io/affinity-cookie-max-age'] =
        nginx.sessionCookieMaxAge.toString();
    }
    if (nginx.sessionCookiePath) {
      annotations['nginx.ingress.kubernetes.io/affinity-cookie-path'] = nginx.sessionCookiePath;
    }
  }

  /**
   * Apply security annotations
   * @private
   */
  private applySecurityAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.whitelistSourceRange && nginx.whitelistSourceRange.length > 0) {
      annotations['nginx.ingress.kubernetes.io/whitelist-source-range'] =
        nginx.whitelistSourceRange.join(',');
    }
  }

  /**
   * Apply custom annotations
   * @private
   */
  private applyCustomAnnotations(
    nginx: NginxIngressConfig,
    annotations: Record<string, string>,
  ): void {
    if (nginx.configurationSnippet) {
      annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = nginx.configurationSnippet;
    }
    if (nginx.serverSnippet) {
      annotations['nginx.ingress.kubernetes.io/server-snippet'] = nginx.serverSnippet;
    }
  }

  /**
   * Applies cert-manager annotations for automatic certificate management
   * @param spec - Ingress specification
   * @param annotations - Base annotations to enhance
   * @returns Enhanced annotations with cert-manager settings
   * @since 2.9.0
   */
  private applyCertManagerAnnotations(
    spec: IngressSpec,
    annotations: Record<string, string>,
  ): Record<string, string> {
    if (!spec.certManager) return annotations;

    const certManager = spec.certManager;
    const certAnnotations = { ...annotations };

    // ClusterIssuer or Issuer
    if (certManager.clusterIssuer) {
      certAnnotations['cert-manager.io/cluster-issuer'] = certManager.clusterIssuer;
    } else if (certManager.issuer) {
      certAnnotations['cert-manager.io/issuer'] = certManager.issuer;
    }

    // ACME challenge type
    if (certManager.acmeChallenge) {
      certAnnotations['cert-manager.io/acme-challenge-type'] = certManager.acmeChallenge;
    }

    // Certificate class
    if (certManager.certificateClass) {
      certAnnotations['cert-manager.io/certificate-class'] = certManager.certificateClass;
    }

    return certAnnotations;
  }

  /**
   * Applies security defaults to Ingress annotations
   * @param spec - Ingress specification
   * @returns Enhanced annotations with security defaults
   * @since 2.8.0
   */
  private applySecurityDefaults(spec: IngressSpec): Record<string, string> {
    let annotations = { ...spec.annotations };

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
      // NGINX security headers with CSP
      annotations['nginx.ingress.kubernetes.io/configuration-snippet'] = `
        more_set_headers "X-Frame-Options: DENY";
        more_set_headers "X-Content-Type-Options: nosniff";
        more_set_headers "X-XSS-Protection: 1; mode=block";
        more_set_headers "Referrer-Policy: strict-origin-when-cross-origin";
        more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";
      `.trim();
    }

    // Apply NGINX specific annotations
    annotations = this.applyNginxAnnotations(spec, annotations);

    // Apply cert-manager annotations
    annotations = this.applyCertManagerAnnotations(spec, annotations);

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

  /**
   * Creates an NGINX Ingress with enhanced configuration and cert-manager integration
   * @param spec - Enhanced Ingress specification with NGINX and cert-manager support
   * @returns Created Ingress ApiObject
   * @example
   * ```typescript
   * // NGINX Ingress with Let's Encrypt and advanced features
   * networkResources.addNginxIngress({
   *   name: 'web-ingress',
   *   ingressClassName: 'nginx',
   *   environment: 'production',
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
   *   }],
   *   tls: [{
   *     hosts: ['example.com'],
   *     secretName: 'example-tls'
   *   }],
   *   nginx: {
   *     sslRedirect: true,
   *     enableHSTS: true,
   *     hstsMaxAge: 31536000,
   *     proxyBodySize: '10m',
   *     rateLimiting: { rps: 100 }
   *   },
   *   certManager: {
   *     clusterIssuer: 'letsencrypt-prod'
   *   }
   * });
   * ```
   * @since 2.9.0
   */
  addNginxIngress(spec: IngressSpec): ApiObject {
    // Set default ingress class for NGINX
    const nginxSpec = {
      ...spec,
      ingressClassName: spec.ingressClassName || 'nginx',
    };

    // Use the enhanced secure ingress method
    return this.addSecureIngress(nginxSpec);
  }

  /**
   * Creates an NGINX Ingress with Let's Encrypt certificate automation
   * @param name - Ingress name
   * @param host - Primary hostname
   * @param serviceName - Backend service name
   * @param servicePort - Backend service port
   * @param clusterIssuer - Let's Encrypt ClusterIssuer name
   * @param additionalHosts - Additional hostnames
   * @param path - URL path (default: '/')
   * @param pathType - Path type (default: 'Prefix')
   * @param nginxConfig - Optional NGINX configuration
   * @param labels - Optional labels
   * @param annotations - Optional additional annotations
   * @returns Created Ingress ApiObject
   * @example
   * ```typescript
   * // Simple NGINX Ingress with Let's Encrypt
   * networkResources.addNginxIngressWithLetsEncrypt(
   *   'web-ingress',
   *   'example.com',
   *   'web-service',
   *   80,
   *   'letsencrypt-prod',
   *   ['www.example.com'],
   *   '/',
   *   'Prefix',
   *   { enableHSTS: true, rateLimiting: { rps: 50 } }
   * );
   * ```
   * @since 2.9.0
   */
  addNginxIngressWithLetsEncrypt(
    name: string,
    host: string,
    serviceName: string,
    servicePort: number,
    clusterIssuer: string,
    additionalHosts: string[] = [],
    path: string = '/',
    pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific' = 'Prefix',
    nginxConfig?: NginxIngressConfig,
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    const allHosts = [host, ...additionalHosts];
    const secretName = `${name}-tls`;

    return this.addNginxIngress({
      name,
      ingressClassName: 'nginx',
      environment: 'production',
      tls: [
        {
          hosts: allHosts,
          secretName,
        },
      ],
      rules: [
        {
          host,
          http: {
            paths: [
              {
                path,
                pathType,
                backend: {
                  service: {
                    name: serviceName,
                    port: { number: servicePort },
                  },
                },
              },
            ],
          },
        },
      ],
      nginx: {
        sslRedirect: true,
        enableHSTS: true,
        hstsMaxAge: 31536000,
        hstsIncludeSubdomains: true,
        ...nginxConfig,
      },
      certManager: {
        clusterIssuer,
      },
      ...(labels && { labels }),
      ...(annotations && { annotations }),
    });
  }
}
