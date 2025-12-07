import { ApiObject } from 'cdk8s';
import type { Chart } from 'cdk8s';

/**
 * Base interface for all resource providers
 * Provides common functionality and ensures consistent patterns across providers
 *
 * @since 2.8.0+
 */
export interface IResourceProvider {
  /** Reference to the CDK8s chart */
  readonly chart: Chart;
}

/**
 * Abstract base class for resource providers
 * Implements common functionality and validation patterns
 *
 * @since 2.4.0
 */
export abstract class BaseResourceProvider implements IResourceProvider {
  constructor(public readonly chart: Chart) {}

  /**
   * Validates that a name follows Kubernetes naming conventions
   * @param name - Resource name to validate
   * @param resourceType - Type of resource for error messages
   * @throws Error if name is invalid
   */
  protected validateKubernetesName(name: string, resourceType: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error(`${resourceType} name must be a non-empty string`);
    }

    // Kubernetes name validation (RFC 1123 subdomain)
    // eslint-disable-next-line security/detect-unsafe-regex -- Simple character class regex is safe
    const nameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
    if (!nameRegex.test(name) || name.length > 63) {
      throw new Error(
        `${resourceType} name '${name}' must be a valid Kubernetes name (lowercase alphanumeric and hyphens, max 63 chars)`,
      );
    }
  }

  /**
   * Validates that labels follow Kubernetes conventions
   * @param labels - Labels to validate
   * @param resourceType - Type of resource for error messages
   */
  protected validateLabels(labels: Record<string, string> | undefined, resourceType: string): void {
    if (!labels) return;

    Object.entries(labels).forEach(([key, value]) => {
      // Validate label key
      if (key.length > 253) {
        throw new Error(`${resourceType} label key '${key}' exceeds 253 characters`);
      }

      // Validate label value
      if (value.length > 63) {
        throw new Error(`${resourceType} label value '${value}' exceeds 63 characters`);
      }

      // Skip validation for Helm template values
      if (value.includes('{{') && value.includes('}}')) {
        return;
      }

      // Basic character validation
      // eslint-disable-next-line security/detect-unsafe-regex -- Simple character class regex is safe
      const labelRegex = /^[a-zA-Z0-9]([-a-zA-Z0-9_.]*[a-zA-Z0-9])?$/;
      if (!labelRegex.test(value)) {
        throw new Error(`${resourceType} label value '${value}' contains invalid characters`);
      }
    });
  }

  /**
   * Creates a standardized ApiObject with common metadata
   * @param name - Resource name
   * @param apiVersion - Kubernetes API version
   * @param kind - Kubernetes resource kind
   * @param spec - Resource specification
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created ApiObject
   */
  protected createApiObject(
    name: string,
    apiVersion: string,
    kind: string,
    spec: Record<string, unknown>,
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    this.validateKubernetesName(name, kind);
    this.validateLabels(labels, kind);

    return new ApiObject(this.chart, name, {
      apiVersion,
      kind,
      metadata: {
        name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(annotations && Object.keys(annotations).length > 0 ? { annotations } : {}),
      },
      spec,
    });
  }

  /**
   * Creates an ApiObject for resources that don't use spec wrapper (like StorageClass)
   * @param name - Resource name
   * @param apiVersion - API version
   * @param kind - Resource kind
   * @param fields - Root-level fields for the resource
   * @param labels - Optional labels
   * @param annotations - Optional annotations
   * @returns Created ApiObject
   * @since 2.8.0+
   */
  protected createRootLevelApiObject(
    name: string,
    apiVersion: string,
    kind: string,
    fields: Record<string, unknown>,
    labels?: Record<string, string>,
    annotations?: Record<string, string>,
  ): ApiObject {
    this.validateKubernetesName(name, kind);
    this.validateLabels(labels, kind);

    // Validate that fields doesn't contain reserved keys
    const reservedKeys = ['apiVersion', 'kind', 'metadata'];
    const conflictingKeys = Object.keys(fields).filter((key) => reservedKeys.includes(key));
    if (conflictingKeys.length > 0) {
      throw new Error(
        `Fields object contains reserved keys: ${conflictingKeys.join(', ')}. These keys cannot be overridden.`,
      );
    }

    return new ApiObject(this.chart, name, {
      apiVersion,
      kind,
      metadata: {
        name,
        ...(labels && Object.keys(labels).length > 0 ? { labels } : {}),
        ...(annotations && Object.keys(annotations).length > 0 ? { annotations } : {}),
      },
      ...fields, // Fields go at root level, not under spec
    });
  }
}
