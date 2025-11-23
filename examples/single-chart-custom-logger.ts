import { Rutter } from '../src/lib/rutter.js';
import { createLogger, LogLevel } from '../src/lib/utils/logger.js';

// Create a custom logger with debug level
const customLogger = createLogger('custom-chart', {
  level: LogLevel.DEBUG,
  base: { customField: 'example-value' },
});

customLogger.info('Starting single chart example with custom logger');

const chart = new Rutter({
  meta: {
    name: 'example-chart',
    version: '0.1.0',
    description: 'An example chart with custom logger',
  },
  logger: customLogger, // Inject custom logger
});

chart.addManifest(
  {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name: 'example-config' },
    data: { key: 'value' },
  },
  'example-config',
);

console.log('Chart initialized with custom logger');
