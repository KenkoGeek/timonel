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

**Timonel** (Spanish for "helmsman") is a powerful TypeScript library that programmatically generates
Helm charts using cdk8s. Define Kubernetes resources with type-safe classes and synthesize complete
Helm charts with `Chart.yaml`, `values.yaml`, environment-specific values files, and `templates/`
directory.

## ✨ Key Features

### Core Capabilities

- **🔒 Type-safe API** with strict TypeScript and cdk8s constructs
- **🔧 Flexible resource creation** with built-in methods and `addManifest()` for custom resources
- **🌍 Multi-environment support** with automatic values files generation
- **☂️ Umbrella Charts** for managing multiple subcharts as a single unit
- **⚡ Minimal CLI** (`tl`) for scaffolding, synthesis, validation, and deployment
- **📦 Flexible subchart templates** supporting both cdk8s and cdk8s-plus-33

### Type-Safe Helm Helpers (v3.0+)

#### ValuesRef System (NEW in v3.0 - RECOMMENDED)

Type-safe proxy-based values references with full IDE support:

- Import: `import { valuesRef } from 'timonel'`
- **Comparison operators**: `eq`, `ne`, `gt`, `ge`, `lt`, `le`
- **Logical operators**: `not`, `and`, `or`
- **String functions**: `quote`, `upper`, `lower`, `trim`, `replace`, `contains`
- **Default values**: `default()`
- **Type checking**: `kindIs`, `hasKey`
- **YAML functions**: `toYaml`, `toJson`, `nindent`, `indent`
- **Field-level conditionals**: `v.if()`, `v.ifElse()` - Complex conditional logic
- **Range loops**: `v.range()` - Type-safe iteration
- **Context switching**: `v.with()` - Scoped value access

#### Composable Helpers

Template definition and inclusion helpers:

- `helmInclude`, `helmDefine`, `helmVar`, `helmBlock`, `helmComment`, `helmFragment`
- `template`, `include`, `quote`, `indent`

#### Value Reference Helpers

Useful string-based utilities (no ValuesRef equivalent):

- `requiredValuesRef` - Required value with validation
- `numberRef`, `boolRef`, `floatRef` - Type-cast references (int, bool, float64)
- `base64Ref` - Base64 encoding

#### Legacy Helpers (NOT RECOMMENDED)

**⚠️ Use ValuesRef system instead:**

- `valuesRef(path)` → use `v.path` (ValuesRef system)
- `stringRef()` → use `v.quote()` (ValuesRef system)
- `defaultRef()` → use `v.default()` (ValuesRef system)
- `jsonRef()` → use `v.toJson()` (ValuesRef system)
- `conditionalRef()` → use `v.if()` (ValuesRef system)
- `helmIf`, `helmIfSimple` → use `v.if()` (ValuesRef system)
- `helmRange` → use `v.range()` (ValuesRef system)
- `helmWith` → use `v.with()` (ValuesRef system)
- `helmIfElseIf` → use `v.if()` with nested conditions

### Enhanced Helm Helpers

- **Environment Helpers**: `envRef`, `envDefault`, `envRequired`, `envFromSecret`, `envFromConfigMap`
- **GitOps Helpers**: `gitBranch`, `gitCommit`, `gitTag`, `gitopsAnnotations`
- **Observability Helpers**: `prometheusAnnotations`, `datadogAnnotations`, `tracingAnnotations`
- **Validation Helpers**: `validateRequired`, `validatePattern`, `validateRange`, `validateEnum`
- **Standard Helpers**: 40+ built-in Helm helpers (chart.name, chart.fullname, chart.labels, etc.)

### Cloud Integrations

- **AWS Resources**:
  - EBS/EFS StorageClass with encryption and performance options
  - ALB Ingress with SSL/TLS and health checks
  - IRSA ServiceAccount for pod-level IAM roles
  - ECR integration
  - Karpenter NodePool, NodeClaim, and EC2NodeClass
- **Karpenter Features**:
  - Disruption budgets and consolidation policies
  - Instance type selection and requirements
  - Spot instance support
  - Custom AMI and user data

### Security & Validation

- **🛡️ Security-first approach**:
  - Input validation (CWE-20, CWE-22/23)
  - Path traversal prevention
  - Command injection prevention (CWE-78/77/88)
  - Log injection protection (CWE-117)
  - Code injection prevention (CWE-94)
- **🔍 Policy Engine** (NEW):
  - Extensible validation framework for Kubernetes manifests
  - Plugin-based architecture for custom policy rules
  - Zero-impact integration (completely optional)
  - Support for security, compliance, and best practice policies
- **NetworkPolicy support** for pod-level network isolation
- **Helm chart validation** with `validateHelmYaml`
- **SecurityUtils** for path validation and sanitization

### Developer Experience

- **Structured logging** with Pino (JSON format, performance tracking)
- **Environment variables loader** for external configuration
- **YAML serialization** with Helm template preservation
- **TypeScript strict mode** with all compiler checks enabled
- **Comprehensive error handling** with detailed messages

## 🚀 Quick Start

### Installation

```bash
# Install Timonel globally
npm install -g timonel

# Or use with pnpm
pnpm add -g timonel
```

### Basic Usage

```bash
# Create your first chart
tl init my-app

# Generate Helm chart
tl synth my-app my-app-dist

# Use with Helm
helm install my-app my-app-dist
```

### Umbrella Charts

```bash
# Create umbrella chart structure
tl umbrella init my-umbrella-app

# Add subcharts
tl umbrella add frontend
tl umbrella add backend

# Generate umbrella chart
tl umbrella synth
```

## 💡 Examples

### Simple Web Application

```typescript
import { Rutter, helmInclude, createHelmExpression as helm } from 'timonel';

const chart = new Rutter({
  meta: {
    name: 'web-app',
    version: '1.0.0',
    description: 'Simple web application',
  },
  defaultValues: {
    replicas: 3,
    image: {
      repository: 'nginx',
      tag: 'latest',
    },
  },
});

// Add Deployment with type-safe helpers
chart.addManifest(
  {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: helmInclude('chart.fullname', '.'),
      labels: helmInclude('chart.labels', '.', { pipe: 'nindent 4' }),
    },
    spec: {
      replicas: helm('{{ .Values.replicas }}'),
      selector: {
        matchLabels: helmInclude('chart.selectorLabels', '.', { pipe: 'nindent 6' }),
      },
      template: {
        metadata: {
          labels: helmInclude('chart.selectorLabels', '.', { pipe: 'nindent 8' }),
        },
        spec: {
          containers: [
            {
              name: 'web',
              image: helm('{{ .Values.image.repository }}:{{ .Values.image.tag }}'),
              ports: [{ containerPort: 80, name: 'http' }],
            },
          ],
        },
      },
    },
  },
  'deployment',
);

// Generate the chart
chart.write('./dist');
```

### Policy Engine Integration

```typescript
import { Rutter, PolicyEngine } from 'timonel';
import { securityPolicies } from '@mycompany/k8s-security-policies';

// Create policy engine with custom plugins
const policyEngine = new PolicyEngine().use(securityPolicies).configure({
  timeout: 5000,
  parallel: true,
});

const chart = new Rutter({
  meta: {
    name: 'secure-app',
    version: '1.0.0',
  },
  // Optional policy validation
  policyEngine,
});

// Policies validate manifests before chart generation
chart.write('./dist'); // Fails if policy violations found
```

### Creating Custom Policy Plugins

```typescript
import { PolicyPlugin, PolicyViolation } from 'timonel';

export const mySecurityPolicy: PolicyPlugin = {
  name: 'my-security-policy',
  version: '1.0.0',
  description: 'Custom security validation rules',

  async validate(manifests, context) {
    const violations: PolicyViolation[] = [];

    for (const manifest of manifests) {
      if (manifest.kind === 'Deployment') {
        // Check for security context
        if (!manifest.spec?.template?.spec?.securityContext) {
          violations.push({
            plugin: this.name,
            severity: 'error',
            message: 'Deployment must specify securityContext',
            resourcePath: `${manifest.kind}/${manifest.metadata?.name}`,
            suggestion: 'Add spec.template.spec.securityContext to your Deployment',
          });
        }
      }
    }

    return violations;
  },
};
```

### Umbrella Chart with Multiple Services

```typescript
import { UmbrellaChartTemplate } from 'timonel';

const umbrellaConfig = {
  name: 'my-umbrella-app',
  version: '1.0.0',
  subcharts: [
    {
      name: 'frontend',
      version: '1.0.0',
      chart: frontendChartFunction,
    },
    {
      name: 'backend',
      version: '1.0.0',
      chart: backendChartFunction,
    },
  ],
};

export const umbrella = new UmbrellaChartTemplate(umbrellaConfig);
```

### Using Type-Safe Helm Helpers

#### ValuesRef System (Recommended)

The new ValuesRef system provides a type-safe, proxy-based approach to Helm values with full IDE support.

**⚠️ Important:** This is completely different from the legacy `valuesRef(path: string)` helper.
The new system uses generics and returns a proxy object with methods.

```typescript
import { valuesRef } from 'timonel';

interface MyValues {
  replicaCount: number;
  image: { repository: string; tag: string };
  autoscaling: { enabled: boolean; minReplicas: number };
}

const v = valuesRef<MyValues>();

// Type-safe value references with IDE autocomplete
const replicas = v.replicaCount; // {{ .Values.replicaCount }}
const imageTag = v.image.tag; // {{ .Values.image.tag }}

// Comparison operators
const isProd = v.environment.eq('production'); // eq .Values.environment "production"
const hasReplicas = v.replicaCount.gt(1); // gt .Values.replicaCount 1

// Logical operators
const notEnabled = v.autoscaling.enabled.not(); // not .Values.autoscaling.enabled

// String functions
const upperEnv = v.environment.upper(); // .Values.environment | upper
const quotedTag = v.image.tag.quote(); // .Values.image.tag | quote

// Default values
const port = v.port.default(8080); // {{ .Values.port | default 8080 }}

// Field-level conditionals
const deployment = {
  spec: {
    replicas: v.if(notEnabled, v.replicaCount), // Conditionally include field
  },
};

// Range loops
const envVars = v.env.range((item, index) => ({
  name: item.name,
  value: item.value,
}));

// Context switching
const dbConfig = v.database.with((db) => ({
  host: db.host,
  port: db.port,
}));
```

#### Template Composition Helpers

Use these helpers for template definitions and inclusions:

```typescript
import { helmInclude, helmDefine, helmFragment } from 'timonel';

// Template inclusion with pipe
const labels = helmInclude('chart.labels', '.', { pipe: 'nindent 4' });

// Define a named template
const myTemplate = helmDefine('myapp.config', {
  key: 'value',
});

// Combine multiple constructs
const combined = helmFragment(helmInclude('chart.labels', '.'), { customKey: 'customValue' });
```

#### Legacy Flow Control (NOT RECOMMENDED)

**⚠️ These are legacy and NOT RECOMMENDED. Use ValuesRef system (v.if, v.range, v.with)
instead:**

```typescript
// ❌ OLD WAY - string-based valuesRef (no type safety)
const oldRef = valuesRef('.Values.production');

// ✅ NEW WAY - ValuesRef system (type-safe)
const v = valuesRef<MyValues>();
const newRef = v.production; // {{ .Values.production }}

// ❌ OLD WAY - helmIf, helmRange, helmWith (string-based)
const config = helmIf('.Values.production', { replicas: 5 }, { replicas: 1 });

// ✅ NEW WAY - v.if(), v.range(), v.with() (type-safe)
const config = v.if(v.production, { replicas: 5 });
```

**Why ValuesRef is Better:**

- ✅ **100% Type-Safe** - Catch errors at compile time with TypeScript generics
- ✅ **No Raw Strings** - Eliminate manual template interpolation and typos
- ✅ **Full IDE Support** - Autocomplete, type hints, and refactoring support
- ✅ **Proxy-based** - Chainable methods for complex logic
- ✅ **Composable** - Nest and combine operations naturally
- ❌ **Legacy helpers** - String-based, error-prone, no IDE support

**Migration:** Replace `valuesRef(path)` with `v.path`. Replace `helmIf`, `helmRange`, `helmWith`
with `v.if()`, `v.range()`, `v.with()`.

**Learn more:** See the
[Type-Safe Helm Helpers Guide](https://github.com/KenkoGeek/timonel/wiki/Helm-Helpers-System) for
complete documentation, examples, and best practices.

## 🔍 Policy Engine

The Policy Engine provides extensible validation for Kubernetes manifests through a
plugin-based architecture. It's completely optional and has zero impact on existing users.

### Key Features

- **🔌 Plugin Architecture**: Extensible through external npm packages
- **⚡ Zero Impact**: Completely optional with no performance overhead when unused
- **🛡️ Security Focus**: Built-in support for security and compliance policies
- **🔄 Async Support**: Handles both synchronous and asynchronous validation plugins
- **📊 Rich Reporting**: Detailed violation reports with suggestions and context
- **⏱️ Timeout Protection**: Configurable timeouts prevent hanging validations
- **🔧 Configurable**: Environment-specific policy configuration support
- **🚀 Performance Optimized**: Parallel execution, caching, and resource monitoring
- **🔄 Error Resilience**: Graceful degradation and retry mechanisms
- **📈 Observability**: Structured logging and performance metrics

### Quick Start

```typescript
import { Rutter, PolicyEngine } from 'timonel';

// Optional: Add policy validation
const policyEngine = new PolicyEngine({
  timeout: 10000,
  parallel: true,
  gracefulDegradation: true,
});

// Register plugins
await policyEngine.use(await import('@mycompany/security-policies'));
await policyEngine.use(await import('@kubernetes/best-practices'));

const chart = new Rutter({
  meta: { name: 'my-app', version: '1.0.0' },
  policyEngine, // ← Completely optional
});

chart.write('./dist'); // Validates before writing
```

### Available Policy Plugins

**Built-in Examples:**

- **Security Plugin** - Comprehensive security validation (security contexts, RBAC, network policies)
- **Best Practices Plugin** - Kubernetes best practices (resource limits, naming, probes)
- **AWS Plugin** - AWS-specific validations (EKS, ALB, IRSA, cost optimization)

**Community Plugins:**

- `@kubernetes/pod-security-standards` - Official Kubernetes PSS validation
- `@open-policy-agent/timonel-plugin` - OPA Rego policy integration
- `@falco/security-policies` - Falco runtime security rules

**Enterprise Plugins:**

- `@company/compliance-policies` - Organization-specific compliance rules
- `@aws/well-architected-policies` - AWS Well-Architected Framework validation
- `@security/cis-benchmarks` - CIS Kubernetes Benchmark validation

### Creating Custom Policies

```typescript
import { PolicyPlugin, PolicyViolation, ValidationContext } from 'timonel';

export const customSecurityPolicy: PolicyPlugin = {
  name: 'custom-security-policy',
  version: '1.0.0',
  description: 'Custom security validation rules',

  // Optional: Configuration schema for validation
  configSchema: {
    type: 'object',
    properties: {
      strictMode: { type: 'boolean', default: false },
      allowedNamespaces: { type: 'array', items: { type: 'string' } },
    },
  },

  async validate(manifests: unknown[], context: ValidationContext): Promise<PolicyViolation[]> {
    const violations: PolicyViolation[] = [];
    const config = context.config as { strictMode?: boolean; allowedNamespaces?: string[] };

    for (const manifest of manifests) {
      if (manifest.kind === 'Deployment') {
        // Validate security context
        if (!manifest.spec?.template?.spec?.securityContext) {
          violations.push({
            plugin: this.name,
            severity: config?.strictMode ? 'error' : 'warning',
            message: 'Deployment should specify securityContext',
            resourcePath: `${manifest.kind}/${manifest.metadata?.name}`,
            field: 'spec.template.spec.securityContext',
            suggestion: 'Add securityContext with runAsNonRoot: true',
            context: {
              kubernetesVersion: context.kubernetesVersion,
              environment: context.environment,
            },
          });
        }

        // Validate namespace restrictions
        const namespace = manifest.metadata?.namespace || 'default';
        if (config?.allowedNamespaces && !config.allowedNamespaces.includes(namespace)) {
          violations.push({
            plugin: this.name,
            severity: 'error',
            message: `Deployment in unauthorized namespace: ${namespace}`,
            resourcePath: `${manifest.kind}/${manifest.metadata?.name}`,
            field: 'metadata.namespace',
            suggestion: `Deploy to allowed namespaces: ${config.allowedNamespaces.join(', ')}`,
          });
        }
      }
    }

    return violations;
  },
};
```

### Advanced Configuration

```typescript
const policyEngine = new PolicyEngine({
  // Execution settings
  timeout: 15000, // 15 second timeout per plugin
  parallel: true, // Run plugins in parallel for better performance
  failFast: false, // Collect all violations before failing
  gracefulDegradation: true, // Continue on plugin failures

  // Performance optimization
  cacheOptions: {
    maxSize: 1000, // Cache up to 1000 validation results
    ttl: 300000, // 5 minute cache TTL
    enableStats: true, // Enable cache performance monitoring
  },

  // Parallel execution tuning
  parallelOptions: {
    maxConcurrency: 4, // Run up to 4 plugins concurrently
    enableResourceMonitoring: true,
  },

  // Retry configuration
  retryConfig: {
    maxAttempts: 3,
    baseDelay: 1000,
    retryOnTimeout: true,
    retryOnPluginError: false,
  },

  // Plugin-specific configuration
  pluginConfig: {
    'security-plugin': {
      strictMode: true,
      allowedNamespaces: ['default', 'kube-system'],
      securityContext: {
        required: true,
        runAsNonRoot: true,
      },
    },
    'best-practices-plugin': {
      enforceResourceLimits: true,
      requireLabels: ['app', 'version', 'environment'],
      maxReplicas: 50,
    },
    'aws-plugin': {
      region: 'us-west-2',
      enforceTagging: true,
      costOptimization: {
        enabled: true,
        maxInstanceSize: 'xlarge',
      },
    },
  },
});

// Register plugins
await policyEngine.use(securityPolicies);
await policyEngine.use(bestPracticesPolicies);
await policyEngine.use(awsPolicies);
```

### Environment-Specific Policies

```typescript
// Load different policies based on environment
const createPolicyEngine = (environment: string) => {
  const engine = new PolicyEngine({
    environment,
    configurationLoader: {
      configurationFiles: ['config/policy-engine.json', `config/environments/${environment}.json`],
    },
  });

  // Base security policies for all environments
  await engine.use(baseSecurity);

  // Environment-specific policies
  switch (environment) {
    case 'production':
      await engine.use(strictSecurity);
      await engine.use(compliancePolicies);
      await engine.use(awsPolicies);
      break;
    case 'staging':
      await engine.use(moderateSecurity);
      await engine.use(awsPolicies);
      break;
    case 'development':
      // Minimal policies for development
      await engine.use(basicSecurity);
      break;
  }

  return engine;
};
```

### Integration with CI/CD

```typescript
// In your CI/CD pipeline
import { Rutter, PolicyEngine, PolicyEngineError } from 'timonel';

const validateChart = async (chartPath: string, environment: string) => {
  const policyEngine = await createPolicyEngine(environment);

  try {
    const chart = new Rutter({
      meta: { name: 'my-app', version: process.env.VERSION },
      policyEngine,
    });

    await chart.write(chartPath);

    // Log validation success with metrics
    const stats = policyEngine.getCacheStats();
    console.log('✅ Chart validation passed', {
      environment,
      cacheHitRate: stats.hitRate,
      pluginCount: policyEngine.getPluginCount(),
    });
  } catch (error) {
    if (error instanceof PolicyEngineError) {
      console.error('❌ Policy violations found:');

      // Group violations by severity
      const errors = error.violations.filter((v) => v.severity === 'error');
      const warnings = error.violations.filter((v) => v.severity === 'warning');

      if (errors.length > 0) {
        console.error(`\n🚨 Errors (${errors.length}):`);
        errors.forEach((v) => {
          console.error(`  • ${v.resourcePath}: ${v.message}`);
          if (v.suggestion) {
            console.error(`    💡 ${v.suggestion}`);
          }
        });
      }

      if (warnings.length > 0) {
        console.warn(`\n⚠️  Warnings (${warnings.length}):`);
        warnings.forEach((v) => {
          console.warn(`  • ${v.resourcePath}: ${v.message}`);
        });
      }

      // Fail CI/CD on errors, but allow warnings
      if (errors.length > 0) {
        process.exit(1);
      }
    } else {
      throw error;
    }
  }
};

// Usage in GitHub Actions, GitLab CI, etc.
await validateChart('./dist', process.env.ENVIRONMENT || 'development');
```

### Plugin Ecosystem

The Policy Engine supports a rich ecosystem of plugins for various use cases:

#### Security & Compliance

- **Pod Security Standards** - Kubernetes PSS validation
- **CIS Benchmarks** - Center for Internet Security benchmarks
- **NIST Framework** - NIST Cybersecurity Framework compliance
- **PCI DSS** - Payment Card Industry compliance
- **SOC 2** - Service Organization Control 2 compliance

#### Cloud Provider Integrations

- **AWS Well-Architected** - AWS best practices and cost optimization
- **Azure Security Center** - Azure-specific security policies
- **GCP Security Command Center** - Google Cloud security validation

#### Development & Operations

- **GitOps Policies** - GitOps workflow validation
- **Resource Optimization** - Cost and performance optimization
- **Observability** - Monitoring and logging best practices
- **Backup & Recovery** - Data protection policies

#### Creating Plugin Packages

```typescript
// package.json for a policy plugin
{
  "name": "@mycompany/k8s-security-policies",
  "version": "1.0.0",
  "description": "Security policies for Kubernetes manifests",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["timonel", "policy", "security", "kubernetes"],
  "peerDependencies": {
    "timonel": "^3.0.0"
  }
}

// src/index.ts
export { SecurityPlugin } from './security-plugin.js';
export { CompliancePlugin } from './compliance-plugin.js';
export type { SecurityConfig, ComplianceConfig } from './types.js';
```

### Performance & Monitoring

The Policy Engine includes comprehensive performance monitoring:

```typescript
// Monitor policy engine performance
const result = await policyEngine.validate(manifests);

console.log('Validation Performance:', {
  executionTime: result.metadata.executionTime,
  pluginCount: result.metadata.pluginCount,
  manifestCount: result.metadata.manifestCount,
  violationsFound: result.violations.length,
});

// Cache performance monitoring
const cacheStats = policyEngine.getCacheStats();
console.log('Cache Performance:', {
  hitRate: cacheStats.hitRate,
  totalHits: cacheStats.hits,
  totalMisses: cacheStats.misses,
  cacheSize: cacheStats.size,
});

// Clear cache when needed
policyEngine.invalidateCache({ all: true });
```

## 📚 Documentation

- **[API Reference](https://github.com/KenkoGeek/timonel/wiki/API-Reference)** - Complete API
  documentation
- **[CLI Reference](https://github.com/KenkoGeek/timonel/wiki/CLI-Reference)** - Command-line
  interface guide
- **[Policy Engine Guide](https://github.com/KenkoGeek/timonel/wiki/Policy-Engine)** -
  Policy validation and plugin development
- **[Plugin Development Guide](https://github.com/KenkoGeek/timonel/wiki/Plugin-Development)** -
  Creating custom policy plugins
- **[Configuration Reference](https://github.com/KenkoGeek/timonel/wiki/Policy-Configuration)** -
  Policy engine configuration options
- **[Policy Examples](https://github.com/KenkoGeek/timonel/wiki/Policy-Examples)** - Example plugins
  and usage patterns
- **[Examples](https://github.com/KenkoGeek/timonel/wiki/Examples)** - Real-world usage examples
- **[Best Practices](https://github.com/KenkoGeek/timonel/wiki/Best-Practices)** - Recommended
  patterns and practices
- **[Contributing](https://github.com/KenkoGeek/timonel/wiki/Contributing)** - Development setup
  and guidelines
- **[Timonel Examples Repository](https://github.com/KenkoGeek/timonel-examples)** - Curated
  collection of ready-to-run Timonel sample projects

## 🔧 Troubleshooting

### CDK8s Module Not Found Error

If you get `Error: Cannot find module 'cdk8s'` when running `tl umbrella synth`:

**Problem**: Timonel is installed globally, but your project needs CDK8s dependencies locally.

**Solution**: Create a `package.json` in your project directory:

```json
{
  "name": "my-timonel-project",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "cdk8s": "^2.70.28",
    "cdk8s-plus-33": "^2.4.6",
    "constructs": "^10.4.3",
    "timonel": "^3.0.0-beta.1"
  },
  "devDependencies": {
    "@types/node": "^24.5.2",
    "typescript": "^5.9.2"
  }
}
```

Then run:

```bash
npm install
tl umbrella synth  # Now it works!
```

## 🤝 Contributing

See our [Contributing Guide](https://github.com/KenkoGeek/timonel/wiki/Contributing) for development
setup and guidelines.

## 📄 License

MIT

<!-- Badges -->

[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT
[npm-badge]: https://img.shields.io/npm/v/timonel.svg
[npm-url]: https://www.npmjs.com/package/timonel
[security-badge]: https://img.shields.io/badge/Security-Policy-2ea44f?logo=security&logoColor=fff
[security-url]: SECURITY.md
[pnpm-badge]: https://img.shields.io/badge/pm-pnpm-ffd95a?logo=pnpm&logoColor=fff&labelColor=24292e
[pnpm-url]: https://pnpm.io/
[node-badge]: https://img.shields.io/badge/node-%3E%3D22-339933?logo=node.js&logoColor=fff
[node-url]: https://nodejs.org/
[ts-badge]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=fff
[ts-url]: https://www.typescriptlang.org/
[maintained-badge]: https://img.shields.io/badge/maintained%20by-KenkoGeek-6C78AF?style=flat
[maintained-url]: https://github.com/kenkogeek/
[ci-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/test.yaml/badge.svg?branch=main
[ci-url]: https://github.com/KenkoGeek/timonel/actions/workflows/test.yaml
[codeql-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml/badge.svg
[codeql-url]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml
