// eslint-disable-next-line import/no-unresolved -- Package will be available when published
import { Rutter, valuesRef } from 'timonel';

/**
 * AWS 2048 Game Helm Chart Example
 *
 * This example demonstrates how to use Timonel to create a Helm chart
 * for deploying the AWS 2048 game on EKS with ALB ingress.
 *
 * Based on: https://docs.aws.amazon.com/eks/latest/userguide/auto-elb-example.html
 */

// Create the chart rutter with metadata and values
const rutter = new Rutter({
  meta: {
    name: 'game-2048',
    version: '1.0.0',
    description: 'AWS 2048 game deployment for EKS with ALB ingress',
    appVersion: '1.0.0',
    keywords: ['game', '2048', 'aws', 'eks', 'alb'],
  },
  defaultValues: {
    // Application configuration
    app: {
      name: 'app-2048',
      image: 'public.ecr.aws/l6m2t8p7/docker-2048:latest',
      port: 80,
    },
    // Deployment configuration
    deployment: {
      replicas: 5,
      resources: {
        requests: {
          cpu: '100m',
          memory: '128Mi',
        },
      },
    },
    // Auto-scaling configuration
    autoscaling: {
      enabled: true,
      minReplicas: 2,
      maxReplicas: 10,
      targetCPUUtilization: 70,
    },
    // Service configuration
    service: {
      port: 80,
      targetPort: 80,
    },
    // ALB Ingress configuration
    ingress: {
      enabled: true,
      scheme: 'internet-facing',
      targetType: 'ip',
      healthCheckPath: '/',
    },
  },
  // Environment-specific values
  envValues: {
    dev: {
      deployment: {
        replicas: 2,
      },
      autoscaling: {
        minReplicas: 1,
        maxReplicas: 5,
      },
    },
    staging: {
      deployment: {
        replicas: 3,
      },
      autoscaling: {
        minReplicas: 2,
        maxReplicas: 8,
      },
    },
    prod: {
      deployment: {
        replicas: 5,
      },
      autoscaling: {
        minReplicas: 3,
        maxReplicas: 15,
      },
    },
  },
});

/**
 * Add the 2048 game deployment
 *
 * Creates a Kubernetes Deployment with:
 * - Configurable number of replicas
 * - 2048 game container from public ECR
 * - Resource requests for CPU
 * - Proper labels for service selection
 */
rutter.addDeployment({
  name: valuesRef('app.name') as string,
  image: valuesRef('app.image') as string,
  replicas: 5,
  containerPort: 80,
  resources: {
    requests: {
      cpu: valuesRef('deployment.resources.requests.cpu') as string,
      memory: valuesRef('deployment.resources.requests.memory') as string,
    },
  },
  // Standard Kubernetes labels
  labels: {
    'app.kubernetes.io/component': 'frontend',
  },
  // Pod template labels for service selector
  podLabels: {
    'app.kubernetes.io/name': valuesRef('app.name') as string,
  },
});

/**
 * Add the service to expose the deployment
 *
 * Creates a Kubernetes Service with:
 * - ClusterIP type (default)
 * - Port mapping from service to container
 * - Label selector to find pods
 */
rutter.addService({
  name: 'service-2048',
  ports: [
    {
      port: 80,
      targetPort: 80,
      protocol: 'TCP',
    },
  ],
  selector: {
    'app.kubernetes.io/name': valuesRef('app.name') as string,
  },
});

/**
 * Add AWS ALB Ingress with health checks
 *
 * Creates an AWS Application Load Balancer with:
 * - Internet-facing scheme for public access
 * - IP target type for direct pod routing
 * - Health check configuration
 * - Path-based routing to the service
 */
rutter.addAWSALBIngress({
  name: 'ingress-2048',
  scheme: valuesRef('ingress.scheme') as 'internet-facing' | 'internal',
  targetType: valuesRef('ingress.targetType') as 'ip' | 'instance',
  healthCheckPath: valuesRef('ingress.healthCheckPath') as string,
  healthCheckIntervalSeconds: 30,
  healthyThresholdCount: 2,
  unhealthyThresholdCount: 3,
  tags: {
    Environment: '{{ .Values.global.environment | default "production" }}',
    Application: 'game-2048',
  },
  rules: [
    {
      paths: [
        {
          path: '/',
          pathType: 'Prefix',
          backend: {
            service: {
              name: 'service-2048',
              port: {
                number: 80,
              },
            },
          },
        },
      ],
    },
  ],
});

/**
 * Add Horizontal Pod Autoscaler for automatic scaling
 *
 * Creates an HPA with:
 * - CPU-based scaling at 70% utilization
 * - Configurable min/max replicas per environment
 * - Scaling policies for controlled scale-up/down
 */
rutter.addHorizontalPodAutoscaler({
  name: 'hpa-2048',
  scaleTargetRef: {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    name: valuesRef('app.name') as string,
  },
  minReplicas: 2,
  maxReplicas: 10,
  metrics: [
    {
      type: 'Resource',
      resource: {
        name: 'cpu',
        target: {
          type: 'Utilization',
          averageUtilization: 70,
        },
      },
    },
  ],
  behavior: {
    scaleUp: {
      stabilizationWindowSeconds: 60,
      policies: [
        {
          type: 'Percent',
          value: 100,
          periodSeconds: 15,
        },
        {
          type: 'Pods',
          value: 2,
          periodSeconds: 60,
        },
      ],
      selectPolicy: 'Max',
    },
    scaleDown: {
      stabilizationWindowSeconds: 300,
      policies: [
        {
          type: 'Percent',
          value: 10,
          periodSeconds: 60,
        },
      ],
    },
  },
});

/**
 * Add Pod Disruption Budget for high availability
 *
 * Ensures at least 1 pod remains available during:
 * - Rolling updates
 * - Node maintenance
 * - Cluster scaling events
 */
rutter.addPodDisruptionBudget({
  name: 'pdb-2048',
  minAvailable: 1,
  selector: {
    matchLabels: {
      'app.kubernetes.io/name': valuesRef('app.name') as string,
    },
  },
});

/**
 * Export the synthesis function
 *
 * This function is called by the Timonel CLI to generate the Helm chart
 */
export default function run(outDir: string) {
  rutter.write(outDir);
}

// Export rutter for --set support
export { rutter };
