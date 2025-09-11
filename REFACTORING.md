# Timonel Architecture Refactoring

This document describes the refactored architecture of Timonel, implementing a modular
design that improves maintainability, testability, and extensibility while maintaining
full backward compatibility.

## 🎯 Objectives

- **Separation of Concerns**: Split monolithic `Rutter.ts` into specialized providers
- **Maintainability**: Reduce cognitive complexity and improve code organization
- **Testability**: Enable granular unit testing of individual components
- **Extensibility**: Simplify adding new cloud providers and resource types
- **Zero Breaking Changes**: Maintain identical public API for existing users

## 🏗️ New Architecture

### Directory Structure

```text
src/lib/resources/
├── BaseResourceProvider.ts          # Base class with common functionality
├── core/
│   ├── CoreResources.ts             # Deployment, Service, ConfigMap, etc.
│   └── StorageResources.ts          # PV, PVC, StorageClass
├── cloud/
│   ├── aws/
│   │   └── AWSResources.ts          # EBS, EFS, ALB, IRSA
│   ├── azure/
│   │   └── AzureResources.ts        # AGIC, WorkloadIdentity, KeyVault
│   └── gcp/
│       └── GCPResources.ts          # GKE, GCE LoadBalancer
└── autoscaling/
    └── AutoscalingResources.ts      # HPA, VPA, PDB
```

### Key Components

#### BaseResourceProvider

- Common validation logic
- Kubernetes naming conventions
- Label validation
- Standardized ApiObject creation

#### CoreResources

- Fundamental Kubernetes resources
- Deployment, Service, ConfigMap, Secret, ServiceAccount
- No cloud-specific dependencies

#### StorageResources

- Storage-related resources
- PersistentVolume, PersistentVolumeClaim, StorageClass
- Generic storage patterns

#### Cloud Providers

- **AWSResources**: EBS, EFS, ALB, IRSA integrations
- **AzureResources**: AGIC, Workload Identity, Key Vault
- **GCPResources**: GKE, GCE Load Balancer, Artifact Registry

## 🔄 Migration Strategy

### Phase 1: Parallel Implementation ✅

- Create new modular architecture alongside existing code
- Implement `RutterRefactored` class with identical API
- Maintain full backward compatibility

### Phase 2: Gradual Migration (Future)

- Migrate existing `Rutter` class to use new providers internally
- Deprecate old implementation gradually
- Provide migration guides for advanced users

### Phase 3: Cleanup (Future)

- Remove deprecated code after sufficient adoption period
- Optimize performance and reduce bundle size

## 📊 Benefits Achieved

### Before Refactoring

- **Single File**: 179,905 bytes in `Rutter.ts`
- **40+ Methods**: All mixed together in one class
- **Multiple Responsibilities**: Core K8s, AWS, Azure, GCP, networking, security
- **Testing Challenges**: Difficult to test individual components
- **Maintenance Issues**: Changes affect unrelated functionality

### After Refactoring

- **Modular Design**: Separated into focused providers
- **Single Responsibility**: Each provider handles one domain
- **Better Testing**: Granular unit tests possible
- **Easier Maintenance**: Changes isolated to relevant providers
- **Extensibility**: Simple to add new providers or resources

## 🚀 Usage Examples

### Basic Usage (Identical API)

```typescript
import { RutterRefactored as Rutter } from 'timonel';

const rutter = new Rutter({
  meta: { name: 'my-app', version: '1.0.0' },
  defaultValues: { replicas: 2 },
});

// Same API as before
rutter.addDeployment({ name: 'web', image: 'nginx:1.21' });
rutter.addService({ name: 'web-svc', port: 80 });
```

### Advanced Usage with Multiple Providers

```typescript
// Core Kubernetes resources
rutter.addDeployment({ name: 'app', image: 'myapp:v1' });
rutter.addConfigMap({ name: 'config', data: { key: 'value' } });

// Storage resources
rutter.addPersistentVolumeClaim({
  name: 'data',
  size: '10Gi',
  accessModes: ['ReadWriteOnce'],
});

// AWS-specific resources
rutter.addAWSEBSStorageClass({
  name: 'fast-ssd',
  volumeType: 'gp3',
  encrypted: true,
});

// All providers work seamlessly together
```

## 🧪 Testing Strategy

### Unit Testing

```typescript
// Test individual providers in isolation
describe('CoreResources', () => {
  let chart: Chart;
  let coreResources: CoreResources;

  beforeEach(() => {
    chart = new Chart(new Construct(undefined!, 'test'), 'test');
    coreResources = new CoreResources(chart);
  });

  it('should create deployment with correct spec', () => {
    const deployment = coreResources.addDeployment({
      name: 'test-app',
      image: 'nginx:1.21',
      replicas: 3,
    });

    expect(deployment.spec.replicas).toBe(3);
  });
});
```

### Integration Testing

```typescript
// Test provider interactions
describe('RutterRefactored Integration', () => {
  it('should coordinate between providers', () => {
    const rutter = new RutterRefactored({
      meta: { name: 'test', version: '1.0.0' },
    });

    // Test cross-provider functionality
    rutter.addDeployment({ name: 'app', image: 'nginx' });
    rutter.addAWSEBSStorageClass({ name: 'storage' });

    // Verify both resources are created correctly
  });
});
```

## 🔒 Security Improvements

### Input Validation

- Centralized validation in `BaseResourceProvider`
- Kubernetes naming convention enforcement
- Label format validation
- Path traversal prevention

### Type Safety

- Strict TypeScript interfaces for all specifications
- Compile-time validation of resource configurations
- Reduced runtime errors through better typing

## 📈 Performance Considerations

### Bundle Size

- Tree-shaking friendly: Import only needed providers
- Reduced memory footprint per provider
- Lazy loading potential for cloud-specific providers

### Runtime Performance

- Faster instantiation with focused providers
- Reduced method lookup time
- Better V8 optimization opportunities

## 🔮 Future Enhancements

### New Providers

- **OnPremResources**: Bare metal, VMware integrations
- **SecurityResources**: RBAC, Pod Security Standards
- **MonitoringResources**: Prometheus, Grafana operators

### Advanced Features

- Provider plugins system
- Custom resource validation
- Multi-cloud resource orchestration
- Resource dependency management

## 📝 Migration Guide

### For Library Users

No changes required! The refactored version maintains 100% API compatibility:

```typescript
// This code works with both versions
const rutter = new Rutter({
  meta: { name: 'app', version: '1.0.0' },
});

rutter.addDeployment({ name: 'web', image: 'nginx' });
rutter.addService({ name: 'web-svc', port: 80 });
```

### For Contributors

When adding new resources:

1. **Identify the appropriate provider** (core, aws, azure, gcp)
2. **Add the resource method** to the provider class
3. **Export the interface** from the provider
4. **Add the method** to `RutterRefactored` class
5. **Write unit tests** for the provider method
6. **Update documentation** with examples

## 🎉 Conclusion

The refactored architecture provides a solid foundation for Timonel's continued growth
while maintaining the simplicity and power that users expect. The modular design enables
better collaboration, easier testing, and faster feature development without sacrificing
backward compatibility.
