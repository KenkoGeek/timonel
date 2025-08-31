#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';

function usageAndExit(msg?: string): never {
  if (msg) console.error(msg);
  console.log(
    [
      'timonel (tl) - programmatic Helm chart generator',
      '',
      'Usage:',
      '  tl init <chart-name>                 Scaffold example at charts/<name>/chart.ts',
      '  tl synth <projectDir> [outDir]       Run charts/<...>/chart.ts and write chart',
      '',
      'Examples:',
      '  tl init my-app',
      '  tl synth charts/my-app charts/my-app/dist',
    ].join('\n'),
  );
  process.exit(msg ? 1 : 0);
}

async function cmdInit(name?: string) {
  if (!name) usageAndExit('Missing <chart-name>');
  const base = path.join(process.cwd(), 'charts', name as string);
  const file = path.join(base, 'chart.ts');
  fs.mkdirSync(base, { recursive: true });
  if (fs.existsSync(file)) {
    console.error(`File already exists: ${file}`);
    process.exit(1);
  }
  fs.writeFileSync(file, exampleChartTs(name));
  console.log(`Scaffold created at ${file}`);
}

async function cmdSynth(projectDir?: string, out?: string) {
  if (!projectDir) usageAndExit('Missing <projectDir>');
  const proj = projectDir as string;
  const chartTs = path.isAbsolute(proj)
    ? path.join(proj, 'chart.ts')
    : path.join(process.cwd(), proj, 'chart.ts');
  if (!fs.existsSync(chartTs)) {
    console.error(`chart.ts not found at ${chartTs}`);
    process.exit(1);
  }
  // Enable TS runtime
  require('ts-node/register/transpile-only');
  const mod = require(chartTs);
  const runner = mod.default || mod.run || mod.synth;
  if (typeof runner !== 'function') {
    console.error('chart.ts must export a default/run/synth function');
    process.exit(1);
  }
  const outDir = out || path.join(path.dirname(chartTs), 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  await Promise.resolve(runner(outDir));
  console.log(`Chart written to ${outDir}`);
}

function exampleChartTs(name: string): string {
  return `import { ChartFactory } from '../../src';
import { valuesRef, helm } from '../../src/lib/helm';

// Define chart metadata and default/env values
const factory = new ChartFactory({
  meta: {
    name: '${name}',
    version: '0.1.0',
    description: 'Example Helm chart generated with timonel + cdk8s',
    appVersion: '1.0.0',
  },
  defaultValues: {
    image: { repository: 'nginx', tag: '1.27' },
    replicas: 1,
    service: { port: 80 },
    ingress: { enabled: false, host: 'example.com', className: 'nginx' },
  },
  envValues: {
    dev: { replicas: 1 },
    prod: { replicas: 3 },
  },
});

// Use Helm placeholders in strings passed to cdk8s constructs
factory.addDeployment({
  name: '${name}',
  image: String(valuesRef('image.repository')) + ':' + String(valuesRef('image.tag')),
  replicas: Number(valuesRef('replicas') as unknown as string) as any,
  containerPort: 80,
  env: {
    APP_NAME: '${name}',
    RELEASE: helm.releaseName,
  },
});

factory.addService({
  name: '${name}',
  port: Number(valuesRef('service.port') as unknown as string) as any,
  targetPort: 80,
  type: 'ClusterIP',
});

// Optional ingress (values.ingress.enabled)
// Helm conditionals can be embedded as comments; template users can wrap templates with if blocks
// Here we just generate an ingress; for real conditional generation you could split assets yourself.
factory.addIngress({
  name: '${name}',
  host: String(valuesRef('ingress.host')),
  serviceName: '${name}',
  servicePort: Number(valuesRef('service.port') as unknown as string) as any,
  className: String(valuesRef('ingress.className')),
});

export default function run(outDir: string) {
  factory.write(outDir);
}
`;
}

async function main() {
  const [, , cmd, arg1, arg2] = process.argv;
  switch (cmd) {
    case 'init':
      await cmdInit(arg1);
      break;
    case 'synth':
      await cmdSynth(arg1, arg2);
      break;
    case '-h':
    case '--help':
    default:
      usageAndExit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
