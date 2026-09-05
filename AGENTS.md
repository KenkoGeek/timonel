# AGENTS.md

This file defines the engineering rules for humans and AI agents contributing to Timonel.

These rules are normative. Changes that conflict with them require an explicit architectural
decision in the pull request.

## 1. Project intent

Timonel is a TypeScript library for building Helm charts programmatically on top of cdk8s,
cdk8s-plus, constructs, and other typed Kubernetes abstractions.

The primary product is the library API. The CLI is secondary.

The project optimizes for:

- compile-time safety;
- predictable runtime behavior;
- faithful Helm output;
- composability with cdk8s and constructs;
- small, explicit public APIs;
- strong compatibility guarantees for published packages.

Do not optimize for convenience by bypassing TypeScript when a typed abstraction is available.

## 2. Typed-first architecture

### 2.1 Prefer typed constructs

New Kubernetes resources SHOULD be expressed through, in this order:

1. cdk8s-plus constructs when an appropriate stable construct exists;
2. cdk8s `ApiObject` with a typed Timonel spec when no suitable higher-level construct exists;
3. a focused typed Timonel abstraction for recurring patterns;
4. raw YAML only as a last-resort legacy escape hatch.

Before creating a Timonel-specific abstraction, check whether cdk8s, cdk8s-plus, constructs, or an
official ecosystem package already provides the capability.

Do not duplicate an existing typed upstream abstraction without a documented reason.

### 2.2 Raw YAML is not a primary API

Do not introduce new public APIs whose normal usage requires callers to pass arbitrary YAML strings.

`addTemplateManifest(string, ...)` is a legacy escape hatch. New code MUST NOT depend on it when the
same resource can be represented with a typed construct or typed object.

The long-term direction is to deprecate and remove raw-string manifest APIs in a future major
release after typed replacements cover legitimate use cases.

If raw YAML support must temporarily remain:

- mark it clearly as an escape hatch;
- validate inputs and paths;
- never synthesize hidden or placeholder Kubernetes resources into user output;
- test the exact rendered chart;
- document why no typed alternative exists.

### 2.3 No fake type safety

A public API described as type-safe MUST provide type safety to downstream consumers through the
generated `.d.ts` files.

Runtime proxies, casts, `unknown`, or `any` do not count as type safety if a consumer cannot compile
the documented API.

For generic APIs such as `valuesRef<T>()`:

- property access MUST reflect the shape of `T`;
- nested properties MUST preserve their nested TypeScript types;
- array element callbacks MUST expose the element type;
- invalid properties MUST fail TypeScript compilation;
- public examples MUST compile against the built package declarations.

## 3. Public API contracts

### 3.1 Types and runtime must agree

Every exported function, class, method, and property MUST behave exactly as its TypeScript
declaration promises.

Examples of forbidden behavior:

- declaring `Promise<T>` but returning `T` at runtime;
- declaring one object type but returning a different marker object;
- exposing options that are silently ignored;
- monkey-patching public methods to change their runtime contract;
- documenting a property or method that does not exist in the generated declarations.

Do not use casts to hide contract mismatches. Fix the contract or the implementation.

### 3.2 Public options must work

Every property in an exported options interface MUST have observable, tested behavior.

If an option is obsolete:

- deprecate it explicitly;
- document the replacement;
- remove it only according to SemVer.

Never leave inert configuration in the public API.

### 3.3 Keep exports intentional

`src/index.ts` is the primary public surface.

Before exporting something new, determine whether consumers truly need it. Prefer exposing stable
concepts instead of internal implementation details.

Subpath exports in `package.json` are also public API and carry the same compatibility obligations.

## 4. cdk8s and constructs integration

Timonel SHOULD compose with existing construct trees rather than force isolated trees when
composition is possible.

When accepting a `Construct` or `Chart` scope:

- actually use it;
- preserve construct IDs and ownership semantics;
- avoid creating hidden `App` instances unless the API explicitly owns the application lifecycle;
- test embedding Timonel in an existing cdk8s application.

Prefer returning the real typed cdk8s/cdk8s-plus resource created by the operation.

Do not create fake Kubernetes resources solely to satisfy a return type.

## 5. Helm generation

Generated Helm must be treated as product output, not an implementation detail.

For every Helm-related feature:

- validate the resulting YAML/template, not only intermediate JavaScript objects;
- ensure whitespace and indentation are stable;
- preserve Helm expressions without accidental quoting or escaping;
- avoid hidden resources or duplicate manifests;
- use deterministic filenames and ordering where practical;
- test nested conditions, loops, `with`, arrays, maps, and empty values.

String post-processing SHOULD be minimized. Prefer structured transformations where feasible.

If string post-processing is unavoidable, it MUST have focused regression tests covering malformed
and nested cases.

## 6. ValuesRef rules

`valuesRef<T>()` is intended to be Timonel's preferred typed Helm-values API.

Changes to ValuesRef MUST satisfy both compile-time and runtime tests.

Required properties:

- mapped property access from `T`;
- nested proxy typing;
- correct primitive operations by value type where feasible;
- correct array element typing for `range()`;
- correct scoped typing for `with()`;
- no divergence between marker interfaces and returned runtime objects;
- deterministic serialization through the Helm YAML serializer.

Do not add additional ValuesRef helpers until the base type/runtime contract is correct.

## 7. Error handling

Library code MUST throw useful `Error` objects rather than terminate the process.

Errors SHOULD include:

- the failed operation;
- the resource or identifier where useful;
- the underlying cause using `Error.cause` when available.

Do not expose secrets, tokens, credentials, or full sensitive manifests in error messages or logs.

Avoid `console.*` in library internals. Use the project logger where logging is appropriate.

## 8. Security

Treat all caller-provided names, paths, YAML, Helm fragments, environment names, and file
destinations as untrusted input.

Requirements:

- prevent path traversal;
- reject control characters where filenames are involved;
- do not construct shell commands from untrusted input;
- escape template literals where a typed abstraction cannot eliminate interpolation;
- do not log credentials or secrets;
- keep dependency audit findings visible.

Security validation must not provide a false sense of safety. A validator should only claim
guarantees it actually enforces.

## 9. Dependency policy

Prefer mature upstream libraries over reimplementing Kubernetes or Helm domain models.

When upgrading dependencies:

- verify their actual Node.js engine ranges;
- keep `package.json#engines` compatible with the complete runtime and development toolchain;
- run the full test matrix;
- review generated declarations and package contents;
- avoid unnecessary runtime dependencies.

Runtime dependencies belong in `dependencies`; build, lint, test, and release tooling belongs in
`devDependencies` unless consumers need it at runtime.

Do not keep unused dependencies.

## 10. Testing requirements

### 10.1 Minimum checks

Before considering a task complete, run the relevant subset of:

```bash
pnpm install --frozen-lockfile
pnpm ci:check
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm md:lint
pnpm doc:coverage:validate
pnpm security:audit
pnpm pack
```

Use the CI-supported Node versions for compatibility-sensitive changes.

### 10.2 Test public consumer behavior

Tests under Vitest are not sufficient for TypeScript API claims because transpilation can skip
consumer-facing type checking.

For public typed APIs, add compile-time consumer tests that import the package API or generated
declarations and verify:

- documented valid examples compile;
- documented invalid examples fail with `@ts-expect-error` or an equivalent type-test mechanism;
- runtime behavior matches the same API contract.

### 10.3 Test rendered output

Resource helpers MUST test the final synthesized Helm output where rendering behavior is material.

Do not assert only that an object was created if the user consumes generated YAML.

### 10.4 Performance tests

Do not place strict wall-clock assertions under coverage instrumentation.

Performance benchmarks and correctness tests are separate concerns.

## 11. Documentation

Public examples are executable specifications.

Every code example showing a supported TypeScript API SHOULD compile against the current public
declarations.

Do not document an API as recommended, type-safe, or production-ready unless its declarations and
runtime support that claim.

When deprecating an API:

- add `@deprecated` in TypeScript/JSDoc;
- document the replacement;
- stop using it in examples;
- include the migration path in release notes when user action is required.

## 12. SemVer and deprecation

Timonel is a published library; public API changes follow SemVer.

- fixes preserving public contracts: patch;
- backward-compatible public capabilities: minor;
- breaking removals or incompatible signature/behavior changes: major.

Deprecation is preferred before removal when a public API has shipped and has a reasonable chance of
external usage.

Do not create fake `fix` or `feat` commits solely to force a release version.

## 13. Git and pull requests

Use Conventional Commits with the repository's required scope rules.

Examples:

```text
fix(values-ref): align proxy runtime with public types
feat(resources): add typed HPA helper
refactor(rutter): remove synchronous method monkey-patching
docs(agents): define typed-first contribution rules
```

Keep pull requests focused. Do not mix unrelated dependency upgrades, architecture changes, bug
fixes, and release-system changes in the same PR unless they are inseparable.

Do not push directly to protected `main` for normal development. Use a short-lived branch and a PR.

## 14. CI/CD

CI validates code. Publishing is a separate responsibility.

The intended release model is trunk-based:

- `main` is the permanent source branch;
- pull requests target `main`;
- successful `main` builds may publish canary packages;
- stable npm publication requires an explicit release action and production approval;
- package publishing should use npm Trusted Publishing/OIDC rather than long-lived npm tokens.

GitHub Actions MUST be pinned to immutable full commit SHAs.

CI jobs SHOULD run with the minimum permissions required.

## 15. Agent workflow

When an AI agent works on Timonel, it MUST:

1. read this file before modifying the repository;
2. inspect the actual implementation and tests before proposing a fix;
3. reproduce bugs where practical instead of guessing;
4. prefer upstream typed constructs over handwritten YAML or duplicate models;
5. add regression tests for confirmed bugs;
6. validate generated `.d.ts` for public API changes;
7. run appropriate checks before claiming completion;
8. distinguish pre-existing failures from regressions introduced by the change;
9. avoid unrelated cleanup in focused tasks;
10. report any required external configuration that cannot be changed from repository code.

An agent MUST NOT:

- silence a failing test without understanding the cause;
- weaken type safety to make compilation pass;
- add `any` as a shortcut around an API design problem;
- change a public contract silently;
- fabricate compatibility with versions not tested or supported;
- introduce hidden Kubernetes resources;
- bypass branch protections or release approvals for convenience.

## 16. Definition of done

A library change is done only when all applicable statements are true:

- the public API is intentional;
- TypeScript declarations match runtime behavior;
- consumer-facing examples compile;
- final Helm output is correct;
- no hidden resources are generated;
- tests cover the regression or capability;
- lint/typecheck/build pass;
- security implications were considered;
- documentation reflects the real API;
- SemVer impact is understood;
- required CI/release configuration is documented.
