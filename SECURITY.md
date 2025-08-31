# Security Policy

- Report vulnerabilities privately via project maintainers.
- Avoid disclosing publicly until a fix is available.
- We aim to triage within 5 business days.

## Development security

- TypeScript strict mode enabled.
- ESLint with `security` plugin in CI.
- `npm audit` runs in CI (best-effort).
- No runtime network calls in library APIs.
