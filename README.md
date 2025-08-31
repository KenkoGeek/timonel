# Timonel

[![License: MIT][license-badge]][license-url]
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
- Minimal CLI to scaffold an example and synthesize the chart.

Advanced templating:

- Programmatic Helm helpers: generate `templates/_helpers.tpl` and call helpers using `template()`/`include()`.

## Installation

- Requirements: Node.js 20+ (Corepack enabled)
- Install dependencies and build with your preferred package manager:

Using pnpm

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

## Quick start (local)

1. Create an example project

```bash
timonel init my-app-src
```

This generates `charts/my-app-src/chart.ts` with a working example.

1. Synthesize Helm chart artifacts (separate src and chart dirs)

```bash
timonel synth charts/my-app-src charts/my-app/
```

Expected output:

- `charts/my-app/Chart.yaml`
- `charts/my-app/values.yaml`
- `charts/my-app/values-dev.yaml`, `values-prod.yaml` (if defined)
- `charts/my-app/templates/*.yaml`

1. Use with Helm

```bash
helm template charts/my-app -f charts/my-app/values-dev.yaml
helm install my-app charts/my-app -f charts/my-app/values-prod.yaml
```

Note: the output directory (`charts/my-app/` in this example) is overwritten if files
exist. Use a clean folder or move old artifacts before running synth.

## Library API

```typescript
import { ChartFactory } from 'timonel';
import {
  valuesRef,
  helm,
  template,
  include,
  numberRef,
  boolRef,
  stringRef,
  floatRef,
} from 'timonel/lib/helm';

const factory = new ChartFactory({
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
});

factory.addDeployment({
  name: 'my-app',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: numberRef('replicas') as any,
  containerPort: 80,
});

factory.addService({ name: 'my-app', port: numberRef('service.port') as any });

// Use a named helper in annotations (example)
factory.addDeployment({
  name: 'annotated',
  image: 'nginx',
  containerPort: 80,
  env: {
    FULLNAME: include('timonel.fullname'),
  },
});

factory.write('dist/charts/my-app');
```

- `valuesRef(path)`: returns a Helm placeholder string for `.Values.*`.
- You can pass these strings directly into cdk8s constructs; they are preserved in the YAML.
- `template(name, ctx='.')` and `include(name, ctx='.')`: inject calls to helpers defined in `_helpers.tpl`.
- `numberRef(path)`, `boolRef(path)`: cast `.Values.*` to numeric/boolean using Sprig
  (`int`, `toBool`). Use `as any` where constructs expect typed numbers/bools.
- `stringRef(path)`, `floatRef(path)`: cast `.Values.*` to string/float using Sprig
  (`toString`, `float64`).

## Multi-environment values

Provide `envValues` in the `ChartFactory` constructor to automatically create
`values-<env>.yaml` files. Each environment file overrides defaults from
`values.yaml`.

## Notes on cdk8s and Helm templates

- cdk8s synthesizes Kubernetes manifests. Timonel wraps them into a Helm chart
  structure and allows Helm placeholders to appear in string fields (e.g.,
  `{{ .Values.image.tag }}`).
- For advanced templating, Timonel can generate `_helpers.tpl`. Provide `helpersTpl`
  in `ChartFactory` as a string (verbatim) or as named helpers. Use `template()` or `include()`
  to reference them in your manifests.

## Roadmap

- Helpers for common patterns (HPA, ServiceAccount/RBAC, ConfigMap/Secret mounts).
- Optional `_helpers.tpl` generation and named template functions.
- Richer CLI (resource generators, diff, packaging with `helm package`).

## License

MIT

<!-- Badges section -->

[license-badge]: https://img.shields.io/badge/License-MIT-yellow.svg
[license-url]: https://opensource.org/licenses/MIT
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
