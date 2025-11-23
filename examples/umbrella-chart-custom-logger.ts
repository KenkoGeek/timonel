import { createUmbrella } from '../src/lib/umbrella.js';
import { Rutter } from '../src/lib/rutter.js';
import { createLogger, LogLevel } from '../src/lib/utils/logger.js';

// Create a custom logger
const customLogger = createLogger('custom-umbrella', {
  level: LogLevel.INFO,
  base: { environment: 'production' },
});

customLogger.info('Starting umbrella chart example with custom logger');

// Create a subchart
const subchart = new Rutter({
  meta: {
    name: 'backend',
    version: '1.0.0',
    description: 'Backend service',
  },
  logger: customLogger, // Inject logger into subchart
});

subchart.addManifest(
  {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: { name: 'backend' },
    spec: { ports: [{ port: 80 }] },
  },
  'backend-service',
);

// Create umbrella chart
// Note: createUmbrella might need updates to accept logger if it initializes Rutter internally
// Let's check createUmbrella implementation.
// If createUmbrella just takes Rutter instances, then we are good for subcharts.
// But the umbrella itself is also a Rutter instance created inside createUmbrella?
// I need to check src/lib/umbrella.ts to see if I need to update it too.

// Assuming I might need to update createUmbrella to accept logger props.
// For now, I'll write this and then check umbrella.ts.

const umbrella = createUmbrella({
  meta: {
    name: 'my-app',
    version: '1.0.0',
    description: 'My App Umbrella',
  },
  subcharts: [
    {
      name: 'backend',
      rutter: subchart,
      version: '1.0.0',
    },
  ],
  // If createUmbrella accepts extra props that are passed to Rutter, I can pass logger here.
  // I will verify this in the next step.
  logger: customLogger,
} as any); // Cast to any for now until I update the type if needed

console.log('Umbrella chart initialized with custom logger');
