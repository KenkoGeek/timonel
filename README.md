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

**⚠️ Use ValuesRef instead:**

- `valuesRef(path)` → use `v.path`
- `stringRef()` → use `v.quote()`
- `defaultRef()` → use `v.default()`
- `jsonRef()` → use `v.toJson()`
- `conditionalRef()` → use `v.if()`
- `helmIf`, `helmIfSimple` → use `v.if()`
- `helmRange` → use `v.range()`
- `helmWith` → use `v.with()`
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

**⚠️ These are legacy and NOT RECOMMENDED. Use ValuesRef system instead:**

```typescript
// ❌ OLD WAY - helmIf, helmRange, helmWith (string-based, no type safety)
const config = helmIf('.Values.production', { replicas: 5 }, { replicas: 1 });

// ✅ NEW WAY - v.if(), v.range(), v.with() (type-safe with ValuesRef)
const v = valuesRef<MyValues>();
const config = v.if(v.production, { replicas: 5 });
```

**Why ValuesRef is Better:**

- ✅ **100% Type-Safe** - Catch errors at compile time with TypeScript generics
- ✅ **No Raw Strings** - Eliminate manual template interpolation and typos
- ✅ **Full IDE Support** - Autocomplete, type hints, and refactoring support
- ✅ **Proxy-based** - Chainable methods for complex logic
- ✅ **Composable** - Nest and combine operations naturally
- ❌ **Legacy helpers** - String-based, error-prone, no IDE support

**Migration:** Replace `helmIf`, `helmRange`, `helmWith` with `v.if()`, `v.range()`, `v.with()`

**Learn more:** See the
[Type-Safe Helm Helpers Guide](https://github.com/KenkoGeek/timonel/wiki/Helm-Helpers-System) for
complete documentation, examples, and best practices.

## 📚 Documentation

- **[API Reference](https://github.com/KenkoGeek/timonel/wiki/API-Reference)** - Complete API
  documentation
- **[CLI Reference](https://github.com/KenkoGeek/timonel/wiki/CLI-Reference)** - Command-line
  interface guide
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
