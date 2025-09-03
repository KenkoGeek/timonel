# WordPress Umbrella Chart Example

This example demonstrates how to use Timonel to create an umbrella chart that combines
multiple subcharts into a single deployable unit.

## Structure

```text
wordpress-umbrella/
├── umbrella.ts              # Main umbrella chart definition
├── charts/
│   ├── mysql/
│   │   └── chart.ts         # MySQL subchart
│   └── wordpress/
│       └── chart.ts         # WordPress subchart
└── README.md
```

## Components

### MySQL Subchart

- MySQL 8.0 database
- Persistent storage for data
- Secret management for passwords
- Resource limits and requests

### WordPress Subchart

- WordPress 6.4 with Apache
- Persistent storage for uploads/themes
- Database connection configuration
- LoadBalancer service (configurable)

## Usage

### 1. Generate the umbrella chart

```bash
cd examples/wordpress-umbrella
tl synth . ./dist
```

This creates:

```text
dist/
├── Chart.yaml              # Umbrella chart metadata with dependencies
├── values.yaml             # Combined values for all subcharts
├── values-dev.yaml         # Development environment values
├── values-prod.yaml        # Production environment values
├── charts/
│   ├── mysql/              # MySQL subchart
│   │   ├── Chart.yaml
│   │   ├── values.yaml
│   │   └── templates/
│   └── wordpress/          # WordPress subchart
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
└── templates/
    └── NOTES.txt
```

### 2. Deploy with Helm

```bash
# Development environment
helm install wordpress-dev ./dist -f ./dist/values-dev.yaml

# Production environment
helm install wordpress-prod ./dist -f ./dist/values-prod.yaml

# Custom values
helm install wordpress ./dist --set mysql.persistence.size=20Gi --set wordpress.service.type=NodePort
```

### 3. Verify deployment

```bash
# Check all components
helm list
kubectl get pods
kubectl get services
kubectl get pvc

# Get WordPress URL (if LoadBalancer)
kubectl get service wordpress -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

## Configuration

### Environment-specific values

**Development (`values-dev.yaml`):**

- Smaller storage sizes (5Gi each)
- NodePort service for WordPress
- Lower resource requests

**Production (`values-prod.yaml`):**

- Larger storage (20Gi MySQL, 50Gi WordPress)
- LoadBalancer service
- Higher resource limits

### Global values

Values under `global:` are shared across all subcharts:

- `storageClass`: Storage class for PVCs
- `namespace`: Target namespace

### Subchart-specific values

Values are namespaced by subchart name:

- `mysql.*`: MySQL configuration
- `wordpress.*`: WordPress configuration

## Customization

### Adding new subcharts

1. Create new subchart directory: `charts/redis/`
2. Add `chart.ts` with Rutter definition
3. Import and add to umbrella in `umbrella.ts`:

```typescript
import { rutter as redis } from './charts/redis/chart';

const umbrella = createUmbrella({
  // ...
  subcharts: [
    { name: 'mysql', rutter: mysql },
    { name: 'wordpress', rutter: wordpress },
    { name: 'redis', rutter: redis },
  ],
});
```

### Modifying resources

Edit the individual subchart files in `charts/*/chart.ts` to modify:

- Resource limits/requests
- Storage sizes
- Environment variables
- Additional Kubernetes resources

## Troubleshooting

### Common issues

1. **PVC not binding**: Check storage class availability
2. **WordPress can't connect to MySQL**: Verify service names and passwords
3. **Pods pending**: Check resource quotas and node capacity

### Debugging commands

```bash
# Check umbrella chart structure
helm template wordpress ./dist

# Debug specific subchart
helm template wordpress ./dist/charts/mysql

# Check generated manifests
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

## Advanced Usage

### Using with CI/CD

```bash
# Validate before deployment
tl validate .

# Generate and package
tl synth . ./dist
helm package ./dist

# Deploy with specific values
helm upgrade --install wordpress ./dist \
  --set mysql.auth.password="$(kubectl get secret mysql-secret -o jsonpath='{.data.mysql-password}' | base64 -d)" \
  --set wordpress.database.password="$(kubectl get secret mysql-secret -o jsonpath='{.data.mysql-password}' | base64 -d)"
```

This example showcases the power of umbrella charts for managing complex,
multi-component applications with Timonel.
