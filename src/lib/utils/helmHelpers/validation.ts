/**
 * @fileoverview Validation rules for Helm helper templates.
 * @since 3.1.3
 */

/**
 * Detects whether a helper template is being used to emit a Kubernetes resource.
 *
 * Helm helpers are intended for reusable names, labels, computed values, and fragments.
 * Kubernetes resources must be modeled through typed cdk8s/cdk8s-plus constructs instead of
 * embedding a complete manifest in `_helpers.tpl`.
 *
 * @param template - Helm helper template body to inspect.
 * @returns True when the helper contains the structural markers of a Kubernetes manifest.
 * @since 3.1.3
 */
export function isKubernetesManifestHelper(template: string): boolean {
  const hasApiVersion = /\bapiVersion\s*:/m.test(template);
  const hasKind = /\bkind\s*:/m.test(template);
  const hasMetadata = /\bmetadata\s*:/m.test(template);

  return hasApiVersion && hasKind && hasMetadata;
}

/**
 * Rejects helper templates that embed complete Kubernetes resources.
 *
 * @param template - Helm helper template body to validate.
 * @param helperName - Optional helper name used to improve the error message.
 * @throws {Error} When the helper contains a Kubernetes manifest.
 * @since 3.1.3
 */
export function assertTypedHelperTemplate(template: string, helperName?: string): void {
  if (!isKubernetesManifestHelper(template)) {
    return;
  }

  const helper = helperName ? ` '${helperName}'` : '';
  throw new Error(
    `Helm helper${helper} cannot contain a Kubernetes manifest. ` +
      'Create the resource with typed cdk8s/cdk8s-plus constructs on Rutter.getChart() instead.',
  );
}
