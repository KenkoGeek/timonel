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

- **🔒 Type-safe API** with strict TypeScript and cdk8s constructs
- **🔧 Flexible resource creation** with built-in methods and `addManifest()` for custom resources
- **🌍 Multi-environment support** with automatic values files generation
- **☂️ Umbrella Charts** for managing multiple subcharts as a single unit
- **🛠️ Enhanced Helm Helpers** with environment, GitOps, observability, and validation helpers
- **☁️ Cloud integrations**:
  - **AWS**: EBS/EFS StorageClass, ALB Ingress, IRSA ServiceAccount, ECR, and Karpenter
- **🛡️ Security-first approach** with NetworkPolicies and best practices
- **⚡ Minimal CLI** (`tl`) for scaffolding and chart generation
- **📦 Flexible subchart templates** supporting cdk8s and cdk8s-plus-33

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
import { Chart } from 'cdk8s';
import { Deployment, Service } from 'cdk8s-plus-33';

export class WebAppChart extends Chart {
  constructor(scope: Chart, id: string) {
    super(scope, id);

    // Create deployment
    new Deployment(this, 'web-deployment', {
      containers: [
        {
          image: 'nginx:latest',
          port: 80,
          env: {
            NGINX_PORT: '80',
          },
        },
      ],
    });

    // Create service
    new Service(this, 'web-service', {
      selector: { app: 'web' },
      ports: [{ port: 80, targetPort: 80 }],
    });
  }
}
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
    "cdk8s": "^2.70.16",
    "cdk8s-plus-33": "^2.3.8",
    "constructs": "^10.4.2",
    "timonel": "^2.11.0"
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
[node-badge]: https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=fff
[node-url]: https://nodejs.org/
[ts-badge]: https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=fff
[ts-url]: https://www.typescriptlang.org/
[maintained-badge]: https://img.shields.io/badge/maintained%20by-KenkoGeek-6C78AF?style=flat
[maintained-url]: https://github.com/kenkogeek/
[ci-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/test.yaml/badge.svg?branch=main
[ci-url]: https://github.com/KenkoGeek/timonel/actions/workflows/test.yaml
[codeql-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml/badge.svg
[codeql-url]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yml
