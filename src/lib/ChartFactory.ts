import { App, Chart, Testing, ApiObject } from 'cdk8s';
import * as kplus from 'cdk8s-plus-28';
import YAML from 'yaml';

import { HelmChartWriter } from './HelmChartWriter';
import type {
  HelmChartMeta,
  HelmChartWriteOptions,
  SynthAsset,
  HelperDefinition,
} from './HelmChartWriter';

export interface DeploymentSpec {
  name: string;
  image: string;
  replicas?: number;
  containerPort?: number;
  env?: Record<string, string>;
}

export interface ServiceSpec {
  name: string;
  port: number;
  targetPort?: number;
  type?: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
}

export interface IngressSpec {
  name: string;
  host: string;
  serviceName: string;
  servicePort: number;
  className?: string;
}

export interface ChartFactoryProps {
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  /** Optional Helm helpers content for templates/_helpers.tpl */
  helpersTpl?: string | HelperDefinition[];
}

/**
 * ChartFactory builds Kubernetes manifests using cdk8s and writes a Helm chart.
 */
export class ChartFactory {
  private readonly props: ChartFactoryProps;
  private readonly app: App;
  private readonly chart: Chart;
  private readonly assets: SynthAsset[] = [];

  constructor(props: ChartFactoryProps) {
    this.props = props;
    this.app = new App();
    this.chart = new Chart(this.app, props.meta.name);
  }

  addDeployment(spec: DeploymentSpec) {
    const dep = new kplus.Deployment(this.chart, spec.name, {
      replicas: spec.replicas ?? 1,
      containers: [
        {
          image: spec.image,
          portNumber: spec.containerPort ?? 3000,
          envVariables: Object.fromEntries(
            Object.entries(spec.env ?? {}).map(([k, v]) => [k, kplus.EnvValue.fromValue(v)]),
          ),
        },
      ],
    });
    this.capture(dep, `${spec.name}-deployment`);
    return dep;
  }

  addService(spec: ServiceSpec) {
    const typeMap: Record<'ClusterIP' | 'NodePort' | 'LoadBalancer', kplus.ServiceType> = {
      ClusterIP: kplus.ServiceType.CLUSTER_IP,
      NodePort: kplus.ServiceType.NODE_PORT,
      LoadBalancer: kplus.ServiceType.LOAD_BALANCER,
    };
    const svc = new kplus.Service(this.chart, spec.name, {
      type: spec.type ? typeMap[spec.type] : kplus.ServiceType.CLUSTER_IP,
      ports: [{ port: spec.port, targetPort: spec.targetPort ?? spec.port }],
    });
    this.capture(svc, `${spec.name}-service`);
    return svc;
  }

  addIngress(spec: IngressSpec) {
    // Use a raw ApiObject for broader compatibility across kplus versions
    const ing = new ApiObject(this.chart, spec.name, {
      apiVersion: 'networking.k8s.io/v1',
      kind: 'Ingress',
      metadata: { name: spec.name },
      spec: {
        ingressClassName: spec.className,
        rules: [
          {
            host: spec.host,
            http: {
              paths: [
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: spec.serviceName,
                      port: { number: spec.servicePort },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
    this.capture(ing, `${spec.name}-ingress`);
    return ing;
  }

  /**
   * Capture the YAML of an ApiObject or Construct into assets.
   */
  private capture(_obj: unknown, id: string) {
    // Ensure the app can synth
    // We defer synth until write(), but we can capture logical ids now
    this.assets.push({ id, yaml: `# captured:${id}` });
  }

  /**
   * Synthesize the cdk8s app and write a Helm chart to outDir.
   */
  write(outDir: string) {
    // Use cdk8s Testing.synth to obtain manifest objects
    const manifestObjs: unknown[] = Testing.synth(this.chart) as unknown[];
    const combinedYaml = manifestObjs
      .map((obj) => YAML.stringify(obj).trim())
      .filter(Boolean)
      .map((y) => `---\n${y}`)
      .join('\n');
    this.assets.length = 0;
    this.assets.push({ id: 'manifests', yaml: combinedYaml });

    const options: HelmChartWriteOptions = {
      outDir,
      meta: this.props.meta,
      defaultValues: this.props.defaultValues,
      envValues: this.props.envValues,
      assets: this.assets,
      ...(this.props.helpersTpl !== undefined ? { helpersTpl: this.props.helpersTpl } : {}),
    } as HelmChartWriteOptions;
    HelmChartWriter.write(options);
  }
}
