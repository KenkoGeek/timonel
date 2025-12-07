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
- Affected versions

**Response timeline:**

- Initial response: 48 hours
- Triage completion: 5 business days
- Status updates: Every 10 business days
- Fix timeline: Depends on severity (Critical: 72h, High: 1 week, Medium: 2 weeks)

**Severity levels:**

- **Critical**: Remote code execution, privilege escalation, data breach
- **High**: Authentication bypass, significant data exposure
- **Medium**: Information disclosure, denial of service
- **Low**: Minor information leakage, cosmetic issues

## Supported Versions

We provide security updates for the following versions:

<!-- markdownlint-disable MD060 -->

| Version      | Supported      | Security Updates | End of Life |
| ------------ | -------------- | ---------------- | ----------- |
| 3.0.0-beta.1 | ✅ Current     | Full support     | TBD         |
| 2.14.x       | ✅ Supported   | Full support     | TBD         |
| 2.8.0-2.13.x | ✅ Supported   | Full support     | 2025-06-30  |
| 2.0-2.7.x    | ⚠️ Limited     | Critical only    | 2025-03-31  |
| 1.x.x        | ❌ End of life | None             | 2024-06-30  |
| < 1.0        | ❌ End of life | None             | 2024-01-01  |

**Update policy:**

- **Current versions**: All security updates within 48 hours
- **Supported versions**: Critical updates within 1 week
- **Limited versions**: Critical updates only, within 2 weeks
- **End of life**: No updates provided

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
- **Native dependencies**: Uses `workflow_run` for secure pipeline dependencies
- **Environment protection**: Production releases require manual approval
- **Automated security**: Security scans run on every PR and push
- **Dependency provenance**: NPM_CONFIG_PROVENANCE enabled for package integrity

### Security Features

- **Input validation**: Comprehensive path traversal prevention and sanitization via SecurityUtils
  - CWE-22/23: Path traversal protection with URL-encoded sequence detection
  - CWE-20: Proper input validation for CLI flags (--set, --env)
  - Null byte injection prevention
  - Reserved key validation in resource providers
- **Log injection protection**: All user inputs sanitized before logging (CWE-117)
- **Code injection prevention**: Strict validation for dynamic module loading (CWE-94)
  - Regex escaping for dynamic pattern construction
  - Function name validation before template generation
- **Command injection prevention**: Validated inputs for all shell commands (CWE-78/77/88)
  - Release name validation (RFC 1123 subdomain)
  - Namespace validation (Kubernetes naming rules)
  - --set flag validation with support for nested paths and arrays
- **TypeScript strict mode**: Compile-time safety checks with all strict options enabled
- **No eval()**: Static code generation only
- **File system isolation**: Controlled output directory access with path validation
  - Absolute path support with explicit allowAbsolute flag
  - Base directory validation for all file operations
- **Helm template validation**: Input validation for all template functions
- **Karpenter security**: Secure node pool and scheduling configurations
- **Performance optimization**: Efficient algorithms preventing DoS via resource exhaustion
- **OWASP compliance**: Following secure coding guidelines (CWE-22, CWE-23, CWE-94, CWE-117, CWE-78, CWE-77, CWE-88, CWE-20)

## Security Considerations for Users

- **Generated charts**: Review templates before deployment
- **Values files**: Avoid hardcoded secrets in values
- **Network policies**: Use provided NetworkPolicy helpers
- **RBAC**: Apply principle of least privilege in Kubernetes

## Security Best Practices

### For Developers

- **Keep dependencies updated**: Run `pnpm audit` regularly
- **Review PRs carefully**: Check for security implications
- **Use security tools**: Enable IDE security plugins
- **Follow secure coding**: Avoid dangerous patterns (eval, innerHTML, etc.)
- **Test security features**: Verify input validation and sanitization

### For Users

- **Update regularly**: Always use the latest stable version
- **Review configurations**: Check generated Helm charts before deployment
- **Use secrets management**: Never hardcode credentials
- **Monitor deployments**: Watch for unusual behavior
- **Apply patches**: Install security updates promptly

## Security Tools Integration

- **GitHub Dependabot**: Automated dependency updates
- **CodeQL**: Static analysis for security vulnerabilities
- **ESLint Security**: Runtime security checks
- **pnpm audit**: Dependency vulnerability scanning
- **Semantic Release**: Automated versioning with security considerations
