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
          cpu: '0.5',
        },
      },
    },
    // Service configuration
    service: {
      port: 80,
      targetPort: 80,
    },
    // Ingress configuration for ALB
    ingress: {
      enabled: true,
      className: 'alb',
      annotations: {
        scheme: 'internet-facing',
        targetType: 'ip',
      },
    },
  },
  // Environment-specific values
  envValues: {
    dev: {
      deployment: {
        replicas: 2,
      },
    },
    staging: {
      deployment: {
        replicas: 3,
      },
    },
    prod: {
      deployment: {
        replicas: 5,
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
 * Add the ingress for ALB load balancer
 *
 * Creates a Kubernetes Ingress with:
 * - ALB-specific annotations for internet-facing load balancer
 * - IP target type for direct pod routing
 * - Path-based routing to the service
 */
rutter.addIngress({
  name: 'ingress-2048',
  ingressClassName: valuesRef('ingress.className') as string,
  annotations: {
    'alb.ingress.kubernetes.io/scheme': valuesRef('ingress.annotations.scheme') as string,
    'alb.ingress.kubernetes.io/target-type': valuesRef('ingress.annotations.targetType') as string,
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
 * Export the synthesis function
 *
 * This function is called by the Timonel CLI to generate the Helm chart
 */
export default function run(outDir: string) {
  rutter.write(outDir);
}

// Export rutter for --set support
export { rutter };
