# Security Fixes: ReDoS Vulnerability Resolution

## Overview

This document describes the security fixes implemented to address ReDoS (Regular Expression Denial of Service) vulnerabilities in the Timonel codebase, specifically related to image tag validation patterns.

## Security Issue Details

- **Vulnerability Type**: CWE-1333 (Inefficient Regular Expression Complexity)
- **Severity**: Medium
- **Risk**: Potential DoS through regex complexity exploitation
- **Affected Components**: Image tag validation patterns

## Vulnerabilities Fixed

### 1. UmbrellaRutter Regex Pattern (FIXED)

**Location**: `src/lib/umbrellaRutter.ts:96`

**Vulnerable Pattern**:
```typescript
/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/
```

**Issue**: Nested quantifiers `(-[a-zA-Z0-9.-]+)?` and `(\+[a-zA-Z0-9.-]+)?` with character class `[a-zA-Z0-9.-]` could cause exponential backtracking.

**Fix**: Replaced with secure validation using `SecurityUtils.validateImageTag()`.

### 2. Missing validateImageTag Function (IMPLEMENTED)

**Location**: `src/lib/security.ts`

**Implementation**: Added comprehensive image tag validation with multiple security layers:
- Input length validation (max 128 characters)
- String-based parsing instead of complex regex
- Character-by-character validation for performance
- Separate validation paths for different tag formats

## Implementation Details

### New Security Function

```typescript
SecurityUtils.validateImageTag(tag: string): boolean
```

**Features**:
- ✅ Input length limits (128 characters max)
- ✅ String-based validation for semantic versions
- ✅ Date format validation using parsing
- ✅ Simple tag validation with character checking
- ✅ ReDoS protection through algorithmic complexity control
- ✅ Comprehensive error handling

**Supported Tag Formats**:
- Semantic versions: `1.0.0`, `v2.1.3`, `1.0.0-alpha.1`
- Date tags: `2023-12-01`, `2024-01-15-beta`
- Simple tags: `latest`, `stable`, `feature-branch`

### Security Measures Implemented

#### 1. Input Length Validation
```typescript
if (tag.length > 128) {
  throw new Error('Image tag exceeds maximum length of 128 characters');
}
```

#### 2. Fast Path Rejection
```typescript
if (tag.includes('..') || tag.includes('//') || tag.includes('\\')) {
  return false;
}
```

#### 3. String-Based Parsing
Instead of complex regex, uses string methods:
```typescript
const parts = cleanTag.split('.');
if (parts.length !== 3) {
  return false;
}
```

#### 4. Character-by-Character Validation
```typescript
for (let i = 0; i < tag.length; i++) {
  const char = tag[i];
  const isValid = (char >= 'a' && char <= 'z') || /* ... */;
  if (!isValid) return false;
}
```

## Performance Characteristics

### Before (Vulnerable)
- Complex regex with nested quantifiers
- Potential exponential time complexity O(2^n)
- Vulnerable to ReDoS attacks

### After (Secure)
- Linear time complexity O(n)
- Predictable performance regardless of input
- Maximum processing time under 100ms for any input

## Usage Examples

### Basic Usage
```typescript
import { SecurityUtils } from 'timonel';

// Valid tags
SecurityUtils.validateImageTag('1.0.0');        // true
SecurityUtils.validateImageTag('v2.1.3');       // true
SecurityUtils.validateImageTag('2023-12-01');   // true
SecurityUtils.validateImageTag('latest');       // true

// Invalid tags
SecurityUtils.validateImageTag('1.2');          // false
SecurityUtils.validateImageTag('invalid@tag');  // false
```

### Error Handling
```typescript
try {
  SecurityUtils.validateImageTag(''); // throws Error
} catch (error) {
  console.log(error.message); // "Image tag must be a non-empty string"
}

try {
  SecurityUtils.validateImageTag('a'.repeat(129)); // throws Error
} catch (error) {
  console.log(error.message); // "Image tag exceeds maximum length of 128 characters"
}
```

### Integration with UmbrellaRutter
```typescript
// Now uses secure validation internally
const umbrella = new UmbrellaRutter({
  meta: {
    name: 'my-chart',
    version: '1.0.0-alpha.1', // Validated securely
    description: 'My umbrella chart'
  },
  subcharts: [/* ... */]
});
```

## Testing

### Comprehensive Test Coverage

**Test Categories**:
- ✅ Valid semantic version tags
- ✅ Valid date tags  
- ✅ Valid simple tags
- ✅ Input validation and security
- ✅ ReDoS protection tests
- ✅ Invalid input rejection
- ✅ Edge cases and boundary conditions
- ✅ Performance benchmarks

**ReDoS Protection Tests**:
```typescript
// These inputs complete in <100ms (previously could cause timeouts)
const maliciousInputs = [
  'a'.repeat(100) + '-' + 'b'.repeat(100),
  '1.2.3-' + 'a-'.repeat(50) + 'end',
  '2023-12-01-' + 'x.'.repeat(50) + 'y'
];
```

### Performance Benchmarks
- Single validation: <10ms
- Batch validation (1000 tags): <1000ms
- Malicious input handling: <100ms

## Backward Compatibility

✅ **Fully backward compatible**
- All previously valid inputs continue to work
- Same API surface for UmbrellaRutter
- No breaking changes to existing functionality
- Enhanced security without functional regression

## Migration Guide

### For Library Users
No changes required - the fixes are transparent and maintain full backward compatibility.

### For Contributors
- Use `SecurityUtils.validateImageTag()` for any new image tag validation
- Avoid complex regex patterns with nested quantifiers
- Follow the established pattern of input validation → string parsing → character validation

## Security Best Practices Applied

1. **Defense in Depth**: Multiple validation layers
2. **Input Sanitization**: Length limits and character validation
3. **Algorithmic Complexity Control**: Linear time algorithms
4. **Fail-Fast**: Early rejection of invalid inputs
5. **Comprehensive Testing**: Security-focused test cases
6. **Performance Monitoring**: Benchmarks for validation speed

## Verification

### Manual Testing
Run the security test script:
```bash
node test-security.js
```

### Automated Testing
```bash
npm run test:unit
```

### Performance Testing
The implementation includes built-in performance tests that verify:
- Individual tag validation completes in <10ms
- Batch validation scales linearly
- Malicious inputs are handled efficiently

## Future Considerations

1. **Monitoring**: Consider adding metrics for validation performance in production
2. **Logging**: Enhanced logging for security events (already implemented via `sanitizeLogMessage`)
3. **Rate Limiting**: Consider rate limiting for validation endpoints if exposed via API
4. **Regular Audits**: Periodic security reviews of validation logic

## References

- [CWE-1333: Inefficient Regular Expression Complexity](https://cwe.mitre.org/data/definitions/1333.html)
- [OWASP Regular Expression DoS Prevention](https://owasp.org/www-community/attacks/Regular_expression_Denial_of_Service_-_ReDoS)
- [Semantic Versioning Specification](https://semver.org/)

---

**Security Contact**: For security-related questions or concerns, please follow the security reporting guidelines in SECURITY.md.