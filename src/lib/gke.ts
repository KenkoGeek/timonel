/**
 * @fileoverview GKE (Google Kubernetes Engine) helpers for Timonel
 * @since 1.0.0
 */

import type { Rutter } from './Rutter.js';

/**
 * GKE Workload Identity ServiceAccount specification
 * Enables secure authentication to Google Cloud APIs without service account keys
 *
 * @interface GKEWorkloadIdentityServiceAccountSpec
 * @since 1.0.0
 * @see https://cloud.google.com/kubernetes-engine/docs/concepts/workload-identity
 */
export interface GKEWorkloadIdentityServiceAccountSpec {
  /** ServiceAccount name */
  name: string;
  /** Google Cloud service account email for workload identity */
  gcpServiceAccountEmail: string;
  /** Labels to apply to the ServiceAccount */
  labels?: Record<string, string>;
  /** Additional annotations to apply to the ServiceAccount */
  annotations?: Record<string, string>;
  /** Whether to automount service account token */
  automountServiceAccountToken?: boolean;
  /** Names of image pull secrets */
  imagePullSecrets?: string[];
  /** Names of secrets to mount */
  secrets?: string[];
}

/**
 * Add GKE Workload Identity ServiceAccount helper to Rutter
 * Creates a ServiceAccount with GKE Workload Identity annotations for secure authentication
 *
 * @param rutter - Rutter instance
 * @returns Extended Rutter with GKE helpers
 *
 * @example
 * ```typescript
 * import { Rutter } from 'timonel';
 * import { addGKEHelpers } from 'timonel/gke';
 *
 * const rutter = addGKEHelpers(new Rutter({
 *   meta: { name: 'my-app', version: '1.0.0' }
 * }));
 *
 * rutter.addGKEWorkloadIdentityServiceAccount({
 *   name: 'workload-identity-sa',
 *   gcpServiceAccountEmail: 'my-service@my-project.iam.gserviceaccount.com'
 * });
 * ```
 *
 * @since 1.0.0
 */
export function addGKEHelpers(rutter: Rutter) {
  return Object.assign(rutter, {
    /**
     * Add GKE Workload Identity ServiceAccount
     * Creates a ServiceAccount with GKE Workload Identity annotations for secure authentication
     *
     * @param spec - GKE Workload Identity ServiceAccount specification
     * @returns The created ServiceAccount ApiObject
     *
     * @example
     * ```typescript
     * rutter.addGKEWorkloadIdentityServiceAccount({
     *   name: 'workload-identity-sa',
     *   gcpServiceAccountEmail: 'my-service@my-project.iam.gserviceaccount.com',
     *   automountServiceAccountToken: true
     * });
     * ```
     *
     * @since 1.0.0
     */
    addGKEWorkloadIdentityServiceAccount(spec: GKEWorkloadIdentityServiceAccountSpec) {
      // Validate GCP service account email format
      if (!isValidGCPServiceAccountEmail(spec.gcpServiceAccountEmail)) {
        throw new Error(
          `GKE Workload Identity ${spec.name}: Invalid GCP service account email format`,
        );
      }

      const annotations: Record<string, string> = {
        'iam.gke.io/gcp-service-account': spec.gcpServiceAccountEmail,
        ...(spec.annotations ?? {}),
      };

      return rutter.addServiceAccount({
        name: spec.name,
        annotations,
        ...(spec.labels ? { labels: spec.labels } : {}),
        ...(spec.automountServiceAccountToken !== undefined
          ? { automountServiceAccountToken: spec.automountServiceAccountToken }
          : {}),
        ...(spec.imagePullSecrets ? { imagePullSecrets: spec.imagePullSecrets } : {}),
        ...(spec.secrets ? { secrets: spec.secrets } : {}),
      });
    },
  });
}

/**
 * Validate GCP service account email format
 * @param email - Service account email to validate
 * @returns True if valid format
 */
function isValidGCPServiceAccountEmail(email: string): boolean {
  // Basic validation for GCP service account email format
  // Format: service-account-name@project-id.iam.gserviceaccount.com
  const gcpEmailRegex = /^[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com$/;
  return gcpEmailRegex.test(email);
}
