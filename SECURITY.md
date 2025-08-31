# Security Policy

## Reporting Security Vulnerabilities

- **DO NOT** create public GitHub issues for security vulnerabilities
- Report vulnerabilities privately via project maintainers or GitHub Security Advisories
- Include detailed information about the vulnerability and steps to reproduce
- We aim to triage within 5 business days and provide updates within 10 business days

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Development Security

### Static Analysis

- TypeScript strict mode enabled with comprehensive compiler checks
- ESLint with security plugin (`eslint-plugin-security`) in CI/CD
- SonarJS plugin for code quality and security analysis
- Automated dependency vulnerability scanning via `pnpm audit`

### Dependencies

- Regular dependency updates via Dependabot
- Security-focused dependency management
- No runtime network calls in library APIs
- Minimal dependency footprint

### CI/CD Security

- GitHub Actions with minimal permissions
- Dependency caching with integrity checks
- Automated security audits on every build
- CodeQL analysis for vulnerability detection

### Best Practices

- Input validation and sanitization
- Secure coding practices following OWASP guidelines
- Regular security reviews of code changes
- Principle of least privilege in all configurations
