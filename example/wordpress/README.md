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

## Quick Start

1. **Generate the chart:**

   ```bash
   tl synth . ../dist/wordpress
   ```

2. **Deploy to Kubernetes:**

   ```bash
   helm install wordpress ../dist/wordpress
   ```

3. **Deploy with environment-specific values:**

   ```bash
   helm install wordpress ../dist/wordpress -f ../dist/wordpress/values-prod.yaml
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

After deployment, get the external IP:

```bash
kubectl get services wordpress
```

Navigate to the external IP in your browser to complete WordPress setup.
