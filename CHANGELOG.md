# [1.0.0](https://github.com/KenkoGeek/timonel/compare/v0.4.0...v1.0.0) (2025-09-07)


### Bug Fixes

* **ci:** configure GitHub App token for semantic-release bypass - Use RELEASE_TOKEN from npm-prd environment for checkout and semantic-release ([0d385d1](https://github.com/KenkoGeek/timonel/commit/0d385d1084a45de3ab731094e87196239811e6fb))
* **ci:** disable body-max-line-length for semantic-release compatibility  - Set body-max-line-length to 0 (disabled) to allow long changelog entries - Fixes semantic-release commit validation failures - Maintains other commitlint rules for developer commits ([b215f65](https://github.com/KenkoGeek/timonel/commit/b215f65bccb69a1cfca79084e6a9c96954fb478a))
* **ci:** disable footer line length limit for semantic-release commits ([d5ae4dc](https://github.com/KenkoGeek/timonel/commit/d5ae4dc83e68f8fade4a8289d1ce4e2bae5046dd))
* **ci:** disable footer-leading-blank for semantic-release compatibility  - Set footer-leading-blank to 0 (disabled) to allow semantic-release footer format ([2f8c6c8](https://github.com/KenkoGeek/timonel/commit/2f8c6c863c6aabd1d3f3d8022b43fefecb02f010))
* **ci:** replace CodeQL with security check in release validation ([#15](https://github.com/KenkoGeek/timonel/issues/15)) ([b8cecea](https://github.com/KenkoGeek/timonel/commit/b8cecea1eaf0bb6af3e6fd2f6bc38c2fb2c09f4d))
* **ci:** resolve release workflow issues ([#16](https://github.com/KenkoGeek/timonel/issues/16)) ([ed5dc9b](https://github.com/KenkoGeek/timonel/commit/ed5dc9b3d86b531d4495d4d05dd913340333322c))


### Features

* add manual release workflow with GitHub Actions ([1035b2e](https://github.com/KenkoGeek/timonel/commit/1035b2e18fbb808e57438353c865ecd129d9e04d))
* add NetworkPolicy helpers for Zero Trust network security ([#13](https://github.com/KenkoGeek/timonel/issues/13)) ([cee3b58](https://github.com/KenkoGeek/timonel/commit/cee3b5876de839ca3cf16dd6ca6e3b76626392ce))
* **ci:** add required status checks validation to release workflow ([#14](https://github.com/KenkoGeek/timonel/issues/14)) ([7f8665f](https://github.com/KenkoGeek/timonel/commit/7f8665fa908215cc92a4dbefb7fec00de98464bb))
* **ci:** implement automated semantic release with conventional commits ([02ce189](https://github.com/KenkoGeek/timonel/commit/02ce18943efd8019168b5f9af29be0140a9e1524))
* **ci:** implement automated semantic release with conventional commits ([bb94fda](https://github.com/KenkoGeek/timonel/commit/bb94fda3e80bf3e010e7b53bdd1794f88060408a))
* **core:** add NetworkPolicy helpers for Zero Trust network security ([34ac6bd](https://github.com/KenkoGeek/timonel/commit/34ac6bda3956e5fe326b72e9831bd4bb8bc660da))


### Performance Improvements

* **ci:** homogenize CI/CD workflows and optimize release pipeline ([#17](https://github.com/KenkoGeek/timonel/issues/17)) ([4622d11](https://github.com/KenkoGeek/timonel/commit/4622d113e5753a5ff69c82a1e3784ecf61c34689))


### BREAKING CHANGES

* **ci:** ESLint configuration migrated to flat config format
* **ci:** ESLint configuration migrated to flat config format

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2025-09-06

### Added (0.4.0)

- **Custom Manifest Naming**: Complete implementation for customizable Kubernetes
  manifest file names
  - `manifestName` option in RutterProps to specify custom base names for manifest
    files
  - `singleManifestFile` option to combine all resources into a single manifest
    file
  - Enhanced file organization with descriptive names instead of generic numbered
    files
  - Support for both single file mode (`application.yaml`) and separate files mode
    (`0000-my-app-deployment-web.yaml`)
  - Backward compatibility maintained - default behavior unchanged when options not
    specified

### Enhanced (0.4.0)

- **HelmChartWriter**: Added `singleFile` property to SynthAsset interface for
  improved file handling
- **Documentation**: Comprehensive Custom Manifest Naming section added to README
  with examples
- **Examples**: All examples updated with custom manifest naming demonstrations
  - **AWS 2048 Game**: Enhanced with production-ready AWS features
    - AWS ALB Ingress with health checks and SSL support
    - HorizontalPodAutoscaler (HPA) for CPU-based auto-scaling
    - PodDisruptionBudget (PDB) for high availability during updates
    - Custom manifest naming with `manifestName: 'game-2048'`
    - Multi-environment configuration (dev/staging/prod)
  - **WordPress**: Updated to showcase `manifestName: 'wordpress-app'` and `singleManifestFile: true`
    - Comprehensive AWS integration examples (EBS, EFS, IRSA, Secrets Manager)
    - Auto-scaling with HPA and VPA configurations
    - Production-ready deployment patterns
  - **WordPress Umbrella**: Subcharts updated with custom manifest naming
    - MySQL subchart: `manifestName: 'mysql-database'`, `singleManifestFile: true`
    - WordPress subchart: `manifestName: 'wordpress-app'`, `singleManifestFile: false`
- **Example Documentation**: All example READMEs enhanced with custom manifest naming references
  and comprehensive deployment instructions
- **Auto-scaling Features**: Properly documented existing production-ready capabilities
  - HorizontalPodAutoscaler (HPA) with CPU/memory metrics and custom behavior policies
  - VerticalPodAutoscaler (VPA) with resource policies and update modes
  - PodDisruptionBudget (PDB) for high availability during updates
- **AWS Multi-Cloud Support**: Comprehensive documentation of EKS integration features
  - AWS IRSA ServiceAccount for secure IAM role assumption with regional STS endpoints
  - AWS EBS StorageClass with GP3, IO1, IO2 support, encryption, and IOPS configuration
  - AWS EFS StorageClass for shared storage across pods with access points
  - AWS ALB Ingress with health checks, SSL certificates, and advanced routing
  - AWS Secrets Manager and Parameter Store integration via SecretProviderClass
  - Multi-cloud ServiceAccount with workload identity (AWS IRSA, Azure, GCP)

## [0.3.0] - 2025-09-02

### Added (0.3.0)

- **Umbrella Charts Support**: Complete implementation for managing multiple subcharts
  - `UmbrellaRutter` class for coordinating multiple Rutter instances
  - `createUmbrella()` helper function for easy umbrella chart creation
  - CLI commands: `tl umbrella init`, `tl umbrella add`, `tl umbrella synth`
  - Automatic Chart.yaml generation with dependencies
  - Support for environment-specific values in umbrella charts
  - Example templates for umbrella and subchart scaffolding
- **WordPress Umbrella Example**: Complete example separating MySQL and WordPress into subcharts
  - MySQL subchart with persistent storage and secrets
  - WordPress subchart with database connectivity
  - Multi-environment configuration (dev/prod)
  - Comprehensive documentation and deployment guide

### Changed (0.3.0)

- Updated CLI usage to include umbrella chart commands
- Enhanced example generation with subchart support

### Removed

- **BREAKING**: Removed unused `cdk8s-plus-28` dependency
  - Project uses `ApiObject` directly for better control
  - No impact on functionality, only dependency cleanup

## [0.2.1] - 2025-09-02

### Fixed

- Updated examples package.json versions to 0.2.0 for consistency
- Fixed examples imports to use relative paths instead of 'timonel' package
- Updated dependencies to resolve brace-expansion security vulnerability
- Examples now work correctly with CLI after v0.2.0 breaking changes

### Security

- Updated dependencies to latest versions
- Resolved brace-expansion vulnerability in transitive dependencies

## [0.2.0] - 2025-09-02

### BREAKING CHANGES

- **API Change**: Renamed `ChartFactory` class to `Rutter` (maritime pilot concept)
- **Import Change**: `import { ChartFactory }` → `import { Rutter }`
- **Constructor Change**: `new ChartFactory()` → `new Rutter()`
- **File Renamed**: `ChartFactory.ts` → `Rutter.ts`

### Migration Guide

```typescript
// Before v0.2.0
import { ChartFactory } from 'timonel';
const factory = new ChartFactory({ meta: { name: 'my-app' } });

// After v0.2.0
import { Rutter } from 'timonel';
const rutter = new Rutter({ meta: { name: 'my-app' } });
```

### Implementation

- Updated all examples and documentation to use `Rutter` terminology
- Updated CLI template generation and --set flag integration
- Updated package.json description: 'chart factory' → 'chart generator'
- Eliminated all factory references from codebase
- Enhanced maritime theme consistency (Timonel + Rutter)

## [0.1.7] - 2025-09-01

### Breaking Changes

- **BREAKING**: Renamed `ChartFactory` class to `Rutter` (maritime pilot concept)
- Updated all examples and documentation to use `Rutter` instead of `ChartFactory`
- Renamed `ChartFactory.ts` to `Rutter.ts` for consistency
- Updated API: `new Rutter()` instead of `new ChartFactory()`

## [0.1.6] - 2025-09-01

### Structure

- Renamed `example/` directory to `examples/` for better clarity
- Updated linting ignore patterns to use `examples/**`
- Added Examples section to README documenting available examples

## [0.1.5] - 2025-08-31

### Linting

- Excluded example directories from main lint script to resolve CI errors
- Ensure both lint and security:lint scripts ignore example imports

## [0.1.4] - 2025-08-31

### Updated

- Updated TypeScript configuration to use Node16 module and moduleResolution
- Resolved deprecated moduleResolution warning for TypeScript 7.0 compatibility
- Modernized module resolution while maintaining CommonJS compatibility

### CI

- Excluded example directories from security linting to resolve CI import errors

## [0.1.3] - 2025-08-31

### Bug Fixes 0.1.3

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

## [0.1.2] - 2025-08-30

### Added

- Enhanced `validate` command to generate chart and run `helm lint` for proper validation
- Helm installation detection with clear installation instructions
- Automatic cleanup of temporary validation directories

### Bug Fixes 0.1.2

- Fixed example chart to use valid Helm template syntax for annotations
- Improved error messages with installation links for missing Helm binary

## [0.1.1] - 2025-08-30

### Resolved

- Fixed TypeScript module resolution error in CLI when validating charts
- Added explicit ts-node configuration to prevent module resolution error
- Added `exports` field to package.json to support subpath imports like `timonel/lib/helm`

## [0.1.0] - 2025-08-30

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

### Security Features

- ESLint security plugin with 12+ vulnerability detection rules
- Automated dependency scanning via Dependabot
- CodeQL analysis for code security
- Security audit in CI/CD pipeline
- Provenance-enabled npm publishing

[Unreleased]: https://github.com/KenkoGeek/timonel/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.4.0
[0.3.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.3.0
[0.2.1]: https://github.com/KenkoGeek/timonel/releases/tag/v0.2.1
[0.2.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.2.0
[0.1.7]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.7
[0.1.6]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.6
[0.1.5]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.5
[0.1.4]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.4
[0.1.3]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.3
[0.1.2]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.2
[0.1.1]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.1
[0.1.0]: https://github.com/KenkoGeek/timonel/releases/tag/v0.1.0
