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

Timonel (Spanish for "helmsman") is a TypeScript library to programmatically generate Helm charts
using cdk8s. Define Kubernetes resources with classes and synthesize a full Helm chart with
`Chart.yaml`, `values.yaml`, per‑environment values files, and `templates/`.

## ✨ Key Features

- **Type-safe API** with strict TypeScript and cdk8s constructs
- **Multi-environment support** with automatic values files generation
- **Umbrella Charts** for managing multiple subcharts as a single unit
- **Complete multi-cloud integrations** for AWS, Azure, and GCP
  - **Azure**: Disk/Files StorageClass, AGIC Ingress, Key Vault, ACR ServiceAccount
  - **GCP**: Filestore StorageClass, GCE Ingress, Artifact Registry ServiceAccount
  - **AWS**: EBS/EFS StorageClass, ALB Ingress, IRSA ServiceAccount
- **Security-first approach** with NetworkPolicies and best practices
- **Minimal CLI** (`tl`) for scaffolding and chart generation
- **100% backward compatibility** with all existing methods

## 🚀 Quick Start

```bash
# Install Timonel globally
npm install -g timonel

# Create your first chart
tl init my-app

# Generate Helm chart
tl synth charts/my-app charts/my-app-dist

# Use with Helm
helm install my-app charts/my-app-dist
```

## 📚 Documentation

For comprehensive documentation, examples, and guides, visit our **[Wiki](https://github.com/KenkoGeek/timonel/wiki)**:

- **[Installation](https://github.com/KenkoGeek/timonel/wiki/Installation)** - Setup and requirements
- **[Quick Start](https://github.com/KenkoGeek/timonel/wiki/Quick-Start)** - Your first chart in 5 minutes
- **[Examples](https://github.com/KenkoGeek/timonel/wiki/Examples)** - Real-world deployment patterns
- **[Multi-Cloud Support](https://github.com/KenkoGeek/timonel/wiki/Multi-Cloud-Support)** - AWS,
  Azure, GCP integrations
- **[CLI Reference](https://github.com/KenkoGeek/timonel/wiki/CLI-Commands)** - Complete command guide

## 💡 Basic Example

```typescript
import { Rutter } from 'timonel';
import { valuesRef } from 'timonel';

const rutter = new Rutter({
  meta: { name: 'my-app', version: '0.1.0' },
  defaultValues: {
    image: { repository: 'nginx', tag: '1.27' },
    replicas: 2,
  },
  envValues: {
    dev: { replicas: 1 },
    prod: { replicas: 5 },
  },
});

rutter.addDeployment({
  name: 'my-app',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: Number(valuesRef('replicas')),
  containerPort: 80,
});

rutter.addService({ name: 'my-app', port: 80 });

export default function run(outDir: string) {
  rutter.write(outDir);
}
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
[ci-url]: https://github.com/KenkoGeek/timonel/actions/workflows/teast.yaml
[codeql-badge]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yaml/badge.svg
[codeql-url]: https://github.com/KenkoGeek/timonel/actions/workflows/codeql.yaml
