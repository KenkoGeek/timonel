# Timonel

[![License: MIT][license-badge]][license-url]
[![npm version][npm-badge]][npm-url]
[![Security][security-badge]][security-url]
[![CodeQL][codeql-badge]][codeql-url]
[![CI][ci-badge]][ci-url]
[![pnpm][pnpm-badge]][pnpm-url]
[![Node.js][node-badge]][node-url]
[![TypeScript][ts-badge]][ts-url]
[![Maintained by KenkoGeek][maintained-badge]][maintained-url]

Timonel (Spanish for “helmsman”) is a TypeScript library to programmatically
generate Helm charts using cdk8s. Define Kubernetes resources with classes and
synthesize a full Helm chart with `Chart.yaml`, `values.yaml`, per‑environment
values files, and `templates/`.

Key features:

- Type-safe API (strict TypeScript) with cdk8s constructs.
- Helm templating helpers to embed `{{ .Values.* }}` where needed.
- Simple multi-environment setup: `values.yaml`, `values-dev.yaml`, `values-prod.yaml`, etc.
- **Umbrella Charts**: Manage multiple subcharts as a single deployable unit.
- Minimal CLI (`tl`) to scaffold an example and synthesize the chart.

Advanced templating:

- Programmatic Helm helpers: generate `templates/_helpers.tpl` and call helpers using `template()`/`include()`.
- Umbrella chart support with automatic dependency management.

## Installation

### Using npm

```bash
npm install timonel
```

### Development setup

Requirements: Node.js 20+ (Corepack enabled)

```bash
corepack enable
corepack prepare pnpm@latest --activate
pnpm install
pnpm run build
```

### Developer setup (git hooks)

After installing dependencies, enable git hooks with Husky:

```bash
pnpm dlx husky init || npx husky init
```

This sets up pre-commit and commit-msg hooks to run lint-staged and commitlint.
The pre-commit hook also runs Node-based Markdown linting (markdownlint)
automatically.

Markdown commands:

- Lint: `pnpm run md:lint`
- Fix: `pnpm run md:fix`

## Quick start

<!-- markdownlint-disable MD029 -->

1. Create an example project

```bash
tl init my-app-src
```

This generates `charts/my-app-src/chart.ts` with a working example.

2. Synthesize Helm chart artifacts

```bash
tl synth charts/my-app-src charts/my-app/
```

Expected output:

- `charts/my-app/Chart.yaml`
- `charts/my-app/values.yaml`
- `charts/my-app/values-dev.yaml`, `values-prod.yaml` (if defined)
- `charts/my-app/templates/*.yaml`

3. Use with Helm

```bash
helm template charts/my-app -f charts/my-app/values-dev.yaml
helm install my-app charts/my-app -f charts/my-app/values-prod.yaml
```

Note: the output directory (`charts/my-app/` in this example) is overwritten if files
exist. Use a clean folder or move old artifacts before running synth.

### Package the chart (tgz)

Requires Helm installed locally (`helm version`). Packages the chart directory into a
`.tgz` that you can publish or attach to releases:

```bash
tl package charts/my-app charts/
# or set HELM_BIN if helm is not in PATH
HELM_BIN=/usr/local/bin/helm tl package charts/my-app charts/
```

## Library API

```typescript
import { Rutter } from 'timonel';
import {
  valuesRef,
  helm,
  template,
  include,
  numberRef,
  boolRef,
  stringRef,
  floatRef,
} from 'timonel';

const rutter = new Rutter({
  meta: { name: 'my-app', version: '0.1.0', appVersion: '1.0.0' },
  defaultValues: {
    image: { repository: 'nginx', tag: '1.27' },
    replicas: 2,
    service: { port: 80 },
  },
  envValues: { dev: { replicas: 1 }, prod: { replicas: 4 } },
  helpersTpl: [
    {
      name: 'timonel.fullname',
      body: `{{- printf "%s-%s" .Chart.Name .Release.Name | trunc 63 | trimSuffix "-" -}}`,
    },
  ],
  // Custom manifest naming options
  manifestName: 'my-app-resources', // Custom name for manifest files
  singleManifestFile: true, // Combine all resources into one file
});

rutter.addDeployment({
  name: 'my-app',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: 2,
  containerPort: 80,
});

rutter.addService({ name: 'my-app', port: 80 });

// Add auto-scaling with HPA and VPA
rutter.addHorizontalPodAutoscaler({
  name: 'my-app-hpa',
  scaleTargetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'my-app' },
  minReplicas: 1,
  maxReplicas: 10,
});

rutter.addVerticalPodAutoscaler({
  name: 'my-app-vpa',
  targetRef: { apiVersion: 'apps/v1', kind: 'Deployment', name: 'my-app' },
  updatePolicy: { updateMode: 'Auto' },
});

rutter.addPodDisruptionBudget({
  name: 'my-app-pdb',
  minAvailable: 1,
  selector: { matchLabels: { app: 'my-app' } },
});

// Add IRSA ServiceAccount for AWS access
rutter.addAWSIRSAServiceAccount({
  name: 'my-app-irsa',
  roleArn: 'arn:aws:iam::123456789012:role/MyAppRole',
  stsEndpointType: 'regional',
  tokenExpiration: 3600,
});

rutter.write('dist/charts/my-app');
```

### Custom Manifest Naming

> **⚠️ Breaking Change Notice**: Starting from v1.1.0, template files no longer include
> automatic numbering prefixes (0000-, 0001-, etc.). Files now use descriptive names
> following Helm best practices. If your scripts or tools depend on numbered filenames,
> please update them accordingly.

Timonel provides flexible options for naming your Kubernetes manifest files:

#### Single Manifest File

```typescript
const rutter = new Rutter({
  meta: { name: 'my-app', version: '0.1.0' },
  manifestName: 'application',
  singleManifestFile: true, // All resources in one file
});

// Generates: templates/application.yaml
```

#### Separate Files with Custom Names

```typescript
const rutter = new Rutter({
  meta: { name: 'my-app', version: '0.1.0' },
  manifestName: 'my-app',
  singleManifestFile: false, // Each resource in its own file (default)
});

// Generates:
// templates/my-app-deployment-web.yaml
// templates/my-app-service-web.yaml
// templates/my-app-configmap-config.yaml
```

#### Default Behavior

```typescript
const rutter = new Rutter({
  meta: { name: 'my-app', version: '0.1.0' },
  // No manifestName specified
});

// Generates:
// templates/deployment-web.yaml
// templates/service-web.yaml
// templates/configmap-config.yaml
```

## Umbrella Charts

Create umbrella charts that combine multiple subcharts into a single deployable unit:

```typescript
import { createUmbrella, Rutter } from 'timonel';

// Create individual subcharts
const mysql = new Rutter({
  meta: { name: 'mysql', version: '0.1.0' },
  // MySQL configuration...
});

const wordpress = new Rutter({
  meta: { name: 'wordpress', version: '0.1.0' },
  // WordPress configuration...
});

// Combine into umbrella chart
const umbrella = createUmbrella({
  meta: {
    name: 'wordpress-stack',
    version: '1.0.0',
    description: 'Complete WordPress stack with MySQL database',
  },
  subcharts: [
    { name: 'mysql', rutter: mysql },
    { name: 'wordpress', rutter: wordpress },
  ],
  defaultValues: {
    global: { storageClass: 'gp2' },
    mysql: { persistence: { size: '8Gi' } },
    wordpress: { service: { type: 'LoadBalancer' } },
  },
  envValues: {
    dev: { mysql: { persistence: { size: '5Gi' } } },
    prod: { mysql: { persistence: { size: '20Gi' } } },
  },
});

umbrella.write('dist/wordpress-stack');
```

### CLI for Umbrella Charts

```bash
# Create umbrella structure
tl umbrella init my-stack

# Add subcharts
tl umbrella add database
tl umbrella add frontend

# Generate umbrella chart
tl umbrella synth ./dist
```

## Examples

The `examples/` directory contains complete working examples:

- **aws-game-2048**: Production-ready AWS 2048 game deployment showcasing AWS-specific features
  - AWS ALB Ingress with health checks and SSL support
  - HorizontalPodAutoscaler (HPA) for automatic scaling based on CPU utilization
  - PodDisruptionBudget (PDB) for high availability during updates
  - Multi-environment configuration (dev/staging/prod)
- **wordpress**: WordPress with MySQL database setup (single chart)
- **wordpress-umbrella**: WordPress stack using umbrella charts (MySQL + WordPress subcharts)

Each example includes its own README with deployment instructions.

### Umbrella Chart Example

See `examples/wordpress-umbrella/` for a complete umbrella chart implementation that
separates MySQL and WordPress into individual subcharts with proper dependencies,
shared values, and multi-environment support.

- `valuesRef(path)`: returns a Helm placeholder string for `.Values.*`.
- You can pass these strings directly into cdk8s constructs; they are preserved in the YAML.
- `template(name, ctx='.')` and `include(name, ctx='.')`: inject calls to helpers defined in `_helpers.tpl`.
- `numberRef(path)`, `boolRef(path)`: cast `.Values.*` to numeric/boolean using Sprig
  (`int`, `toBool`). Use for template strings, not direct numeric fields.
- `stringRef(path)`, `floatRef(path)`: cast `.Values.*` to string/float using Sprig
  (`toString`, `float64`).
- For numeric fields (ports, replicas), use literal values or template strings with proper casting.

## Multi-Cloud Support

Timonel provides comprehensive cloud-specific helpers for major Kubernetes platforms:

### AWS Multi-Cloud Support

Comprehensive AWS-specific helpers for EKS deployments:

### IRSA (IAM Roles for Service Accounts)

Securely access AWS services from Kubernetes pods using IAM roles:

```typescript
// Dedicated IRSA ServiceAccount
rutter.addAWSIRSAServiceAccount({
  name: 'app-s3-access',
  roleArn: 'arn:aws:iam::123456789012:role/AppS3Role',
  audience: 'sts.amazonaws.com', // optional, defaults to sts.amazonaws.com
  stsEndpointType: 'regional', // recommended for better performance
  tokenExpiration: 3600, // optional, token lifetime in seconds
});

// General ServiceAccount with IRSA support
rutter.addServiceAccount({
  name: 'my-app-sa',
  awsRoleArn: 'arn:aws:iam::123456789012:role/MyAppRole',
  awsStsEndpointType: 'regional',
  awsTokenExpiration: 7200,
  automountServiceAccountToken: true,
});
```

### AWS Storage Classes

```typescript
// EBS GP3 StorageClass
rutter.addAWSEBSStorageClass({
  name: 'fast-ssd',
  volumeType: 'gp3',
  encrypted: true,
  iops: 3000,
  throughput: 125,
});

// EFS StorageClass for shared storage
rutter.addAWSEFSStorageClass({
  name: 'shared-storage',
  reclaimPolicy: 'Retain',
});
```

### AWS Load Balancer Controller

```typescript
// ALB Ingress with health checks
rutter.addAWSALBIngress({
  name: 'app-ingress',
  scheme: 'internet-facing',
  targetType: 'ip',
  healthCheckPath: '/health',
  certificateArn:
    'arn:aws:acm:us-west-2:123456789012:certificate/12345678-1234-1234-1234-123456789012',
  rules: [
    {
      paths: [
        {
          path: '/',
          pathType: 'Prefix',
          backend: { service: { name: 'my-app', port: { number: 80 } } },
        },
      ],
    },
  ],
});
```

### AWS Secrets Manager and Parameter Store

Integrate with AWS Secrets Manager and Parameter Store using the Secrets Store CSI Driver:

```typescript
// Secrets Manager integration
rutter.addAWSSecretProviderClass({
  name: 'app-secrets',
  region: 'us-west-2',
  objects: [
    {
      objectName: 'prod/myapp/database',
      objectType: 'secretsmanager',
      objectAlias: 'db-credentials',
    },
    {
      objectName: 'prod/myapp/api-keys',
      objectType: 'secretsmanager',
      jmesPath: '["api_key", "secret_key"]', // Extract specific keys from JSON
    },
  ],
});

// Parameter Store integration
rutter.addAWSSecretProviderClass({
  name: 'app-config',
  region: 'us-west-2',
  objects: [
    {
      objectName: '/myapp/config/debug-mode',
      objectType: 'ssmparameter',
      objectAlias: 'debug-flag',
    },
    {
      objectName: '/myapp/config/cache-ttl',
      objectType: 'ssmparameter',
      objectAlias: 'cache-timeout',
    },
  ],
});
```

### Azure Multi-Cloud Support

Azure-specific helpers for AKS deployments:

#### Azure Disk Storage Classes

```typescript
// Premium ZRS disk for production workloads
rutter.addAzureDiskStorageClass({
  name: 'azure-premium-zrs',
  skuName: 'Premium_ZRS',
  fsType: 'ext4',
  cachingMode: 'ReadWrite',
  allowVolumeExpansion: true,
  volumeBindingMode: 'WaitForFirstConsumer',
  tags: {
    Environment: 'production',
    Application: 'database',
  },
});

// Standard SSD for cost-optimized workloads
rutter.addAzureDiskStorageClass({
  name: 'azure-standard-ssd',
  skuName: 'StandardSSD_LRS',
  fsType: 'ext4',
  cachingMode: 'ReadOnly',
});

// Ultra SSD for high-performance workloads
rutter.addAzureDiskStorageClass({
  name: 'azure-ultra-ssd',
  skuName: 'UltraSSD_LRS',
  fsType: 'ext4',
  cachingMode: 'None',
  diskIOPSReadWrite: 2000,
  diskMBpsReadWrite: 200,
  logicalSectorSize: 4096,
});
```

#### Azure Application Gateway Ingress Controller (AGIC)

Comprehensive AGIC support for AKS deployments with advanced features:

```typescript
// AGIC Ingress with SSL and health checks
rutter.addAzureAGICIngress({
  name: 'app-ingress',
  rules: [
    {
      host: 'app.example.com',
      paths: [
        {
          path: '/',
          pathType: 'Prefix',
          backend: { service: { name: 'app-service', port: { number: 80 } } },
        },
      ],
    },
  ],
  sslRedirect: true,
  backendProtocol: 'https',
  healthProbePath: '/health',
  healthProbeInterval: 30,
  cookieBasedAffinity: true,
  requestTimeout: 60,
  appgwSslCertificate: 'my-ssl-cert',
  wafPolicyForPath:
    '/subscriptions/sub-id/resourceGroups/rg/providers/Microsoft.Network/applicationGatewayWebApplicationFirewallPolicies/waf-policy',
});

// Advanced AGIC features
rutter.addAzureAGICIngress({
  name: 'advanced-ingress',
  rules: [
    /* rules */
  ],
  backendPathPrefix: '/api/v1',
  backendHostname: 'internal.example.com',
  usePrivateIp: true,
  overrideFrontendPort: 8080,
  connectionDraining: true,
  connectionDrainingTimeout: 60,
  hostnameExtension: ['api.example.com', 'admin.example.com'],
  appgwTrustedRootCertificate: ['root-cert-1', 'root-cert-2'],
  rewriteRuleSet: 'custom-rewrite-rules',
  rulePriority: 100,
});
```

## Network Security with NetworkPolicies

Timonel provides comprehensive NetworkPolicy helpers for implementing Zero Trust network security
in Kubernetes:

### Zero Trust Network Security

Implement defense-in-depth with deny-by-default policies:

```typescript
// 1. Deny all traffic by default (recommended starting point)
rutter.addDenyAllNetworkPolicy('default-deny-all');

// 2. Allow specific traffic as needed
rutter.addAllowFromPodsNetworkPolicy({
  name: 'allow-frontend-to-backend',
  targetPodSelector: { app: 'backend' },
  sourcePodSelector: { app: 'frontend' },
  ports: [{ protocol: 'TCP', port: 8080 }],
});
```

### Advanced NetworkPolicy Examples

#### Multi-tier Application Security

```typescript
// Web tier - allow external traffic on port 80/443
rutter.addNetworkPolicy({
  name: 'web-tier-policy',
  podSelector: { matchLabels: { tier: 'web' } },
  policyTypes: ['Ingress', 'Egress'],
  ingress: [
    {
      ports: [
        { protocol: 'TCP', port: 80 },
        { protocol: 'TCP', port: 443 },
      ],
    },
  ],
  egress: [
    // Allow access to app tier
    {
      to: [{ podSelector: { matchLabels: { tier: 'app' } } }],
      ports: [{ protocol: 'TCP', port: 8080 }],
    },
    // Allow DNS resolution
    {
      to: [{ namespaceSelector: { matchLabels: { name: 'kube-system' } } }],
      ports: [
        { protocol: 'UDP', port: 53 },
        { protocol: 'TCP', port: 53 },
      ],
    },
  ],
});

// App tier - only allow traffic from web tier
rutter.addNetworkPolicy({
  name: 'app-tier-policy',
  podSelector: { matchLabels: { tier: 'app' } },
  policyTypes: ['Ingress', 'Egress'],
  ingress: [
    {
      from: [{ podSelector: { matchLabels: { tier: 'web' } } }],
      ports: [{ protocol: 'TCP', port: 8080 }],
    },
  ],
  egress: [
    // Allow access to database
    {
      to: [{ podSelector: { matchLabels: { tier: 'database' } } }],
      ports: [{ protocol: 'TCP', port: 5432 }],
    },
    // Allow external API calls (with CIDR restrictions)
    {
      to: [
        {
          ipBlock: {
            cidr: '0.0.0.0/0',
            except: ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'],
          },
        },
      ],
      ports: [{ protocol: 'TCP', port: 443 }],
    },
  ],
});

// Database tier - most restrictive
rutter.addNetworkPolicy({
  name: 'database-tier-policy',
  podSelector: { matchLabels: { tier: 'database' } },
  policyTypes: ['Ingress', 'Egress'],
  ingress: [
    {
      from: [{ podSelector: { matchLabels: { tier: 'app' } } }],
      ports: [{ protocol: 'TCP', port: 5432 }],
    },
  ],
  egress: [
    // Only allow DNS resolution
    {
      to: [{ namespaceSelector: { matchLabels: { name: 'kube-system' } } }],
      ports: [
        { protocol: 'UDP', port: 53 },
        { protocol: 'TCP', port: 53 },
      ],
    },
  ],
});
```

#### Cross-Namespace Communication

```typescript
// Allow traffic from monitoring namespace
rutter.addAllowFromNamespaceNetworkPolicy({
  name: 'allow-monitoring',
  targetPodSelector: { app: 'backend' },
  sourceNamespaceSelector: { name: 'monitoring' },
  ports: [{ protocol: 'TCP', port: 9090 }], // Prometheus metrics
});

// Allow traffic to shared services namespace
rutter.addNetworkPolicy({
  name: 'allow-to-shared-services',
  podSelector: { matchLabels: { app: 'backend' } },
  policyTypes: ['Egress'],
  egress: [
    {
      to: [
        {
          namespaceSelector: { matchLabels: { name: 'shared-services' } },
          podSelector: { matchLabels: { app: 'redis' } },
        },
      ],
      ports: [{ protocol: 'TCP', port: 6379 }],
    },
  ],
});
```

### Security Best Practices

#### 1. Start with Deny-All Policies

```typescript
// Always start with deny-all for maximum security
rutter.addDenyAllNetworkPolicy('default-deny-all');

// Then add specific allow rules
rutter.addAllowFromPodsNetworkPolicy({
  name: 'allow-specific-communication',
  targetPodSelector: { app: 'api' },
  sourcePodSelector: { app: 'frontend' },
  ports: [{ protocol: 'TCP', port: 8080 }],
});
```

#### 2. Separate Ingress and Egress Policies

```typescript
// Separate policies for better maintainability
rutter.addDenyAllIngressNetworkPolicy('deny-all-ingress');
rutter.addDenyAllEgressNetworkPolicy('deny-all-egress');
```

#### 3. Use CIDR Blocks for External Access

```typescript
// Restrict external access to specific IP ranges
rutter.addNetworkPolicy({
  name: 'external-api-access',
  podSelector: { matchLabels: { app: 'backend' } },
  policyTypes: ['Egress'],
  egress: [
    {
      to: [
        {
          ipBlock: {
            cidr: '203.0.113.0/24', // Specific external service
          },
        },
      ],
      ports: [{ protocol: 'TCP', port: 443 }],
    },
  ],
});
```

#### 4. Include DNS Resolution

```typescript
// Always allow DNS for name resolution
const dnsEgressRule = {
  to: [{ namespaceSelector: { matchLabels: { name: 'kube-system' } } }],
  ports: [
    { protocol: 'UDP', port: 53 },
    { protocol: 'TCP', port: 53 },
  ],
};

rutter.addNetworkPolicy({
  name: 'app-with-dns',
  podSelector: { matchLabels: { app: 'backend' } },
  policyTypes: ['Egress'],
  egress: [dnsEgressRule /* other rules */],
});
```

### Basic NetworkPolicy

```typescript
// Custom NetworkPolicy with full control
rutter.addNetworkPolicy({
  name: 'custom-policy',
  podSelector: { matchLabels: { app: 'backend' } },
  policyTypes: ['Ingress', 'Egress'],
  ingress: [
    {
      from: [{ podSelector: { matchLabels: { app: 'frontend' } } }],
      ports: [{ protocol: 'TCP', port: 8080 }],
    },
  ],
  egress: [
    {
      to: [{ podSelector: { matchLabels: { app: 'database' } } }],
      ports: [{ protocol: 'TCP', port: 5432 }],
    },
  ],
});
```

## Multi-environment values

Provide `envValues` in the `Rutter` constructor to automatically create
`values-<env>.yaml` files. Each environment file overrides defaults from
`values.yaml`.

## Security

- ESLint security plugin with comprehensive vulnerability detection
- Automated dependency scanning via Dependabot
- Security audit in CI/CD pipeline
- Provenance-enabled npm publishing
- CodeQL analysis for code security

## Notes on cdk8s and Helm templates

- cdk8s synthesizes Kubernetes manifests. Timonel wraps them into a Helm chart
  structure and allows Helm placeholders to appear in string fields (e.g.,
  `{{ .Values.image.tag }}`).
- For advanced templating, Timonel can generate `_helpers.tpl`. Provide `helpersTpl`
  in `Rutter` as a string (verbatim) or as named helpers. Use `template()` or `include()`
  to reference them in your manifests.

## Roadmap

- ✅ Auto-scaling helpers (HPA, VPA, PodDisruptionBudget)
- ✅ AWS multi-cloud support (EBS, EFS, ALB, IRSA, Secrets Manager, Parameter Store)
- ✅ Custom manifest naming and file organization
- ✅ Azure multi-cloud support (Azure Disk StorageClass, AGIC)
- GCP multi-cloud support (GKE-specific helpers)
- Richer CLI (resource generators, diff)
- Template validation and testing utilities

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes following the existing code style
4. Run tests: `pnpm ci:check`
5. Update CHANGELOG.md following [Keep a Changelog](https://keepachangelog.com/) format
6. Commit using conventional commits: `git commit -m 'feat: add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request using the provided template

## Troubleshooting

### Common Issues

#### Error: chart.ts not found

- Ensure you're running `tl synth` from the correct directory
- Verify the chart.ts file exists in the specified path

#### TypeScript compilation errors

- Check Node.js version (requires 20+)
- Run `pnpm install` to ensure dependencies are installed
- Verify TypeScript configuration in tsconfig.json

#### Helm template errors

- Validate YAML syntax in generated templates
- Check Helm values references match your values.yaml structure
- Use `helm template --debug` for detailed error information

## License

MIT

<!-- Badges section -->

[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT
[npm-badge]: https://img.shields.io/npm/v/timonel.svg
[npm-url]: https://www.npmjs.com/package/timonel
[security-badge]: https://img.shields.io/badge/Security-Policy-2ea44f?logo=security&logoColor=fff
[security-url]: SECURITY.md
[pnpm-badge]: https://img.shields.io/badge/pm-pnpm-ffd95a?logo=pnpm&logoColor=fff&labelColor=24292e
[pnpm-url]: https://pnpm.io/
[node-badge]: https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=fff
[node-url]: https://nodejs.org/
[ts-badge]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=fff
[ts-url]: https://www.typescriptlang.org/
[maintained-badge]: https://img.shields.io/badge/maintained%20by-KenkoGeek-6C78AF?style=flat
[maintained-url]: https://github.com/kenkogeek/
[ci-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/ci.yml/badge.svg?branch=main
[ci-url]: https://github.com/KenkoGeek/timonel/actions/workflows/ci.yml
[codeql-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml/badge.svg
[codeql-url]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml
