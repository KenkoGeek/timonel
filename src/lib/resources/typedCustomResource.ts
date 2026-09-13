/**
 * Typed custom-resource construct for Kubernetes APIs without a cdk8s-plus abstraction.
 *
 * Consumers provide their own TypeScript body interface while Timonel keeps the
 * resource attached to the normal cdk8s construct tree. This is intended for CRDs
 * and extension APIs such as ServiceMonitor, PrometheusRule, cert-manager, Cilium,
 * and OpenShift resources.
 */
import { ApiObject, type ApiObjectMetadata } from 'cdk8s';
import type { Construct } from 'constructs';

/** Root keys owned by cdk8s rather than the caller-provided typed resource body. */
type ReservedApiObjectKeys = {
  readonly apiVersion?: never;
  readonly kind?: never;
  readonly metadata?: never;
};

/** Properties for a typed Kubernetes custom resource. */
export interface TypedCustomResourceProps<TBody extends object> {
  /** Kubernetes API version, for example `monitoring.coreos.com/v1`. */
  readonly apiVersion: string;
  /** Kubernetes resource kind, for example `ServiceMonitor`. */
  readonly kind: string;
  /** Standard Kubernetes object metadata. */
  readonly metadata?: ApiObjectMetadata;
  /**
   * Strongly typed resource-specific top-level fields.
   *
   * For conventional CRDs this is commonly `{ spec: MySpec }`. APIs with
   * non-standard top-level fields, such as OpenShift SCC, can model those fields
   * directly without weakening the type to an arbitrary manifest.
   */
  readonly body: TBody & ReservedApiObjectKeys;
}

/**
 * Generic typed cdk8s ApiObject for Kubernetes extension APIs.
 *
 * The generic body type is preserved in published declarations and at runtime,
 * while synthesis remains native cdk8s/Timonel synthesis. Helm-aware values can
 * be represented with Timonel `HelmExpression` fields (for example by calling
 * `valuesRef<T>().foo.toExpression()`) when the consumer's body type permits them.
 */
export class TypedCustomResource<TBody extends object> extends ApiObject {
  /** Original typed resource-specific body supplied by the consumer. */
  readonly body: TBody;

  constructor(scope: Construct, id: string, props: TypedCustomResourceProps<TBody>) {
    const { apiVersion, kind, metadata, body } = props;
    super(scope, id, {
      ...body,
      apiVersion,
      kind,
      ...(metadata ? { metadata } : {}),
    });
    this.body = body;
  }
}
