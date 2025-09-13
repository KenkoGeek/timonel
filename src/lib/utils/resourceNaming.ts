/**
 * @fileoverview Resource naming utilities for Helm chart generation
 * @since 2.5.0
 */

/**
 * Kubernetes resource object interface
 * @interface KubernetesResource
 * @since 2.5.0
 */
export interface KubernetesResource {
  /** Resource kind (e.g., Deployment, Service) */
  kind?: string;
  /** Resource metadata */
  metadata?: {
    /** Resource name */
    name?: string;
    /** Resource namespace */
    namespace?: string;
  };
}

/**
 * Naming strategy for manifest files
 * @since 2.5.0
 */
export type NamingStrategy =
  | 'descriptive' // kind-name.yaml (e.g., deployment-wordpress.yaml)
  | 'numbered' // manifests-001.yaml
  | 'kind-only' // deployment.yaml
  | 'name-only'; // wordpress.yaml

/**
 * Generates descriptive resource name from Kubernetes object
 * @param resource - Kubernetes resource object
 * @returns Descriptive name in format "kind-name"
 * @since 2.5.0
 */
export function getResourceName(resource: unknown): string {
  if (!resource || typeof resource !== 'object') {
    return 'resource';
  }

  const k8sResource = resource as KubernetesResource;

  if (k8sResource.kind && k8sResource.metadata?.name) {
    return `${k8sResource.kind.toLowerCase()}-${k8sResource.metadata.name}`;
  }

  if (k8sResource.kind) {
    return k8sResource.kind.toLowerCase();
  }

  if (k8sResource.metadata?.name) {
    return k8sResource.metadata.name;
  }

  return 'resource';
}

/**
 * Generates manifest file name based on strategy
 * @param resource - Kubernetes resource object
 * @param strategy - Naming strategy to use
 * @param index - Resource index for numbered strategy
 * @param prefix - Optional prefix for file names
 * @returns Generated file name without extension
 * @since 2.5.0
 */
export function generateManifestName(
  resource: unknown,
  strategy: NamingStrategy = 'descriptive',
  index?: number,
  prefix?: string,
): string {
  const k8sResource = resource as KubernetesResource;

  switch (strategy) {
    case 'descriptive': {
      return getResourceName(resource);
    }

    case 'numbered': {
      const paddedIndex = String(index ?? 1).padStart(3, '0');
      return prefix ? `${prefix}-${paddedIndex}` : `manifests-${paddedIndex}`;
    }

    case 'kind-only': {
      return k8sResource.kind?.toLowerCase() ?? 'resource';
    }

    case 'name-only': {
      return k8sResource.metadata?.name ?? 'resource';
    }

    default: {
      return getResourceName(resource);
    }
  }
}

/**
 * Sanitizes name for Kubernetes compatibility
 * @param name - Raw name to sanitize
 * @returns Kubernetes-compatible name
 * @since 2.5.0
 */
export function sanitizeKubernetesName(name: string): string {
  // Input validation to prevent processing extremely large strings
  if (!name || typeof name !== 'string') {
    return '';
  }
  
  // Prevent processing of maliciously large inputs
  if (name.length > 1000) {
    name = name.substring(0, 1000);
  }
  
  const lowerName = name.toLowerCase();
  let sanitized = '';
  let lastWasHyphen = false;
  
  // Character-by-character processing to avoid ReDoS vulnerability
  for (const char of lowerName) {
    if (isValidKubernetesChar(char)) {
      if (char === '-') {
        // Only add hyphen if the last character wasn't a hyphen
        if (!lastWasHyphen) {
          sanitized += char;
          lastWasHyphen = true;
        }
      } else {
        sanitized += char;
        lastWasHyphen = false;
      }
    } else {
      // Replace invalid character with hyphen, but avoid consecutive hyphens
      if (!lastWasHyphen) {
        sanitized += '-';
        lastWasHyphen = true;
      }
    }
  }
  
  // Remove leading and trailing hyphens using string operations
  while (sanitized.length > 0 && sanitized[0] === '-') {
    sanitized = sanitized.substring(1);
  }
  while (sanitized.length > 0 && sanitized[sanitized.length - 1] === '-') {
    sanitized = sanitized.substring(0, sanitized.length - 1);
  }
  
  // Truncate to Kubernetes name length limit
  return sanitized.substring(0, 63);
}

/**
 * Checks if a character is valid for Kubernetes names
 * @param char - Character to check
 * @returns True if character is valid (a-z, 0-9, or hyphen)
 * @private
 */
function isValidKubernetesChar(char: string): boolean {
  return (char >= 'a' && char <= 'z') || 
         (char >= '0' && char <= '9') || 
         char === '-';
}

/**
 * Validates Kubernetes resource name
 * @param name - Name to validate
 * @returns True if valid, false otherwise
 * @since 2.5.0
 */
export function isValidKubernetesName(name: string): boolean {
  // eslint-disable-next-line security/detect-unsafe-regex -- Safe: simple DNS-1123 validation
  const regex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  return regex.test(name) && name.length <= 63;
}
