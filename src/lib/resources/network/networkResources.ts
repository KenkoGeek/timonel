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
 * Ingress specification
 * @since 2.7.0
 */
export interface IngressSpec {
  /** Resource name */
  name: string;
  /** Ingress class name */
  ingressClassName?: string;
  /** TLS configuration */
  tls?: Array<{
    hosts?: string[];
    secretName?: string;
  }>;
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
      'networking.k8s.io/v1',
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
   * Creates an Ingress resource
   * @param spec - Ingress specification
   * @returns Created Ingress ApiObject
   * @since 2.7.0
   */
  addIngress(spec: IngressSpec): ApiObject {
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
      'networking.k8s.io/v1',
      'Ingress',
      ingressSpec,
      spec.labels,
      spec.annotations,
    );
  }
}
