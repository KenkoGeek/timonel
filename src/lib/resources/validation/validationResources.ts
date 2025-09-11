/**
 * @fileoverview Validation and security resources for Kubernetes
 * @since 2.3.0
 */

import { BaseResourceProvider } from '../baseResourceProvider.js';

/**
 * Validation and security resources provider for NetworkPolicies and security policies
 *
 * @extends BaseResourceProvider
 * @since 2.3.0
 */
export class ValidationResources extends BaseResourceProvider {
  /**
   * Add NetworkPolicy for network segmentation
   */
  addNetworkPolicy(_spec: unknown) {
    // Implementation moved from CoreResources
    // TODO: Move NetworkPolicy implementation here
  }

  /**
   * Add PodSecurityPolicy (deprecated but still used)
   */
  addPodSecurityPolicy(_spec: unknown) {
    // TODO: Implement PodSecurityPolicy
  }

  /**
   * Add SecurityContext validation
   */
  addSecurityContextConstraints(_spec: unknown) {
    // TODO: Implement SecurityContextConstraints for OpenShift
  }
}
