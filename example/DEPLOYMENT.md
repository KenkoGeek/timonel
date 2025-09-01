# Deployment Guide

This guide walks you through deploying the 2048 game to Amazon EKS using the Timonel-generated Helm chart.

## Prerequisites Setup

### 1. EKS Cluster

Create an EKS cluster with the AWS Load Balancer Controller:

```bash
# Create cluster with eksctl
eksctl create cluster --name game-cluster --region us-east-2

# Install AWS Load Balancer Controller
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller//crds?ref=master"

helm repo add eks https://aws.github.io/eks-charts
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=game-cluster \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

### 2. Subnet Tags

Ensure your subnets have proper tags for ALB:

```bash
# Public subnets
aws ec2 create-tags --resources subnet-xxxxx --tags Key=kubernetes.io/role/elb,Value=1

# Private subnets
aws ec2 create-tags --resources subnet-xxxxx --tags Key=kubernetes.io/role/internal-elb,Value=1
```

## Step-by-Step Deployment

### Step 1: Generate the Helm Chart

From the example directory:

```bash
cd example
npm run synth
```

This creates the Helm chart in `../dist/game-2048/` with:

- `Chart.yaml` - Chart metadata
- `values.yaml` - Default configuration
- `values-dev.yaml`, `values-prod.yaml` - Environment configs
- `templates/` - Kubernetes manifests

### Step 2: Review Generated Files

Check the generated chart structure:

```bash
tree ../dist/game-2048/
```

Review the values:

```bash
cat ../dist/game-2048/values.yaml
cat ../dist/game-2048/values-prod.yaml
```

### Step 3: Deploy to Development

Deploy with development settings (2 replicas):

```bash
npm run deploy:dev
```

Or manually:

```bash
helm install game-2048-dev ../dist/game-2048 -f ../dist/game-2048/values-dev.yaml
```

### Step 4: Verify Deployment

Check all resources:

```bash
npm run status
```

Check pod logs:

```bash
npm run logs
```

Get the ALB endpoint:

```bash
kubectl get ingress
```

### Step 5: Test the Application

1. Wait 2-3 minutes for ALB provisioning
2. Copy the ALB endpoint from ingress output
3. Open in browser: `http://<alb-endpoint>`
4. You should see the 2048 game interface

### Step 6: Deploy to Production

For production deployment with 5 replicas:

```bash
npm run deploy:prod
```

## Monitoring and Management

### Check Application Health

```bash
# Pod status
kubectl get pods -l app.kubernetes.io/name=app-2048

# Service endpoints
kubectl get endpoints

# Ingress details
kubectl describe ingress ingress-2048
```

### View Logs

```bash
# All pod logs
kubectl logs -l app.kubernetes.io/name=app-2048

# Specific pod logs
kubectl logs <pod-name>

# Follow logs
kubectl logs -f -l app.kubernetes.io/name=app-2048
```

### Scale the Application

Update replicas in values and upgrade:

```bash
# Edit values file
vim ../dist/game-2048/values.yaml

# Upgrade deployment
npm run upgrade
```

## Troubleshooting

### ALB Not Created

1. **Check Load Balancer Controller**:

   ```bash
   kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
   ```

2. **Verify IAM Permissions**:
   - Node group IAM role needs ALB permissions
   - Load Balancer Controller service account needs proper IAM role

3. **Check Subnet Tags**:

   ```bash
   aws ec2 describe-subnets --subnet-ids subnet-xxxxx --query 'Subnets[0].Tags'
   ```

### Pods Not Starting

1. **Check Image Pull**:

   ```bash
   kubectl describe pod <pod-name>
   ```

2. **Verify ECR Permissions**:
   - Node IAM role needs ECR read permissions
   - Image architecture must match node architecture

3. **Resource Constraints**:

   ```bash
   kubectl top nodes
   kubectl describe nodes
   ```

### Service Not Reachable

1. **Check Service**:

   ```bash
   kubectl get svc service-2048
   kubectl describe svc service-2048
   ```

2. **Verify Endpoints**:

   ```bash
   kubectl get endpoints service-2048
   ```

3. **Test Internal Connectivity**:

   ```bash
   kubectl run test-pod --image=busybox --rm -it -- wget -qO- service-2048
   ```

## Cleanup

Remove all resources:

```bash
npm run uninstall
```

Or manually:

```bash
helm uninstall game-2048-dev
helm uninstall game-2048-prod
```

## Advanced Configuration

### Custom Domain

Add custom domain to ingress:

```yaml
# custom-values.yaml
ingress:
  annotations:
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:region:account:certificate/cert-id
  rules:
    - host: game.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: service-2048
                port:
                  number: 80
```

### Health Checks

Add health checks to deployment:

```yaml
# custom-values.yaml
deployment:
  healthCheck:
    enabled: true
    path: /
    port: 80
```

### Resource Limits

Set resource limits:

```yaml
# custom-values.yaml
deployment:
  resources:
    requests:
      cpu: "0.5"
      memory: "256Mi"
    limits:
      cpu: "1.0"
      memory: "512Mi"
```
