import type { ApiObjectMetadata } from 'cdk8s';
import type { Construct } from 'constructs';

import { TypedCustomResource } from './typedCustomResource.js';

export interface LabelSelector {
  readonly matchLabels?: Record<string, string>;
  readonly matchExpressions?: Array<{
    readonly key: string;
    readonly operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist';
    readonly values?: string[];
  }>;
}

export interface ServiceMonitorEndpoint {
  readonly port?: string;
  readonly targetPort?: string | number;
  readonly path?: string;
  readonly scheme?: 'http' | 'https';
  readonly interval?: string;
  readonly scrapeTimeout?: string;
  readonly honorLabels?: boolean;
  readonly metricRelabelings?: Array<Record<string, unknown>>;
  readonly relabelings?: Array<Record<string, unknown>>;
}

export interface ServiceMonitorSpec {
  readonly selector: LabelSelector;
  readonly namespaceSelector?: {
    readonly any?: boolean;
    readonly matchNames?: string[];
  };
  readonly endpoints: ServiceMonitorEndpoint[];
  readonly jobLabel?: string;
  readonly targetLabels?: string[];
  readonly podTargetLabels?: string[];
  readonly sampleLimit?: number;
}

export interface ServiceMonitorProps {
  readonly metadata?: ApiObjectMetadata;
  readonly spec: ServiceMonitorSpec;
}

/** Typed Prometheus Operator ServiceMonitor custom resource. */
export class ServiceMonitor extends TypedCustomResource<{ spec: ServiceMonitorSpec }> {
  constructor(scope: Construct, id: string, props: ServiceMonitorProps) {
    super(scope, id, {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'ServiceMonitor',
      ...(props.metadata ? { metadata: props.metadata } : {}),
      body: { spec: props.spec },
    });
  }
}

export interface PrometheusRuleAlert {
  readonly alert?: string;
  readonly record?: string;
  readonly expr: string;
  readonly for?: string;
  readonly labels?: Record<string, string>;
  readonly annotations?: Record<string, string>;
}

export interface PrometheusRuleGroup {
  readonly name: string;
  readonly interval?: string;
  readonly limit?: number;
  readonly rules: PrometheusRuleAlert[];
}

export interface PrometheusRuleSpec {
  readonly groups: PrometheusRuleGroup[];
}

export interface PrometheusRuleProps {
  readonly metadata?: ApiObjectMetadata;
  readonly spec: PrometheusRuleSpec;
}

/** Typed Prometheus Operator PrometheusRule custom resource. */
export class PrometheusRule extends TypedCustomResource<{ spec: PrometheusRuleSpec }> {
  constructor(scope: Construct, id: string, props: PrometheusRuleProps) {
    super(scope, id, {
      apiVersion: 'monitoring.coreos.com/v1',
      kind: 'PrometheusRule',
      ...(props.metadata ? { metadata: props.metadata } : {}),
      body: { spec: props.spec },
    });
  }
}
