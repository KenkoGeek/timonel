# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.7] - 2025-01-02

### Breaking Changes

- **BREAKING**: Renamed `ChartFactory` class to `Rutter` (maritime pilot concept)
- Updated all examples and documentation to use `Rutter` instead of `ChartFactory`
- Renamed `ChartFactory.ts` to `Rutter.ts` for consistency
- Updated API: `new Rutter()` instead of `new ChartFactory()`

## [0.1.6] - 2025-01-02

### Structure

- Renamed `example/` directory to `examples/` for better clarity
- Updated linting ignore patterns to use `examples/**`
- Added Examples section to README documenting available examples

## [0.1.5] - 2025-01-02

### Linting

- Excluded example directories from main lint script to resolve CI errors
- Ensure both lint and security:lint scripts ignore example imports

## [0.1.4] - 2025-01-02

### Updated

- Updated TypeScript configuration to use Node16 module and moduleResolution
- Resolved deprecated moduleResolution warning for TypeScript 7.0 compatibility
- Modernized module resolution while maintaining CommonJS compatibility

### CI

- Excluded example directories from security linting to resolve CI import errors

## [0.1.3] - 2025-01-02

### Bug Fixes

- Fixed Helm chart generation issues with numeric values in YAML
- Corrected environment variable handling for complex objects
- Fixed PersistentVolumeClaim volume references
- Resolved Service port type casting issues
- Updated examples to use literal numeric values instead of numberRef for critical fields

### Changed

- Simplified WordPress example to use string environment variables instead of valueFrom objects
- Updated AWS 2048 example to use literal ports and replicas
- Improved README documentation with corrected deployment examples
- Removed redundant DEPLOYMENT.md file from aws-game-2048 example

### Documentation

- Enhanced main README with better examples and troubleshooting
- Updated example READMEs with working deployment commands
- Added notes about numeric value handling in Helm templates

## [0.1.2] - 2024-12-19

### Added

- Enhanced `validate` command to generate chart and run `helm lint` for proper validation
- Helm installation detection with clear installation instructions
- Automatic cleanup of temporary validation directories

### Fixed

- Fixed example chart to use valid Helm template syntax for annotations
- Improved error messages with installation links for missing Helm binary

## [0.1.1] - 2024-12-19

### Resolved

- Fixed TypeScript module resolution error in CLI when validating charts
- Added explicit ts-node configuration to prevent module resolution error
- Added `exports` field to package.json to support subpath imports like `timonel/lib/helm`

## [0.1.0] - 2024-12-19

### Initial

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
