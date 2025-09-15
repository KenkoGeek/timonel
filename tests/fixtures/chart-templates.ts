/**
 * Test fixtures for chart templates and configurations
 */

// Types
interface IngressHost {
  host: string;
  paths: Array<{
    path: string;
    pathType: string;
  }>;
}

interface SubchartConfig {
  name: string;
  path: string;
  enabled: boolean;
  values?: Record<string, unknown>;
}

interface UmbrellaConfig {
  name: string;
  version: string;
  description: string;
  subcharts: SubchartConfig[];
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  main: string;
  scripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export const BASIC_CHART_TEMPLATE = `import { Rutter, helm } from 'timonel';

const rutter = new Rutter();

rutter.metadata = {
  name: '{{CHART_NAME}}',
  version: '0.1.0',
  description: 'A Helm chart for {{CHART_NAME}}'
};

rutter.values = {
  replicaCount: 1,
  image: {
    repository: 'nginx',
    pullPolicy: 'IfNotPresent',
    tag: 'latest'
  },
  service: {
    type: 'ClusterIP',
    port: 80
  },
  ingress: {
    enabled: false,
    className: '',
    annotations: {},
    hosts: [
      {
        host: 'chart-example.local',
        paths: [
          {
            path: '/',
            pathType: 'Prefix'
          }
        ]
      }
    ],
    tls: []
  },
  resources: {},
  nodeSelector: {},
  tolerations: [],
  affinity: {}
};

// Add Deployment
rutter.add(helm.deployment({
  metadata: {
    name: '{{CHART_NAME}}',
    labels: {
      app: '{{CHART_NAME}}'
    }
  },
  spec: {
    replicas: rutter.values.replicaCount,
    selector: {
      matchLabels: {
        app: '{{CHART_NAME}}'
      }
    },
    template: {
      metadata: {
        labels: {
          app: '{{CHART_NAME}}'
        }
      },
      spec: {
        containers: [
          {
            name: '{{CHART_NAME}}',
            image: \`\${rutter.values.image.repository}:\${rutter.values.image.tag}\`,
            imagePullPolicy: rutter.values.image.pullPolicy,
            ports: [
              {
                name: 'http',
                containerPort: 80,
                protocol: 'TCP'
              }
            ],
            resources: rutter.values.resources
          }
        ]
      }
    }
  }
}));

// Add Service
rutter.add(helm.service({
  metadata: {
    name: '{{CHART_NAME}}',
    labels: {
      app: '{{CHART_NAME}}'
    }
  },
  spec: {
    type: rutter.values.service.type,
    ports: [
      {
        port: rutter.values.service.port,
        targetPort: 'http',
        protocol: 'TCP',
        name: 'http'
      }
    ],
    selector: {
      app: '{{CHART_NAME}}'
    }
  }
}));

// Add Ingress (conditional)
if (rutter.values.ingress.enabled) {
  rutter.add(helm.ingress({
    metadata: {
      name: '{{CHART_NAME}}',
      labels: {
        app: '{{CHART_NAME}}'
      },
      annotations: rutter.values.ingress.annotations
    },
    spec: {
      ingressClassName: rutter.values.ingress.className,
      tls: rutter.values.ingress.tls,
      rules: rutter.values.ingress.hosts.map((host: IngressHost) => ({
        host: host.host,
        http: {
          paths: host.paths.map((path: { path: string; pathType: string }) => ({
            path: path.path,
            pathType: path.pathType,
            backend: {
              service: {
                name: '{{CHART_NAME}}',
                port: {
                  number: rutter.values.service.port
                }
              }
            }
          }))
        }
      }))
    }
  }));
}

export const run = () => {
  rutter.write();
};

if (require.main === module) {
  run();
}
`;

export const UMBRELLA_CONFIG_TEMPLATE = {
  name: '{{UMBRELLA_NAME}}',
  version: '0.1.0',
  description: 'Umbrella chart for {{UMBRELLA_NAME}}',
  subcharts: [] as SubchartConfig[],
};

export const UMBRELLA_CHART_TEMPLATE = `import { Rutter, helm } from 'timonel';
import * as fs from 'fs';
import * as path from 'path';

const rutter = new Rutter();

// Load umbrella configuration
const configPath = path.join(__dirname, 'umbrella.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

rutter.metadata = {
  name: config.name,
  version: config.version,
  description: config.description
};

rutter.values = {
  global: {},
  subcharts: {}
};

// Process each subchart
for (const subchart of config.subcharts) {
  if (subchart.enabled) {
    // Import subchart
    const subchartPath = path.resolve(subchart.path);
    const subchartModule = require(path.join(subchartPath, 'chart.ts'));
    
    // Add subchart values
    if (subchart.values) {
      rutter.values.subcharts[subchart.name] = subchart.values;
    }
    
    // Execute subchart
    if (typeof subchartModule.run === 'function') {
      subchartModule.run();
    }
  }
}

export const run = () => {
  rutter.write();
};

if (require.main === module) {
  run();
}
`;

export const PACKAGE_JSON_TEMPLATE = {
  name: '{{PROJECT_NAME}}',
  version: '1.0.0',
  description: 'Timonel project',
  main: 'index.js',
  scripts: {
    test: 'vitest',
    build: 'tsc',
    dev: 'tsx watch src/index.ts',
  },
  dependencies: {
    timonel: '^1.0.0',
  },
  devDependencies: {
    '@types/node': '^20.0.0',
    typescript: '^5.0.0',
    tsx: '^4.0.0',
    vitest: '^1.0.0',
  },
};

export const HELM_VALUES_TEMPLATE = {
  replicaCount: 1,
  image: {
    repository: 'nginx',
    pullPolicy: 'IfNotPresent',
    tag: 'latest',
  },
  nameOverride: '',
  fullnameOverride: '',
  service: {
    type: 'ClusterIP',
    port: 80,
  },
  ingress: {
    enabled: false,
    className: '',
    annotations: {},
    hosts: [
      {
        host: 'chart-example.local',
        paths: [
          {
            path: '/',
            pathType: 'Prefix',
          },
        ],
      },
    ],
    tls: [],
  },
  resources: {
    limits: {
      cpu: '100m',
      memory: '128Mi',
    },
    requests: {
      cpu: '100m',
      memory: '128Mi',
    },
  },
  nodeSelector: {},
  tolerations: [],
  affinity: {},
};

/**
 * Helper function to create a chart template with specific name
 */
export function createChartTemplate(chartName: string): string {
  return BASIC_CHART_TEMPLATE.replace(/{{CHART_NAME}}/g, chartName);
}

/**
 * Helper function to create umbrella config with specific name
 */
export function createUmbrellaConfig(umbrellaName: string): UmbrellaConfig {
  const config = JSON.parse(JSON.stringify(UMBRELLA_CONFIG_TEMPLATE));
  config.name = umbrellaName;
  config.description = `Umbrella chart for ${umbrellaName}`;
  return config;
}

/**
 * Helper function to create umbrella chart template
 */
export function createUmbrellaTemplate(): string {
  return UMBRELLA_CHART_TEMPLATE;
}

/**
 * Helper function to create package.json with specific project name
 */
export function createPackageJson(projectName: string): PackageJson {
  const pkg = JSON.parse(JSON.stringify(PACKAGE_JSON_TEMPLATE));
  pkg.name = projectName;
  return pkg;
}
