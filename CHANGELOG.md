## [2.8.3](https://github.com/KenkoGeek/timonel/compare/v2.8.2...v2.8.3) (2025-09-15)

### Bug Fixes

- **cli:** resolve incorrect syntax in conditional Helm templates, ensuring namespace and ingress conditions work correctly ([20363b8](https://github.com/KenkoGeek/timonel/commit/20363b8a997a87114b78cf3b4118f9d05eda0686))

## [2.8.1](https://github.com/KenkoGeek/timonel/compare/v2.8.0...v2.8.1) (2025-09-15)

### Bug Fixes

- **cli:** resolve timonel module not found error in umbrella.ts ([2dfb19c](https://github.com/KenkoGeek/timonel/commit/2dfb19c7dd4fcc2de9a342c6953133e6601cf74e))

# [2.8.0](https://github.com/KenkoGeek/timonel/compare/v2.7.3...v2.8.0) (2025-09-14)

### Bug Fixes

- **ci:** add mandatory CI status verification to beta release ([02af416](https://github.com/KenkoGeek/timonel/commit/02af41689a4efbee2f215bcce1c9c6a5e59878cd))
- **ci:** Q gate not needed ([9fcb210](https://github.com/KenkoGeek/timonel/commit/9fcb210c056d68af549e0f763331dffd094e2fa4))
- **ci:** Q gate not needed ([162b53f](https://github.com/KenkoGeek/timonel/commit/162b53f2310361c596d1369edb77044c757581df))
- **ci:** remove npm-prd environment from beta release ([50076de](https://github.com/KenkoGeek/timonel/commit/50076de8734066b181c5fc5f28b03fcde0959efc))
- **ci:** restore release.yml workflow from v2.7.3 ([cabb8bf](https://github.com/KenkoGeek/timonel/commit/cabb8bff765cad790b1c27a2d6749c0ddac6e24d))
- **ci:** restore working release workflow from v2.7.3 ([bed9146](https://github.com/KenkoGeek/timonel/commit/bed9146fd772a3d1f45e9cef5a316375351b1912))
- **ci:** specify explicit semantic-release config file ([ac95d51](https://github.com/KenkoGeek/timonel/commit/ac95d51469a20df289e63665e5e8572fbcf86e35))
- **ci:** use working semantic-release config from v2.7.3 ([5261eda](https://github.com/KenkoGeek/timonel/commit/5261edab43d05670f3803fca222d1e01f29d2f57))
- **core:** addIngress already normalized with NGINX best practices ([33fd0ae](https://github.com/KenkoGeek/timonel/commit/33fd0aee20db1c65a92bf36cbdc683b7028c80f8))
- **core:** ensure Timonel header appears in all YAML files ([ebee72e](https://github.com/KenkoGeek/timonel/commit/ebee72e9bc5b54eb56f871786e08bef36caad45a))
- **core:** resolve splitDocs removing Timonel headers from YAML ([951db75](https://github.com/KenkoGeek/timonel/commit/951db7553da57b48880b964551975411517e4218))
- **network:** Ingress API with TLS validation and security defaults ([#88](https://github.com/KenkoGeek/timonel/issues/88)) ([b1397b1](https://github.com/KenkoGeek/timonel/commit/b1397b1fa51a01f84f8cf4bbe41efa27f5636ac7))

### Features

- **ci:** add automatic beta release workflow for main branch ([72b553b](https://github.com/KenkoGeek/timonel/commit/72b553b8c530368478e430abdeeaef3aa1e6b310))
- **ci:** add beta releases on main with quality gates [skip ci] ([81c4dd0](https://github.com/KenkoGeek/timonel/commit/81c4dd062015a1bc2e62730c7f94f23fcfdfe2ed))
- **ci:** configure dual release strategy ([b11aeae](https://github.com/KenkoGeek/timonel/commit/b11aeaef175603787cd27a0af83d6ab6f8acb8f7))
- **ci:** simplify to beta releases only ([4f9704d](https://github.com/KenkoGeek/timonel/commit/4f9704dfe9fa63b7bd3cc2bb458256f47514d1ed))
- **core:** add Whatever tomorrow brings Ill be there ([fcbeb06](https://github.com/KenkoGeek/timonel/commit/fcbeb067a9835bca5315569bb7fab1d992a15d3d))
- **core:** Add with open arms and open eyes, yeah ([5be5d32](https://github.com/KenkoGeek/timonel/commit/5be5d32fcc2287ac562b4422212a1e37775ebcda))
- **network:** enhance NGINX Ingress support with cert-manager integration and security enhanced ([#91](https://github.com/KenkoGeek/timonel/issues/91)) ([be223dd](https://github.com/KenkoGeek/timonel/commit/be223ddfd2a387c2ff60cb7c8411ef893c45b7d3))

## [2.7.3](https://github.com/KenkoGeek/timonel/compare/v2.7.2...v2.7.3) (2025-09-13)

### Bug Fixes

- **cli:** resolve ES modules \_\_dirname and scaffold import paths ([#80](https://github.com/KenkoGeek/timonel/issues/80)) ([117c064](https://github.com/KenkoGeek/timonel/commit/117c064c3bae705a50de6d237b1bd7bf9340c7dd))

## [2.7.2](https://github.com/KenkoGeek/timonel/compare/v2.7.1...v2.7.2) (2025-09-13)

### Bug Fixes

- **aws:** update Karpenter API versions and add disruption/scheduling helpers ([#77](https://github.com/KenkoGeek/timonel/issues/77)) ([59fabbd](https://github.com/KenkoGeek/timonel/commit/59fabbd19481e694f4ff4e26e50ef57bb724717a))

## [2.7.1](https://github.com/KenkoGeek/timonel/compare/v2.7.0...v2.7.1) (2025-09-13)

### Bug Fixes

- **core:** TypeScript interfaces for GCP Artifact Registry and Karpenter helpers ([#72](https://github.com/KenkoGeek/timonel/issues/72)) ([b91d270](https://github.com/KenkoGeek/timonel/commit/b91d270c7662327861d8f1216966dd00677c857b))

# [2.7.0](https://github.com/KenkoGeek/timonel/compare/v2.6.2...v2.7.0) (2025-09-13)

### Features

- **core:** Add NetworkPolicy, ServiceAccount, CronJob, HPA, VPA, Ingress, and Karpenter resources ([0bda471](https://github.com/KenkoGeek/timonel/commit/0bda47158eab41878a956105fb311b83411a2846))

## [2.6.2](https://github.com/KenkoGeek/timonel/compare/v2.6.1...v2.6.2) (2025-09-13)

### Bug Fixes

- **core:** correct StorageClass API structure for Kubernetes 1.32+ compatibility ([2acb406](https://github.com/KenkoGeek/timonel/commit/2acb406c29b201e71dffc1263f5f2099c71376d4)), closes [#58](https://github.com/KenkoGeek/timonel/issues/58) [#58](https://github.com/KenkoGeek/timonel/issues/58)

## [2.6.1](https://github.com/KenkoGeek/timonel/compare/v2.6.0...v2.6.1) (2025-09-13)

### Bug Fixes

- **core:** resolve critical issues [#52](https://github.com/KenkoGeek/timonel/issues/52)-[#56](https://github.com/KenkoGeek/timonel/issues/56) and security vulnerabilities ([4018f06](https://github.com/KenkoGeek/timonel/commit/4018f06012e65dffc7780fc6da20ee25fd9f0a2d))

# [2.6.0](https://github.com/KenkoGeek/timonel/compare/v2.5.1...v2.6.0) (2025-09-13)

### Features

- **core:** add security helpers - sanitizeEnvVar, validateImageTag, generateSecretName ([#43](https://github.com/KenkoGeek/timonel/issues/43)) ([323c9ae](https://github.com/KenkoGeek/timonel/commit/323c9ae3243dead04dacc6daf4e98e8af1a8d98b))

## [2.5.1](https://github.com/KenkoGeek/timonel/compare/v2.5.0...v2.5.1) (2025-09-12)

### Bug Fixes

- **ci:** add comprehensive test suite with unit and integration tests ([#38](https://github.com/KenkoGeek/timonel/issues/38)) ([ffae52f](https://github.com/KenkoGeek/timonel/commit/ffae52fe357a8324959d74c5dd88594b21dafde1))

# [2.5.0](https://github.com/KenkoGeek/timonel/compare/v2.4.0...v2.5.0) (2025-09-12)

### Features

- **core:** add reusable pod template helpers with security profiles, workload optimization, sidecar patterns, and health checks ([a1372fa](https://github.com/KenkoGeek/timonel/commit/a1372fa2d9ac32a2655faf0f94302eb04aca4898))
- **core:** restore v2.3.0 functionality with modern architecture ([836d0e0](https://github.com/KenkoGeek/timonel/commit/836d0e0ede36d11059c125a612690c16e069e7c8)), closes [#34](https://github.com/KenkoGeek/timonel/issues/34) [#35](https://github.com/KenkoGeek/timonel/issues/35) [#36](https://github.com/KenkoGeek/timonel/issues/36)

# [2.4.0](https://github.com/KenkoGeek/timonel/compare/v2.3.0...v2.4.0) (2025-09-11)

### Features

- **core:** add GKE Workload Identity ServiceAccount, AWS ECR ServiceAccount helpers. implement modular architecture. add Role resource support for RBAC. with resource providers. add DaemonSet resource support. add StatefulSet resource support. add ClusterRole resource support for cluster-wide RBAC. add RoleBinding resource support for RBAC ([#33](https://github.com/KenkoGeek/timonel/issues/33)) ([eabe972](https://github.com/KenkoGeek/timonel/commit/eabe9729865ea56ce45480a60510704f28704367))

# [2.3.0](https://github.com/KenkoGeek/timonel/compare/v2.2.0...v2.3.0) (2025-09-10)

### Bug Fixes

- **core:** implement CLI-focused security validations and centralized input sanitization ([f0a8144](https://github.com/KenkoGeek/timonel/commit/f0a8144c9aeaa510f4bcf999ca6b1697deca31ae))

### Features

- **core:** add Karpenter integration with 5 methods, fix performance issues, and update security docs ([#31](https://github.com/KenkoGeek/timonel/issues/31)) ([fb69f33](https://github.com/KenkoGeek/timonel/commit/fb69f338fd27a01aa8eae04de9ea9962fb840a0b))

# [2.2.0](https://github.com/KenkoGeek/timonel/compare/v2.1.1...v2.2.0) (2025-09-09)

### Features

- **core:** add comprehensive Azure helpers for AKS integration with enhanced security ([870d1cd](https://github.com/KenkoGeek/timonel/commit/870d1cd3f81781d2f312f37e9dbd4dcc103e3ab8))

## [2.1.1](https://github.com/KenkoGeek/timonel/compare/v2.1.0...v2.1.1) (2025-09-09)

### Bug Fixes

- **cli:** enable TypeScript execution with enhanced security and strict mode validation ([cf468d2](https://github.com/KenkoGeek/timonel/commit/cf468d2c402359827f7678dcac49f38b8afa4052))

# [2.1.0](https://github.com/KenkoGeek/timonel/compare/v2.0.0...v2.1.0) (2025-09-08)

### Features

- **core:** add Job and CronJob helpers for batch workloads ([#21](https://github.com/KenkoGeek/timonel/issues/21)) ([0f375d2](https://github.com/KenkoGeek/timonel/commit/0f375d214e1cb3a2791522c530230757c15b2dee))

# [2.0.0](https://github.com/KenkoGeek/timonel/compare/v1.0.0...v2.0.0) (2025-09-07)

### Bug Fixes

- **ci:** remove redundant publish workflow and configure release token ([fcea159](https://github.com/KenkoGeek/timonel/commit/fcea15914617e372a2aafc8a30001cc54ec8bff6))
- **examples:** update timonel dependency to ^1.0.0 ([3d1f692](https://github.com/KenkoGeek/timonel/commit/3d1f6922448648c7efe57cc1fdde9a5808e04d7e))
- **helm:** remove automatic numbering from template files ([#20](https://github.com/KenkoGeek/timonel/issues/20)) ([f75748a](https://github.com/KenkoGeek/timonel/commit/f75748aee974a254f576807f26396b026262b42c))

### Features

- **ci:** add automatic CHANGELOG.md formatting to semantic-release ([6846b4d](https://github.com/KenkoGeek/timonel/commit/6846b4de2cfd411b7b9b9724d67830cf192ad2b9))
- **core:** add Azure Application Gateway Ingress Controller (AGIC) support ([#19](https://github.com/KenkoGeek/timonel/issues/19)) ([75bbb99](https://github.com/KenkoGeek/timonel/commit/75bbb998981ca6492b09ad12c54e03050b307c27))
- **core:** add Azure Disk StorageClass helper for AKS ([#18](https://github.com/KenkoGeek/timonel/issues/18)) ([5fb29de](https://github.com/KenkoGeek/timonel/commit/5fb29de260c4cabf6732520b0834cf0d0421a33a))

### BREAKING CHANGES

- **helm:** Template files no longer have automatic numbering prefixes

- refactor(helm): unify template naming strategy and add breaking change notice

* Simplify file naming logic with unified approach
* Use consistent naming strategy for single and multiple documents
* Add breaking change warning in README for numbered filename dependencies
* Improve code maintainability with cleaner implementation

Addresses PR review feedback for better consistency and user awareness.

# [1.0.0](https://github.com/KenkoGeek/timonel/compare/v0.4.0...v1.0.0) (2025-09-07)

### Bug Fixes

- **ci:** configure GitHub App token for semantic-release bypass - Use RELEASE_TOKEN from npm-prd environment for checkout and semantic-release ([0d385d1](https://github.com/KenkoGeek/timonel/commit/0d385d1084a45de3ab731094e87196239811e6fb))
- **ci:** disable body-max-line-length for semantic-release compatibility - Set body-max-line-length to 0 (disabled) to allow long changelog entries - Fixes semantic-release commit validation failures - Maintains other commitlint rules for developer commits ([b215f65](https://github.com/KenkoGeek/timonel/commit/b215f65bccb69a1cfca79084e6a9c96954fb478a))
- **ci:** disable footer line length limit for semantic-release commits ([d5ae4dc](https://github.com/KenkoGeek/timonel/commit/d5ae4dc83e68f8fade4a8289d1ce4e2bae5046dd))
- **ci:** disable footer-leading-blank for semantic-release compatibility - Set footer-leading-blank to 0 (disabled) to allow semantic-release footer format ([2f8c6c8](https://github.com/KenkoGeek/timonel/commit/2f8c6c863c6aabd1d3f3d8022b43fefecb02f010))
- **ci:** replace CodeQL with security check in release validation ([#15](https://github.com/KenkoGeek/timonel/issues/15)) ([b8cecea](https://github.com/KenkoGeek/timonel/commit/b8cecea1eaf0bb6af3e6fd2f6bc38c2fb2c09f4d))
- **ci:** resolve release workflow issues ([#16](https://github.com/KenkoGeek/timonel/issues/16)) ([ed5dc9b](https://github.com/KenkoGeek/timonel/commit/ed5dc9b3d86b531d4495d4d05dd913340333322c))

### Features

- add manual release workflow with GitHub Actions ([1035b2e](https://github.com/KenkoGeek/timonel/commit/1035b2e18fbb808e57438353c865ecd129d9e04d))
- add NetworkPolicy helpers for Zero Trust network security ([#13](https://github.com/KenkoGeek/timonel/issues/13)) ([cee3b58](https://github.com/KenkoGeek/timonel/commit/cee3b5876de839ca3cf16dd6ca6e3b76626392ce))
- **ci:** add required status checks validation to release workflow ([#14](https://github.com/KenkoGeek/timonel/issues/14)) ([7f8665f](https://github.com/KenkoGeek/timonel/commit/7f8665fa908215cc92a4dbefb7fec00de98464bb))
- **ci:** implement automated semantic release with conventional commits ([02ce189](https://github.com/KenkoGeek/timonel/commit/02ce18943efd8019168b5f9af29be0140a9e1524))
- **ci:** implement automated semantic release with conventional commits ([bb94fda](https://github.com/KenkoGeek/timonel/commit/bb94fda3e80bf3e010e7b53bdd1794f88060408a))
- **core:** add NetworkPolicy helpers for Zero Trust network security ([34ac6bd](https://github.com/KenkoGeek/timonel/commit/34ac6bda3956e5fe326b72e9831bd4bb8bc660da))

### Performance Improvements

- **ci:** homogenize CI/CD workflows and optimize release pipeline ([#17](https://github.com/KenkoGeek/timonel/issues/17)) ([4622d11](https://github.com/KenkoGeek/timonel/commit/4622d113e5753a5ff69c82a1e3784ecf61c34689))

### BREAKING CHANGES

- **ci:** ESLint configuration migrated to flat config format
- **ci:** ESLint configuration migrated to flat config format

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
