# Timonel Test Suite

This directory contains comprehensive unit and integration tests for the Timonel library.

## Test Structure

```text
tests/
├── unit/                           # Unit tests
│   ├── __fixtures__/              # Test fixtures (YAML files)
│   ├── __goldens__/               # Golden files for snapshot testing
│   ├── helm.spec.ts               # Helm template helpers tests
│   ├── helmChartWriter.spec.ts    # Chart writer tests
│   ├── helmHelpers.spec.ts        # Helm helpers tests
│   ├── resourceNaming.spec.ts     # Resource naming utilities tests
│   ├── rutter.spec.ts             # Main Rutter class tests
│   └── snapshot.spec.ts           # YAML snapshot tests
├── integration/                    # Integration tests
│   ├── __charts__/                # Generated test charts
│   ├── basic-chart-generation.int.spec.ts  # Basic integration tests
│   └── chart-generation.int.spec.ts        # Full integration tests (requires external tools)
└── README.md                      # This file
```

## Test Categories

### Unit Tests

Unit tests focus on individual functions and classes in isolation:

- **helm.spec.ts**: Tests Helm template helper functions (`valuesRef`, `include`, etc.)
- **helmChartWriter.spec.ts**: Tests the static chart writing functionality
- **helmHelpers.spec.ts**: Tests Helm template helper generation
- **resourceNaming.spec.ts**: Tests Kubernetes resource naming utilities
- **rutter.spec.ts**: Tests the main Rutter class API
- **snapshot.spec.ts**: Tests YAML output consistency with snapshots

### Integration Tests

Integration tests verify end-to-end functionality:

- **basic-chart-generation.int.spec.ts**: Basic integration tests that don't require external tools
- **chart-generation.int.spec.ts**: Full integration tests with Helm, kubectl, and kubeconform validation

## Running Tests

### All Tests
```bash
pnpm test
```

### Unit Tests Only
```bash
pnpm test:unit
```

### Integration Tests Only
```bash
pnpm test:integration
```

### Basic Integration Tests (No External Tools Required)
```bash
pnpm test:basic-integration
```

### Watch Mode
```bash
pnpm test:watch
```

### Coverage Report
```bash
pnpm test:coverage
```

## Test Features

### Comprehensive Coverage

- **API Coverage**: Tests all public methods of Rutter, HelmChartWriter, and helper functions
- **Edge Cases**: Handles zero values, null values, empty configurations, and special characters
- **Error Handling**: Validates error conditions and input validation
- **YAML Generation**: Verifies correct YAML structure and content

### Snapshot Testing

- **Consistent Output**: Uses normalized YAML snapshots to ensure consistent output
- **Golden Files**: Reference files for expected YAML structure
- **Regression Prevention**: Catches unintended changes in generated output

### Integration Validation

- **Chart Structure**: Verifies complete Helm chart directory structure
- **YAML Validity**: Ensures all generated YAML files are parseable
- **Template Rendering**: Tests Helm template expressions and value substitution
- **Multi-Environment**: Validates environment-specific values files

### External Tool Integration (Optional)

When available, integration tests also validate with:

- **Helm**: `helm lint` and `helm template` validation
- **kubectl**: `kubectl --dry-run=client` validation  
- **kubeconform**: Schema validation against Kubernetes API

## Test Configuration

### Vitest Configuration

- **vitest.config.ts**: Unit test configuration with coverage reporting
- **vitest.integration.config.ts**: Integration test configuration with longer timeouts

### Coverage Thresholds

- Branches: 90%
- Functions: 90%
- Lines: 90%
- Statements: 90%

## Mocking Strategy

### Filesystem Mocking

Unit tests mock the filesystem to:
- Avoid actual file I/O during testing
- Verify correct file paths and content
- Enable fast, isolated testing

### Security Validation

Tests respect the library's security constraints:
- Output paths must be within the project directory
- Helm template paths are validated for safety
- Kubernetes names follow RFC 1123 conventions

## Best Practices

### Test Organization

- **Descriptive Names**: Test names clearly describe what is being tested
- **Grouped Tests**: Related tests are grouped using `describe` blocks
- **Setup/Teardown**: Proper cleanup of test artifacts

### Edge Case Testing

- **Zero Values**: Port 0, 0 replicas, empty configurations
- **Null/Undefined**: Handling of missing or null values
- **Special Characters**: Unicode, quotes, backslashes in values
- **Long Names**: Kubernetes name length limits

### Snapshot Management

- **Normalization**: YAML content is normalized for consistent snapshots
- **Key Sorting**: Object keys are sorted alphabetically
- **Dynamic Field Removal**: Timestamps and other dynamic fields are removed

## CI/CD Integration

The test suite is integrated with GitHub Actions:

- **Unit Tests**: Run on every push and PR
- **Integration Tests**: Run with external tool installation
- **Coverage Reporting**: Uploaded to Codecov
- **Multi-Node Testing**: Tests on Node.js 20 and 22

## Troubleshooting

### Common Issues

1. **Path Validation Errors**: Ensure test output paths are within the project directory
2. **Construct Name Conflicts**: Use unique names for CDK8s constructs in tests
3. **External Tool Dependencies**: Integration tests skip when tools are unavailable
4. **Snapshot Mismatches**: Run tests locally to update snapshots if needed

### Debugging Tests

```bash
# Run specific test file
npx vitest run tests/unit/rutter.spec.ts

# Run with debug output
DEBUG=* pnpm test:unit

# Update snapshots
npx vitest run --update-snapshots
```

## Contributing

When adding new tests:

1. Follow the existing naming conventions
2. Add both positive and negative test cases
3. Include edge case testing
4. Update snapshots if output format changes
5. Ensure tests are deterministic and isolated
