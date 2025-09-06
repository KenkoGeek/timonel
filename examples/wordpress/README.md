# WordPress with MySQL Helm Chart

This example demonstrates deploying WordPress with MySQL database using Timonel.

## Features

- WordPress 6.4.0 with Apache
- MySQL 8.0 database
- Persistent storage for MySQL
- Secrets management for database credentials
- Multi-environment configuration (dev/staging/prod)
- Resource requests and limits
- LoadBalancer service
- **Custom Manifest Naming**: Single file organization with `manifestName: 'wordpress-app'`

## Quick Start

1. **Generate the chart:**

   ```bash
   # From project root
   pnpm tl synth examples/wordpress wordpress-chart
   ```

   This generates a single manifest file `templates/wordpress-app.yaml` containing all
   resources,
   thanks to the custom manifest naming configuration (`manifestName: 'wordpress-app'`,
   `singleManifestFile: true`).

2. **Deploy to Kubernetes:**

   ```bash
   # Production deployment with LoadBalancer
   helm install wordpress wordpress-chart -f wordpress-chart/values-prod.yaml

   # Development deployment
   helm install wordpress wordpress-chart -f wordpress-chart/values-dev.yaml

   # Local/Kind deployment with NodePort
   helm install wordpress wordpress-chart \
     -f wordpress-chart/values-dev.yaml \
     --set service.type=NodePort
   ```

## Configuration

### WordPress Settings

- `wordpress.image`: WordPress Docker image
- `wordpress.replicas`: Number of WordPress pods
- `wordpress.resources`: CPU and memory requests

### MySQL Settings

- `mysql.image`: MySQL Docker image
- `mysql.rootPassword`: MySQL root password
- `mysql.database`: WordPress database name
- `mysql.user`: WordPress database user
- `mysql.password`: WordPress database password
- `mysql.storage`: Persistent volume size

### Service Settings

- `service.type`: Kubernetes service type (LoadBalancer, ClusterIP, NodePort)
- `service.port`: Service port

## Environment Configurations

- **dev**: 1 WordPress replica, 5Gi MySQL storage
- **staging**: 2 WordPress replicas, 8Gi MySQL storage
- **prod**: 3 WordPress replicas, 20Gi MySQL storage

## Security Notes

⚠️ **Important**: Change default passwords in production!

Update `mysql.rootPassword` and `mysql.password` values before deploying to production.

## Accessing WordPress

After deployment:

**For LoadBalancer service:**

```bash
kubectl get services wordpress-service
# Navigate to EXTERNAL-IP in browser
```

**For NodePort or local access:**

```bash
kubectl port-forward svc/wordpress-service 8080:80
open http://localhost:8080
```

**Check deployment status:**

```bash
kubectl get pods
kubectl get pvc
```
