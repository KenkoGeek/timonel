# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2024-12-19

### Fixed

- Fixed TypeScript module resolution error in CLI when validating charts
- Added explicit ts-node configuration to prevent module resolution error
- Added `exports` field to package.json to support subpath imports like `timonel/lib/helm`

## [0.1.0] - 2024-12-19

### Added

- Initial release of Timonel - TypeScript library for programmatic Helm chart generation
- ChartFactory class with support for Deployments, Services, Ingress, ConfigMaps, Secrets
- PersistentVolume and PersistentVolumeClaim support with multi-cloud optimization
- ServiceAccount with workload identity support (AWS IRSA, Azure, GCP)
- Multi-environment values support (dev, staging, prod)
- CLI tool (`tl`) with commands: init, synth, validate, diff, deploy, package
- CI/CD integration with --dry-run, --silent, --env flags
- Dynamic value overrides with --set flag and dot notation support
- Helm templating helpers with programmatic \_helpers.tpl generation
- Type-safe API with cdk8s constructs and Helm placeholder preservation
- Comprehensive AWS 2048 game example with EKS deployment
- Security-focused development with ESLint security plugin and audit pipeline
- GitHub Actions workflows for CI/CD with provenance-enabled publishing

### Security

- ESLint security plugin with 12+ vulnerability detection rules
- Automated dependency scanning via Dependabot
- CodeQL analysis for code security
- Security audit in CI/CD pipeline
- Provenance-enabled npm publishing

[Unreleased]: https://github.com/KenkoGeek/timonel/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.0
