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

rutter.write('dist/charts/my-app');
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

- **aws-game-2048**: AWS 2048 game deployment with Service and Ingress
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
- Richer CLI (resource generators, diff)
- Enhanced multi-cloud support
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
