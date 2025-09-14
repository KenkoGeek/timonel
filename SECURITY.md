# Security Policy

## Reporting Security Vulnerabilities

**Please report security vulnerabilities responsibly:**

1. **Use GitHub Security Advisories** (preferred): [Report a vulnerability](https://github.com/KenkoGeek/timonel/security/advisories/new)
2. **Email**: [security@kenkogeek.com](mailto:security@kenkogeek.com)
3. **DO NOT** create public issues for security vulnerabilities

**Include in your report:**

- Detailed vulnerability description
- Steps to reproduce
- Potential impact assessment
- Suggested mitigation (if any)

**Response timeline:**

- Initial response: 48 hours
- Triage completion: 5 business days
- Status updates: Every 10 business days

## Supported Versions

We provide security updates for the following versions:

| Version | Supported      | Notes                        |
| ------- | -------------- | ---------------------------- |
| 2.4.0+  | ✅ Current     | Enhanced security features   |
| 2.3.x   | ✅ Supported   | Enhanced security features   |
| 2.0-2.2 | ⚠️ Limited     | Critical security fixes only |
| 1.x.x   | ❌ End of life | No security updates          |
| < 1.0   | ❌ End of life | No security updates          |

## Development Security

### Static Analysis

- TypeScript strict mode enabled with comprehensive compiler checks
- ESLint with security plugin (`eslint-plugin-security`) in CI/CD
- SonarJS plugin for code quality and security analysis
- Automated dependency vulnerability scanning via `pnpm audit`

### Dependencies

- **Automated updates**: Dependabot weekly scans
- **Vulnerability scanning**: `pnpm audit` in CI/CD
- **Zero runtime network calls**: Library operates offline
- **Minimal footprint**: Essential dependencies only
- **Pinned versions**: Exact dependency versions in lockfile

### CI/CD Security

- **Least privilege**: GitHub Actions with minimal GITHUB_TOKEN permissions
- **Integrity checks**: Dependency caching with SHA verification
- **Multi-layer scanning**: ESLint security plugin + CodeQL + pnpm audit
- **Branch protection**: Required status checks and reviews
- **Secrets management**: No hardcoded credentials

### Security Features

- **Input validation**: Comprehensive path traversal prevention and sanitization via SecurityUtils
- **Log injection protection**: All user inputs sanitized before logging
- **Code injection prevention**: Strict validation for dynamic module loading
- **TypeScript strict mode**: Compile-time safety checks
- **No eval()**: Static code generation only
- **File system isolation**: Controlled output directory access with path validation
- **Helm template validation**: Input validation for all template functions
- **Karpenter security**: Secure node pool and scheduling configurations
- **Performance optimization**: Efficient algorithms preventing DoS via resource exhaustion
- **OWASP compliance**: Following secure coding guidelines (CWE-22, CWE-94, CWE-117)

## Security Considerations for Users

- **Generated charts**: Review templates before deployment
- **Values files**: Avoid hardcoded secrets in values
- **Network policies**: Use provided NetworkPolicy helpers
- **RBAC**: Apply principle of least privilege in Kubernetes
