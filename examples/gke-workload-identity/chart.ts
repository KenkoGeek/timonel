import { Rutter } from 'timonel';
import { addGKEHelpers } from 'timonel/gke';
import { valuesRef, helm } from 'timonel/helm';

// Create Rutter with GKE helpers
const rutter = addGKEHelpers(
  new Rutter({
    meta: {
      name: 'gke-workload-identity-example',
      version: '0.1.0',
      description: 'Example GKE Workload Identity deployment with Timonel',
      appVersion: '1.0.0',
    },
    defaultValues: {
      image: { repository: 'gcr.io/google-samples/hello-app', tag: '2.0' },
      replicas: 2,
      service: { port: 8080 },
      workloadIdentity: {
        enabled: true,
        gcpServiceAccountEmail: 'my-service@my-project.iam.gserviceaccount.com',
      },
    },
    envValues: {
      dev: { replicas: 1 },
      prod: { replicas: 3 },
    },
  }),
);

// Add GKE Workload Identity ServiceAccount
rutter.addGKEWorkloadIdentityServiceAccount({
  name: 'workload-identity-sa',
  gcpServiceAccountEmail: String(valuesRef('workloadIdentity.gcpServiceAccountEmail')),
  automountServiceAccountToken: true,
  labels: {
    'app.kubernetes.io/component': 'workload-identity',
  },
});

// Add Deployment using the ServiceAccount
rutter.addDeployment({
  name: 'gke-app',
  image: `${valuesRef('image.repository')}:${valuesRef('image.tag')}`,
  replicas: Number(valuesRef('replicas') as unknown as string) as any,
  containerPort: 8080,
  serviceAccountName: 'workload-identity-sa',
  env: {
    APP_NAME: 'gke-workload-identity-example',
    RELEASE: helm.releaseName,
    // The app can now access Google Cloud APIs using Workload Identity
    GOOGLE_CLOUD_PROJECT: 'my-project',
  },
  resources: {
    requests: { cpu: '100m', memory: '128Mi' },
    limits: { cpu: '500m', memory: '512Mi' },
  },
});

// Add Service
rutter.addService({
  name: 'gke-app-service',
  ports: [
    { port: Number(valuesRef('service.port') as unknown as string) as any, targetPort: 8080 },
  ],
  type: 'ClusterIP',
  selector: { 'app.kubernetes.io/name': 'gke-app' },
});

export default function run(outDir: string) {
  rutter.write(outDir);
}
