# AWS 2048 Game Example

This example demonstrates how to use Timonel to create a Helm chart for deploying the AWS 2048
game on Amazon EKS with Application Load Balancer (ALB) ingress.

## Overview

The example creates a complete Kubernetes deployment including:

- **Deployment**: 5 replicas of the 2048 game container
- **Service**: ClusterIP service to expose the deployment
- **Ingress**: ALB ingress for internet-facing load balancer

## Prerequisites

- Amazon EKS cluster with AWS Load Balancer Controller installed
- `kubectl` configured to access your cluster
- Helm 3.x installed
- Proper subnet tags for EKS Auto Mode (if using)

## Quick Start

<!-- markdownlint-disable MD029 -->

1. **Generate the Helm chart**:

```bash
# Install timonel globally or use npx
npm install -g timonel
# OR: npx timonel synth . dist/game-2048

timonel synth . dist/game-2048
```

1. **Deploy to your EKS cluster**:

```bash
# Install the chart
helm install game-2048 dist/game-2048

# Or with environment-specific values
helm install game-2048 dist/game-2048 -f dist/game-2048/values-prod.yaml
```

1. **Get the ALB endpoint**:

```bash
kubectl get ingress -n default
```

1. **Access the game**:

Open your browser and navigate to the ALB endpoint URL.

## Configuration

### Default Values

The chart includes sensible defaults:

- **Replicas**: 5 (configurable per environment)
- **Image**: `public.ecr.aws/l6m2t8p7/docker-2048:latest`
- **Resources**: 0.5 CPU request per pod
- **ALB**: Internet-facing with IP target type

### Environment Values

- **dev**: 2 replicas
- **staging**: 3 replicas  
- **prod**: 5 replicas

### Custom Values

You can override any value in the chart:

```yaml
# custom-values.yaml
deployment:
  replicas: 10
  resources:
    requests:
      cpu: "1.0"
    limits:
      cpu: "2.0"
      memory: "1Gi"

ingress:
  annotations:
    alb.ingress.kubernetes.io/scheme: internal
```

Deploy with custom values:

```bash
helm install game-2048 dist/game-2048 -f custom-values.yaml
```

## Architecture

### Components

1. **ChartFactory**: Main class that orchestrates the chart creation
2. **Deployment**: Manages the 2048 game pods with proper scaling
3. **Service**: Provides stable networking for the pods
4. **Ingress**: Exposes the application via AWS ALB

### Labels and Selectors

The chart uses standard Kubernetes labels:

- `app.kubernetes.io/name`: Application identifier
- `app.kubernetes.io/component`: Component type (frontend)
- `app.kubernetes.io/instance`: Helm release name
- `app.kubernetes.io/managed-by`: Helm

### ALB Configuration

The ingress is configured for AWS ALB with:

- **Scheme**: `internet-facing` (public internet access)
- **Target Type**: `ip` (direct pod routing)
- **Path Type**: `Prefix` (matches all paths starting with `/`)

## Troubleshooting

### Common Issues

#### Image Pull Errors

If you see image pull errors:

```bash
# Check node IAM permissions for ECR access
kubectl describe pod <pod-name>
```

The node IAM role needs ECR read permissions.

#### ALB Not Created

If the ALB doesn't appear:

1. Verify AWS Load Balancer Controller is installed
2. Check subnet tags for public/private identification
3. Verify IAM permissions for ALB creation

#### Service Not Accessible

If the service isn't reachable:

1. Check pod status: `kubectl get pods`
2. Verify service endpoints: `kubectl get endpoints`
3. Check ingress status: `kubectl describe ingress ingress-2048`

### Cleanup

To remove all resources:

```bash
helm uninstall game-2048
```

## Learning Points

This example demonstrates:

1. **Type-safe Helm templating** with Timonel
2. **Multi-environment configuration** with environment-specific values
3. **AWS ALB integration** with proper annotations
4. **Kubernetes best practices** with labels and resource management
5. **Documentation-driven development** with comprehensive comments

## Next Steps

- Modify the chart to add health checks
- Add horizontal pod autoscaling (HPA)
- Implement persistent storage for game state
- Add monitoring and logging configuration
