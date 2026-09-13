import { Rutter, type ChartMetadata } from '../../dist/index.js';

const metadata: ChartMetadata = {
  name: 'consumer-chart',
  version: '1.0.0',
  appVersion: '2026.09.13',
  type: 'library',
  kubeVersion: '>=1.30.0-0',
  icon: 'https://example.com/icon.svg',
  dependencies: [
    {
      name: 'redis',
      version: '20.0.0',
      repository: 'https://charts.example.com',
      condition: 'redis.enabled',
      tags: ['cache'],
    },
  ],
};

const rutter = new Rutter({ meta: metadata });
const returned: ChartMetadata = rutter.getMeta();
void returned;

// @ts-expect-error Helm chart type only accepts application or library.
const invalidType: ChartMetadata = { name: 'bad', version: '1.0.0', type: 'service' };
void invalidType;
