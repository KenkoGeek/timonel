import type { ChartProps } from 'cdk8s';
import { Chart, App, Testing } from 'cdk8s';
import type { Construct } from 'constructs';
import type { ApiObject } from 'cdk8s';
import YAML from 'yaml';

// Import resource providers
import { CoreResources } from './resources/core/coreResources.js';
import { StorageResources } from './resources/core/storageResources.js';
import { AWSResources } from './resources/cloud/aws/awsResources.js';
import { AzureResources } from './resources/cloud/azure/azureResources.js';
import { GCPResources } from './resources/cloud/gcp/gcpResources.js';
// Import type definitions from providers
import type {
  DeploymentSpec,
  DaemonSetSpec,
  StatefulSetSpec,
  RoleSpec,
  ClusterRoleSpec,
  RoleBindingSpec,
  ClusterRoleBindingSpec,
  JobSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './resources/core/coreResources.js';
import type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './resources/core/storageResources.js';
import type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/awsResources.js';
import type {
  AzureDiskStorageClassSpec,
  AzureFileStorageClassSpec,
  AzureAGICIngressSpec,
  AzureKeyVaultSecretProviderClassSpec,
  AzureACRServiceAccountSpec,
} from './resources/cloud/azure/azureResources.js';
import type {
  GCPPersistentDiskStorageClassSpec,
  GCPFilestoreStorageClassSpec,
  GCPGCEIngressSpec,
  GCPWorkloadIdentityServiceAccountSpec,
} from './resources/cloud/gcp/gcpResources.js';
// Import HelmChartWriter for write functionality
import { HelmChartWriter, type SynthAsset } from './helmChartWriter.js';
import { include, helm } from './helm.js';
import { generateHelpersTemplate } from './utils/helmHelpers.js';
import { generateManifestName } from './utils/resourceNaming.js';
import type { HelperDefinition } from './utils/helmHelpers.js';
import type { NamingStrategy } from './utils/resourceNaming.js';

/**
 * Rutter class with modular architecture
 * Provides a clean API while delegating to specialized resource providers
 * Maintains full backward compatibility with the original Rutter class
 *
 * @since 2.4.0
 */
export class Rutter {
  // Constants for labels
  private static readonly HELPER_NAME = 'chart.name';

  // CDK8s infrastructure
  private readonly app: App;
  private readonly chart: Chart;

  // Resource providers
  private readonly coreResources: CoreResources;
  private readonly storageResources: StorageResources;
  private readonly awsResources: AWSResources;
  private readonly azureResources: AzureResources;
  private readonly gcpResources: GCPResources;

  // Chart metadata and configuration
  private readonly meta: ChartMetadata;
  private readonly defaultValues: Record<string, unknown>;
  private readonly envValues: Record<string, Record<string, unknown>>;
  private readonly props: RutterProps;
  private readonly assets: Array<{ id: string; yaml: string; target: string }> = [];

  constructor(props: RutterProps) {
    this.props = props;
    this.meta = props.meta;
    this.defaultValues = props.defaultValues ?? {};
    this.envValues = props.envValues ?? {};

    // Create CDK8s infrastructure
    this.app = new App();
    this.chart = new Chart(this.app, props.meta.name, {
      ...props.chartProps,
      ...(props.namespace ? { namespace: props.namespace } : {}),
    });

    // Initialize resource providers
    this.coreResources = new CoreResources(this.chart);
    this.storageResources = new StorageResources(this.chart);
    this.awsResources = new AWSResources(this.chart);
    this.azureResources = new AzureResources(this.chart);
    this.gcpResources = new GCPResources(this.chart);
  }

  // Core Kubernetes Resources

  /**
   * Creates a Deployment resource
   * @param spec - Deployment specification
   * @returns Created Deployment ApiObject
   *
   * @example
   * ```typescript
   * rutter.addDeployment({
   *   name: 'web-app',
   *   image: 'nginx:1.21',
   *   replicas: 3,
   *   containerPort: 80
   * });
   * ```
   *
   * @since 1.0.0
   */
  addDeployment(spec: DeploymentSpec): ApiObject {
    return this.coreResources.addDeployment(spec);
  }

  /**
   * Creates a DaemonSet resource
   * @param spec - DaemonSet specification
   * @returns Created DaemonSet ApiObject
   *
   * @example
   * ```typescript
   * rutter.addDaemonSet({
   *   name: 'log-collector',
   *   image: 'fluentd:v1.14',
   *   containerPort: 24224,
   *   hostNetwork: true
   * });
   * ```
   *
   * @since 2.4.0
   */
  addDaemonSet(spec: DaemonSetSpec): ApiObject {
    return this.coreResources.addDaemonSet(spec);
  }

  /**
   * Creates a StatefulSet resource
   * @param spec - StatefulSet specification
   * @returns Created StatefulSet ApiObject
   *
   * @example
   * ```typescript
   * rutter.addStatefulSet({
   *   name: 'database',
   *   image: 'postgres:13',
   *   replicas: 3,
   *   serviceName: 'database-headless',
   *   containerPort: 5432
   * });
   * ```
   *
   * @since 2.4.0
   */
  addStatefulSet(spec: StatefulSetSpec): ApiObject {
    return this.coreResources.addStatefulSet(spec);
  }

  /**
   * Creates a Role resource for RBAC
   * @param spec - Role specification
   * @returns Created Role ApiObject
   *
   * @example
   * ```typescript
   * rutter.addRole({
   *   name: 'pod-reader',
   *   rules: [
   *     {
   *       apiGroups: [''],
   *       resources: ['pods'],
   *       verbs: ['get', 'list', 'watch']
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addRole(spec: RoleSpec): ApiObject {
    return this.coreResources.addRole(spec);
  }

  /**
   * Creates a ClusterRole resource for cluster-wide RBAC
   * @param spec - ClusterRole specification
   * @returns Created ClusterRole ApiObject
   *
   * @example
   * ```typescript
   * rutter.addClusterRole({
   *   name: 'cluster-reader',
   *   rules: [
   *     {
   *       apiGroups: [''],
   *       resources: ['nodes', 'namespaces'],
   *       verbs: ['get', 'list', 'watch']
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addClusterRole(spec: ClusterRoleSpec): ApiObject {
    return this.coreResources.addClusterRole(spec);
  }

  /**
   * Creates a RoleBinding resource for RBAC
   * @param spec - RoleBinding specification
   * @returns Created RoleBinding ApiObject
   *
   * @example
   * ```typescript
   * rutter.addRoleBinding({
   *   name: 'pod-reader-binding',
   *   roleRef: {
   *     kind: 'Role',
   *     name: 'pod-reader',
   *     apiGroup: 'rbac.authorization.k8s.io'
   *   },
   *   subjects: [
   *     {
   *       kind: 'ServiceAccount',
   *       name: 'my-service-account'
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addRoleBinding(spec: RoleBindingSpec): ApiObject {
    return this.coreResources.addRoleBinding(spec);
  }

  /**
   * Creates a ClusterRoleBinding resource for cluster-wide RBAC
   * @param spec - ClusterRoleBinding specification
   * @returns Created ClusterRoleBinding ApiObject
   *
   * @example
   * ```typescript
   * rutter.addClusterRoleBinding({
   *   name: 'cluster-reader-binding',
   *   roleRef: {
   *     kind: 'ClusterRole',
   *     name: 'cluster-reader',
   *     apiGroup: 'rbac.authorization.k8s.io'
   *   },
   *   subjects: [
   *     {
   *       kind: 'ServiceAccount',
   *       name: 'monitoring-agent',
   *       namespace: 'monitoring'
   *     }
   *   ]
   * });
   * ```
   *
   * @since 2.4.0
   */
  addClusterRoleBinding(spec: ClusterRoleBindingSpec): ApiObject {
    return this.coreResources.addClusterRoleBinding(spec);
  }

  /**
   * Creates a Job resource for batch workloads
   * @param spec - Job specification
   * @returns Created Job ApiObject
   *
   * @example
   * ```typescript
   * rutter.addJob({
   *   name: 'data-processor',
   *   image: 'busybox:1.35',
   *   command: ['sh', '-c', 'echo "Processing..." && sleep 30'],
   *   completions: 1
   * });
   * ```
   *
   * @since 2.4.0
   */
  addJob(spec: JobSpec): ApiObject {
    return this.coreResources.addJob(spec);
  }

  /**
   * Creates a Service resource
   * @param spec - Service specification
   * @returns Created Service ApiObject
   *
   * @example
   * ```typescript
   * rutter.addService({
   *   name: 'web-service',
   *   port: 80,
   *   targetPort: 8080,
   *   type: 'ClusterIP'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addService(spec: ServiceSpec): ApiObject {
    return this.coreResources.addService(spec);
  }

  /**
   * Creates a ConfigMap resource
   * @param spec - ConfigMap specification
   * @returns Created ConfigMap ApiObject
   *
   * @example
   * ```typescript
   * rutter.addConfigMap({
   *   name: 'app-config',
   *   data: {
   *     'config.yaml': 'key: value',
   *     'app.properties': 'debug=true'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addConfigMap(spec: ConfigMapSpec): ApiObject {
    return this.coreResources.addConfigMap(spec);
  }

  /**
   * Creates a Secret resource
   * @param spec - Secret specification
   * @returns Created Secret ApiObject
   *
   * @example
   * ```typescript
   * rutter.addSecret({
   *   name: 'app-secrets',
   *   type: 'Opaque',
   *   data: {
   *     username: 'YWRtaW4=',
   *     password: 'MWYyZDFlMmU2N2Rm'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addSecret(spec: SecretSpec): ApiObject {
    return this.coreResources.addSecret(spec);
  }

  /**
   * Creates a ServiceAccount resource
   * @param spec - ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addServiceAccount({
   *   name: 'app-service-account',
   *   automountServiceAccountToken: false
   * });
   * ```
   *
   * @since 1.0.0
   */
  addServiceAccount(spec: ServiceAccountSpec): ApiObject {
    return this.coreResources.addServiceAccount(spec);
  }

  // Storage Resources

  /**
   * Creates a PersistentVolume resource
   * @param spec - PersistentVolume specification
   * @returns Created PersistentVolume ApiObject
   *
   * @example
   * ```typescript
   * rutter.addPersistentVolume({
   *   name: 'data-pv',
   *   capacity: '10Gi',
   *   accessModes: ['ReadWriteOnce'],
   *   storageClassName: 'fast-ssd'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addPersistentVolume(spec: PersistentVolumeSpec): ApiObject {
    return this.storageResources.addPersistentVolume(spec);
  }

  /**
   * Creates a PersistentVolumeClaim resource
   * @param spec - PersistentVolumeClaim specification
   * @returns Created PersistentVolumeClaim ApiObject
   *
   * @example
   * ```typescript
   * rutter.addPersistentVolumeClaim({
   *   name: 'data-pvc',
   *   size: '10Gi',
   *   accessModes: ['ReadWriteOnce'],
   *   storageClassName: 'fast-ssd'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addPersistentVolumeClaim(spec: PersistentVolumeClaimSpec): ApiObject {
    return this.storageResources.addPersistentVolumeClaim(spec);
  }

  /**
   * Creates a StorageClass resource
   * @param spec - StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addStorageClass({
   *   name: 'fast-ssd',
   *   provisioner: 'kubernetes.io/aws-ebs',
   *   parameters: {
   *     type: 'gp3',
   *     encrypted: 'true'
   *   }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addStorageClass(spec: StorageClassSpec): ApiObject {
    return this.storageResources.addStorageClass(spec);
  }

  // AWS Resources

  /**
   * Creates an AWS EBS StorageClass
   * @param spec - EBS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSEBSStorageClass({
   *   name: 'fast-ebs',
   *   volumeType: 'gp3',
   *   encrypted: true,
   *   allowVolumeExpansion: true
   * });
   * ```
   *
   * @since 1.0.0
   */
  addAWSEBSStorageClass(spec: AWSEBSStorageClassSpec): ApiObject {
    return this.awsResources.addEBSStorageClass(spec);
  }

  /**
   * Creates an AWS EFS StorageClass
   * @param spec - EFS StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSEFSStorageClass({
   *   name: 'efs-storage',
   *   fileSystemId: 'fs-12345678',
   *   directoryPerms: '0755'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addAWSEFSStorageClass(spec: AWSEFSStorageClassSpec): ApiObject {
    return this.awsResources.addEFSStorageClass(spec);
  }

  /**
   * Creates an AWS IRSA ServiceAccount
   * @param spec - IRSA ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSIRSAServiceAccount({
   *   name: 'aws-service-account',
   *   roleArn: 'arn:aws:iam::123456789012:role/MyRole'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addAWSIRSAServiceAccount(spec: AWSIRSAServiceAccountSpec): ApiObject {
    return this.awsResources.addIRSAServiceAccount(spec);
  }

  /**
   * Creates an AWS ALB Ingress
   * @param spec - ALB Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @example
   * ```typescript
   * rutter.addAWSALBIngress({
   *   name: 'web-ingress',
   *   rules: [{
   *     paths: [{
   *       path: '/',
   *       pathType: 'Prefix',
   *       backend: { service: { name: 'web-service', port: { number: 80 } } }
   *     }]
   *   }],
   *   scheme: 'internet-facing'
   * });
   * ```
   *
   * @since 1.0.0
   */
  addAWSALBIngress(spec: AWSALBIngressSpec): ApiObject {
    return this.awsResources.addALBIngress(spec);
  }

  // Azure Cloud Resources

  /**
   * Creates an Azure Disk StorageClass
   * @param spec - Azure Disk StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @since 2.4.0
   */
  addAzureDiskStorageClass(spec: AzureDiskStorageClassSpec): ApiObject {
    return this.azureResources.addAzureDiskStorageClass(spec);
  }

  /**
   * Creates an Azure File StorageClass
   * @param spec - Azure File StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @since 2.4.0
   */
  addAzureFileStorageClass(spec: AzureFileStorageClassSpec): ApiObject {
    return this.azureResources.addAzureFileStorageClass(spec);
  }

  /**
   * Creates an Azure Application Gateway Ingress
   * @param spec - AGIC Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @since 2.4.0
   */
  addAzureApplicationGatewayIngress(spec: AzureAGICIngressSpec): ApiObject {
    return this.azureResources.addApplicationGatewayIngress(spec);
  }

  /**
   * Creates an Azure Key Vault SecretProviderClass
   * @param spec - Azure Key Vault SecretProviderClass specification
   * @returns Created SecretProviderClass ApiObject
   *
   * @since 2.4.0
   */
  addAzureKeyVaultSecretProviderClass(spec: AzureKeyVaultSecretProviderClassSpec): ApiObject {
    return this.azureResources.addAzureKeyVaultSecretProviderClass(spec);
  }

  /**
   * Creates an Azure Container Registry ServiceAccount
   * @param spec - Azure ACR ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @since 2.4.0
   */
  addAzureACRServiceAccount(spec: AzureACRServiceAccountSpec): ApiObject {
    return this.azureResources.addAzureACRServiceAccount(spec);
  }

  // GCP Cloud Resources

  /**
   * Creates a GCP Persistent Disk StorageClass
   * @param spec - GCP PD StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @since 2.4.0
   */
  addGCPPersistentDiskStorageClass(spec: GCPPersistentDiskStorageClassSpec): ApiObject {
    return this.gcpResources.addPersistentDiskStorageClass(spec);
  }

  /**
   * Creates a GCP Filestore StorageClass
   * @param spec - GCP Filestore StorageClass specification
   * @returns Created StorageClass ApiObject
   *
   * @since 2.4.0
   */
  addGCPFilestoreStorageClass(spec: GCPFilestoreStorageClassSpec): ApiObject {
    return this.gcpResources.addFilestoreStorageClass(spec);
  }

  /**
   * Creates a GCE Ingress with Google Cloud Load Balancer
   * @param spec - GCE Ingress specification
   * @returns Created Ingress ApiObject
   *
   * @since 2.4.0
   */
  addGCPGCEIngress(spec: GCPGCEIngressSpec): ApiObject {
    return this.gcpResources.addGCEIngress(spec);
  }

  /**
   * Creates a ServiceAccount with Workload Identity annotations
   * @param spec - Workload Identity ServiceAccount specification
   * @returns Created ServiceAccount ApiObject
   *
   * @since 2.4.0
   */
  addGCPWorkloadIdentityServiceAccount(spec: GCPWorkloadIdentityServiceAccountSpec): ApiObject {
    return this.gcpResources.addWorkloadIdentityServiceAccount(spec);
  }

  // Utility methods

  /**
   * Adds a custom resource definition (CRD) YAML or object
   * @param yamlOrObject - CRD YAML content string or object
   * @param id - Unique identifier for the CRD
   *
   * @example
   * ```typescript
   * // Using YAML string
   * rutter.addCrd(`
   * apiVersion: apiextensions.k8s.io/v1
   * kind: CustomResourceDefinition
   * metadata:
   *   name: example.com
   * spec:
   *   group: example.com
   *   versions: []
   * `);
   *
   * // Using object
   * rutter.addCrd({
   *   apiVersion: 'apiextensions.k8s.io/v1',
   *   kind: 'CustomResourceDefinition',
   *   metadata: { name: 'example.com' },
   *   spec: { group: 'example.com', versions: [] }
   * });
   * ```
   *
   * @since 1.0.0
   */
  addCrd(yamlOrObject: string | Record<string, unknown>, id = 'crd'): void {
    let yaml: string;
    let crdObject: Record<string, unknown>;

    if (typeof yamlOrObject === 'string') {
      // Validate YAML string
      try {
        crdObject = YAML.parse(yamlOrObject) as Record<string, unknown>;
        yaml = yamlOrObject.trim();
      } catch (error) {
        throw new Error(
          `Invalid YAML provided to addCrd(): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else if (typeof yamlOrObject === 'object' && yamlOrObject !== null) {
      // Use object directly and convert to YAML
      crdObject = yamlOrObject;
      try {
        yaml = YAML.stringify(yamlOrObject).trim();
      } catch (error) {
        throw new Error(
          `Failed to convert object to YAML in addCrd(): ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    } else {
      throw new Error('addCrd() requires either a YAML string or an object');
    }

    // Ensure we have valid content
    if (!yaml) {
      throw new Error('addCrd() received empty or invalid content');
    }

    // Validate CRD structure
    this.validateCrdStructure(crdObject);

    this.assets.push({ id, yaml, target: 'crds' });
  }

  /**
   * Validates CRD structure according to Kubernetes specification
   * @param crd - CRD object to validate
   * @private
   * @since 2.5.0
   */
  private validateCrdStructure(crd: Record<string, unknown>): void {
    if (crd['apiVersion'] !== 'apiextensions.k8s.io/v1') {
      throw new Error('CRD must use apiVersion: apiextensions.k8s.io/v1');
    }

    if (crd['kind'] !== 'CustomResourceDefinition') {
      throw new Error('CRD must have kind: CustomResourceDefinition');
    }

    if (!crd['metadata'] || typeof crd['metadata'] !== 'object' || crd['metadata'] === null) {
      throw new Error('CRD must have a metadata object');
    }

    const metadata = crd['metadata'] as Record<string, unknown>;
    if (!metadata['name'] || typeof metadata['name'] !== 'string') {
      throw new Error('CRD must have a valid metadata.name');
    }

    if (!crd['spec'] || typeof crd['spec'] !== 'object' || crd['spec'] === null) {
      throw new Error('CRD must have a spec object');
    }

    const spec = crd['spec'] as Record<string, unknown>;
    if (!spec['group'] || typeof spec['group'] !== 'string') {
      throw new Error('CRD must have a valid spec.group');
    }

    if (!Array.isArray(spec['versions']) || spec['versions'].length === 0) {
      throw new Error('CRD must have at least one version in spec.versions');
    }
  }

  /**
   * Gets chart metadata
   * @returns Chart metadata
   *
   * @since 1.0.0
   */
  getMeta(): ChartMetadata {
    return { ...this.meta };
  }

  /**
   * Gets default values
   * @returns Default values object
   *
   * @since 1.0.0
   */
  getDefaultValues(): Record<string, unknown> {
    return { ...this.defaultValues };
  }

  /**
   * Gets environment-specific values
   * @returns Environment values object
   *
   * @since 1.0.0
   */
  getEnvValues(): Record<string, Record<string, unknown>> {
    return { ...this.envValues };
  }

  /**
   * Gets all assets (CRDs, etc.)
   * @returns Array of assets
   *
   * @since 1.0.0
   */
  getAssets(): Array<{ id: string; yaml: string; target: string }> {
    return [...this.assets];
  }

  /**
   * Converts the chart to SynthAsset array for HelmChartWriter
   * @returns Array of synthesized assets
   *
   * @since 2.4.0
   */
  private toSynthArray(): SynthAsset[] {
    // Use cdk8s Testing.synth to obtain manifest objects
    const manifestObjs = Testing.synth(this.chart) as unknown[];

    // Enforce common labels best-practice on all rendered objects
    const enriched = manifestObjs.map((obj: unknown) => {
      if (obj && typeof obj === 'object') {
        const o = obj as { metadata?: { labels?: Record<string, unknown> } };
        o.metadata = o.metadata ?? {};
        o.metadata.labels = o.metadata.labels ?? {};
        const labels = o.metadata.labels as Record<string, unknown>;
        const defaults: Record<string, string> = {
          'helm.sh/chart': '{{ .Chart.Name }}-{{ .Chart.Version }}',
          'app.kubernetes.io/name': include(Rutter.HELPER_NAME),
          'app.kubernetes.io/instance': helm.releaseName,
          'app.kubernetes.io/version': helm.chartVersion,
          'app.kubernetes.io/managed-by': '{{ .Release.Service }}',
          'app.kubernetes.io/part-of': helm.chartName,
        };

        // Apply defaults only if not already set
        for (const [key, value] of Object.entries(defaults)) {
          if (!(key in labels)) {
            // eslint-disable-next-line security/detect-object-injection -- Safe: controlled label assignment
            labels[key] = value;
          }
        }
      }
      return obj;
    });

    const synthAssets: SynthAsset[] = [];

    if (this.props.singleManifestFile) {
      // Combine all resources into single manifest
      const combinedYaml = enriched
        .map((obj) => YAML.stringify(obj).trim())
        .filter(Boolean)
        .join('\n---\n');

      const manifestId = this.props.manifestPrefix ?? 'manifests';
      synthAssets.push({ id: manifestId, yaml: combinedYaml });
    } else {
      // Create separate files for each resource (default behavior)
      enriched.forEach((obj, index) => {
        const yaml = YAML.stringify(obj).trim();
        if (yaml) {
          const manifestId = generateManifestName(
            obj,
            this.props.namingStrategy ?? 'descriptive',
            index + 1,
            this.props.manifestPrefix,
          );
          synthAssets.push({ id: manifestId, yaml });
        }
      });
    }

    // Add any additional assets (CRDs, etc.)
    this.assets.forEach((asset) => {
      synthAssets.push({ id: asset.id, yaml: asset.yaml });
    });

    return synthAssets;
  }

  /**
   * Writes the Helm chart to the specified output directory
   * @param outDir - Output directory path
   *
   * @since 1.0.0
   */
  write(outDir: string): void {
    // Generate helpers template
    let helpersContent: string | undefined;
    if (this.props.helpersTpl) {
      if (typeof this.props.helpersTpl === 'string') {
        helpersContent = this.props.helpersTpl;
      } else {
        helpersContent = this.props.helpersTpl
          .map(
            (helper) => `{{/*
${helper.name}
*/}}
{{- define "${helper.name}" -}}
${helper.template}
{{- end }}`,
          )
          .join('\n\n');
      }
    } else {
      // Auto-generate standard helpers
      helpersContent = generateHelpersTemplate(this.props.cloudProvider);
    }

    HelmChartWriter.write({
      outDir,
      meta: this.meta,
      defaultValues: this.defaultValues,
      envValues: this.envValues,
      assets: this.toSynthArray(),
      helpersTpl: helpersContent,
    });
  }
}

// Type definitions
export interface ChartMetadata {
  name: string;
  version: string;
  description?: string;
  keywords?: string[];
  home?: string;
  sources?: string[];
  maintainers?: Array<{
    name: string;
    email?: string;
    url?: string;
  }>;
}

export interface RutterProps {
  scope?: Construct;
  meta: ChartMetadata;
  defaultValues?: Record<string, unknown>;
  envValues?: Record<string, Record<string, unknown>>;
  namespace?: string;
  chartProps?: ChartProps;
  /** Custom Helm helpers content or definitions */
  helpersTpl?: string | HelperDefinition[];
  /** Cloud provider for default helpers */
  cloudProvider?: 'aws' | 'azure' | 'gcp';
  /** Manifest file naming strategy */
  namingStrategy?: NamingStrategy;
  /** Custom prefix for manifest files */
  manifestPrefix?: string;
  /** Combine all resources into single manifest file */
  singleManifestFile?: boolean;
}

// Re-export types for backward compatibility
export type {
  DeploymentSpec,
  ServiceSpec,
  ConfigMapSpec,
  SecretSpec,
  ServiceAccountSpec,
} from './resources/core/coreResources.js';

export type {
  PersistentVolumeSpec,
  PersistentVolumeClaimSpec,
  StorageClassSpec,
} from './resources/core/storageResources.js';

export type {
  AWSEBSStorageClassSpec,
  AWSEFSStorageClassSpec,
  AWSIRSAServiceAccountSpec,
  AWSALBIngressSpec,
} from './resources/cloud/aws/awsResources.js';
