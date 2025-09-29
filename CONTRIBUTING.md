# Contributing to Timonel

Thanks for your interest in contributing! This guide explains how to set up your local environment,
follow our workflow, and submit high-quality changes that keep Timonel healthy.

## Code of Conduct

Participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
Please read it before engaging with the community.

## Getting Started

### Prerequisites

- Node.js **20** or newer (we also test against Node.js 22)
- pnpm **9** or newer (Corepack users can run `corepack enable`)
- Git with access to the `main` and `develop` branches

### Install Dependencies

Clone the repository and install dependencies:

```bash
git clone https://github.com/KenkoGeek/timonel.git
cd timonel
pnpm install --frozen-lockfile
```

## Branching Model

- `main`: production-ready code. Every merge here triggers semantic-release to publish the stable
  npm package (`npm-prd`).
- `develop`: integration branch for upcoming changes. Merges here publish prerelease builds (`npm-beta`).
- Feature and fix branches should be created from `develop` using descriptive names, e.g.
  `feat/improve-synth-output` or `fix/helm-lint`.
- Hotfixes for production should branch from `main`, then be back-merged into `develop` after release.

## Development Workflow

1. Fork the repository (if you do not have write access) and clone your fork.
2. Create a topic branch from `develop`: `git checkout -b feat/my-feature develop`.
3. Install dependencies with `pnpm install --frozen-lockfile`.
4. Implement your changes.
5. Keep your branch up to date by rebasing on top of the latest `develop` when needed.

### Quality Gates

Please run the following commands before opening a pull request:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test:unit
pnpm test:integration # when your change affects integration scenarios
pnpm test:coverage    # optional, but helps validate coverage locally
pnpm build
```

The CI pipeline will execute these same checks (and additional security audits) on every push and
pull request. Fix any failures locally before resubmitting.

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint and
semantic-release. Format every commit message as `type(scope): short description`, for example:

- `feat(cli): add --output-dir flag`
- `fix(helm): normalize chart names`
- `chore(deps): update cdk8s`

This convention allows semantic-release to produce accurate version bumps and changelog entries
automatically. Do **not** run `npm version` or edit `package.json` version fields manually.

## Pull Requests

- Ensure your PR targets `develop` unless it is an emergency hotfix for `main`.
- Fill in the PR template and describe the motivation, approach, and testing.
- Include new or updated tests where appropriate.
- Update documentation (README, examples, etc.) when behavior changes.
- Keep changes focused. Prefer multiple small PRs over a single large one when possible.
- Confirm that CI checks pass before requesting review.

## Release Process

- Semantic-release handles versioning, changelog updates, Git tags, and npm publication.
- Merging to `develop` generates prerelease versions tagged with `beta` on npm.
- When `develop` is ready for production, merge it into `main`. The CI workflow will run
  semantic-release again to produce the stable release.
- Releases are managed through GitHub Actions; no manual publishing is required.

## Reporting Issues

If you discover a bug or want to propose an enhancement:

1. Search existing issues to avoid duplicates.
2. Open a new issue with a clear description, steps to reproduce (if applicable),
   and expected vs. actual behavior.
3. For security concerns, please follow the instructions in `SECURITY.md`
   instead of filing a public issue.

## Questions or Support

If you need help getting started or have questions about the contribution process, open a discussion
or issue on GitHub. We appreciate your contributions and look forward to collaborating!
