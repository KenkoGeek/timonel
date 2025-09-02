#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as cp from 'child_process';

function usageAndExit(msg?: string): never {
  if (msg) console.error(msg);
  console.log(
    [
      'timonel (tl) - programmatic Helm chart generator',
      '',
      'Usage:',
      '  tl init <chart-name>                 Scaffold example at charts/<name>/chart.ts',
      '  tl synth <projectDir> [outDir]       Run charts/<...>/chart.ts and write chart',
      '  tl validate <projectDir>             Validate chart.ts without generating files',
      '  tl diff <projectDir> <chartDir>      Compare generated chart with existing',
      '  tl deploy <projectDir> <release>     Synth and deploy with helm install/upgrade',
      '  tl package <chartDir> [outDir]       Run `helm package` into outDir (requires Helm)',
      '',
      'Flags:',
      '  --dry-run                            Show what would be done without executing',
      '  --silent                             Suppress output (useful for CI)',
      '  --env <environment>                  Use environment-specific values',
      '  --set <key=value>                    Override values (can be used multiple times)',
      '',
      'Examples:',
      '  tl init my-app',
      '  tl synth charts/my-app charts/my-app/dist',
      '  tl validate charts/my-app',
      '  tl deploy charts/my-app my-release --env prod',
      '  tl synth charts/my-app --dry-run --silent',
      '  tl synth charts/my-app --set replicas=5 --set image.tag=v2.0.0',
      '  tl deploy charts/my-app my-release --set service.port=8080',
    ].join('\n'),
  );
  process.exit(msg ? 1 : 0);
}

async function cmdInit(name?: string, silent = false) {
  if (!name) usageAndExit('Missing <chart-name>');
  const base = path.join(process.cwd(), 'charts', name as string);
  const file = path.join(base, 'chart.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(base, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (fs.existsSync(file)) {
    console.error(`File already exists: ${file}`);
    process.exit(1);
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(file, exampleChartTs(name));
  log(`Scaffold created at ${file}`, silent);
}

async function cmdValidate(projectDir?: string, silent = false) {
  if (!projectDir) usageAndExit('Missing <projectDir>');
  const proj = projectDir as string;
  const chartTs = path.isAbsolute(proj)
    ? path.join(proj, 'chart.ts')
    : path.join(process.cwd(), proj, 'chart.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartTs)) {
    console.error(`chart.ts not found at ${chartTs}`);
    process.exit(1);
  }
  try {
    // Enable TS runtime with specific config
    require('ts-node').register({
      transpileOnly: true,
      compilerOptions: {
        module: 'CommonJS',
        moduleResolution: 'node',
      },
    });
    // eslint-disable-next-line security/detect-non-literal-require -- CLI tool needs dynamic module loading
    const mod = require(chartTs);
    const runner = mod.default || mod.run || mod.synth;
    if (typeof runner !== 'function') {
      console.error('chart.ts must export a default/run/synth function');
      process.exit(1);
    }
    log('✓ Chart validation passed', silent);
  } catch (error) {
    console.error('✗ Chart validation failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function cmdSynth(projectDir?: string, out?: string, flags?: CliFlags) {
  if (!projectDir) usageAndExit('Missing <projectDir>');
  const proj = projectDir as string;
  const chartTs = path.isAbsolute(proj)
    ? path.join(proj, 'chart.ts')
    : path.join(process.cwd(), proj, 'chart.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartTs)) {
    console.error(`chart.ts not found at ${chartTs}`);
    process.exit(1);
  }
  // Enable TS runtime with specific config
  require('ts-node').register({
    transpileOnly: true,
    compilerOptions: {
      module: 'CommonJS',
      moduleResolution: 'node',
    },
  });
  // eslint-disable-next-line security/detect-non-literal-require -- CLI tool needs dynamic module loading
  const mod = require(chartTs);
  const runner = mod.default || mod.run || mod.synth;
  if (typeof runner !== 'function') {
    console.error('chart.ts must export a default/run/synth function');
    process.exit(1);
  }

  // Apply --set overrides if provided
  if (
    flags?.set &&
    Object.keys(flags.set).length > 0 &&
    mod.factory &&
    typeof mod.factory.setValues === 'function'
  ) {
    mod.factory.setValues(flags.set);
  }
  const outDir = out || path.join(path.dirname(chartTs), 'dist');

  if (flags?.dryRun) {
    log(`[DRY RUN] Would write chart to ${outDir}`, flags.silent);
    return;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(outDir, { recursive: true });
  await Promise.resolve(runner(outDir));
  log(`Chart written to ${outDir}`, flags?.silent);
}

async function cmdDiff(projectDir?: string, chartDir?: string, silent = false) {
  if (!projectDir || !chartDir) usageAndExit('Missing <projectDir> or <chartDir>');

  const tempDir = path.join(process.cwd(), '.timonel-temp');
  try {
    // Generate chart to temp directory
    await cmdSynth(projectDir, tempDir);

    // Compare with existing chart
    const diffCmd = process.platform === 'win32' ? 'fc' : 'diff';
    const args =
      process.platform === 'win32' ? ['/N', chartDir, tempDir] : ['-r', chartDir, tempDir];

    log(`> ${diffCmd} ${args.join(' ')}`, silent);
    const res = cp.spawnSync(diffCmd, args, { stdio: 'inherit' });

    if (res.status === 0) {
      log('✓ No differences found', silent);
    } else if (res.status === 1) {
      log('⚠ Differences found', silent);
      process.exit(1);
    }
  } finally {
    // Cleanup temp directory
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function cmdDeploy(projectDir?: string, releaseName?: string, flags?: CliFlags) {
  if (!projectDir || !releaseName) usageAndExit('Missing <projectDir> or <release>');

  // Check if helm is available
  const helm = process.env['HELM_BIN'] || 'helm';
  try {
    cp.execSync(`${helm} version --short`, { stdio: 'ignore' });
  } catch {
    console.error('Helm not found. Install Helm or set HELM_BIN environment variable.');
    process.exit(1);
  }

  const tempDir = path.join(process.cwd(), '.timonel-deploy');
  try {
    // Generate chart
    await cmdSynth(projectDir, tempDir, flags);

    // Check if release exists
    const checkCmd = `${helm} status ${releaseName}`;
    const releaseExists = cp.spawnSync('sh', ['-c', checkCmd], { stdio: 'ignore' }).status === 0;

    // Build helm command
    const action = releaseExists ? 'upgrade' : 'install';
    const args = [action, releaseName, tempDir];

    // Add environment-specific values if specified
    if (flags?.env) {
      const valuesFile = path.join(tempDir, `values-${flags.env}.yaml`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
      if (fs.existsSync(valuesFile)) {
        args.push('-f', valuesFile);
      }
    }

    if (flags?.dryRun) {
      args.push('--dry-run');
    }

    log(`> ${helm} ${args.join(' ')}`, flags?.silent);
    const res = cp.spawnSync(helm, args, { stdio: 'inherit' });

    if (res.status !== 0) {
      process.exit(res.status ?? 1);
    }

    log(`✓ ${action === 'install' ? 'Deployed' : 'Updated'} release ${releaseName}`, flags?.silent);
  } finally {
    // Cleanup temp directory
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function cmdPackage(chartDir?: string, out?: string, silent = false) {
  if (!chartDir) usageAndExit('Missing <chartDir>');
  const src = path.isAbsolute(chartDir) ? chartDir : path.join(process.cwd(), chartDir);
  const chartYaml = path.join(src, 'Chart.yaml');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartYaml)) {
    console.error(`Chart.yaml not found in ${src}`);
    process.exit(1);
  }
  const outDir = out ? (path.isAbsolute(out) ? out : path.join(process.cwd(), out)) : src;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(outDir, { recursive: true });
  const helm = process.env['HELM_BIN'] || 'helm';
  const args = ['package', src, '-d', outDir];
  log(`> ${helm} ${args.join(' ')}`, silent);
  const res = cp.spawnSync(helm, args, { stdio: 'inherit' });
  if (res.error) {
    console.error(`Failed to execute Helm: ${res.error.message}`);
    console.error('Ensure Helm is installed and in PATH, or set HELM_BIN.');
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
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
  ports: [{ port: Number(valuesRef('service.port') as unknown as string) as any, targetPort: 80 }],
  type: 'ClusterIP',
  selector: { app: '${name}' },
});

// Optional ingress with advanced path routing and TLS support
// Helm conditionals can be embedded as comments; template users can wrap templates with if blocks
// Here we just generate an ingress; for real conditional generation you could split assets yourself.
factory.addIngress({
  name: '${name}',
  ingressClassName: String(valuesRef('ingress.className')),
  rules: [{
    host: String(valuesRef('ingress.host')),
    paths: [{
      path: '/',
      pathType: 'Prefix',
      backend: {
        service: {
          name: '${name}',
          port: { number: Number(valuesRef('service.port') as unknown as string) as any },
        },
      },
    }],
  }],
});

export default function run(outDir: string) {
  factory.write(outDir);
}
`;
}

interface CliFlags {
  dryRun: boolean;
  silent: boolean;
  env?: string;
  versionBump?: string;
  set: Record<string, string>;
}

// eslint-disable-next-line sonarjs/cognitive-complexity -- CLI argument parsing requires multiple conditions
function parseArgs(): { cmd: string; args: string[]; flags: CliFlags } {
  /* eslint-disable security/detect-object-injection */
  const argv = process.argv.slice(2);
  const flags: CliFlags = { dryRun: false, silent: false, set: {} };
  const args: string[] = [];
  let cmd = '';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg === '--silent') {
      flags.silent = true;
    } else if (arg === '--env' && i + 1 < argv.length) {
      const nextArg = argv[++i];
      if (nextArg) flags.env = nextArg;
    } else if (arg === '--version-bump' && i + 1 < argv.length) {
      const nextArg = argv[++i];
      if (nextArg) flags.versionBump = nextArg;
    } else if (arg === '--set' && i + 1 < argv.length) {
      const setValue = argv[++i];
      if (setValue) {
        const [key, value] = setValue.split('=', 2);
        if (key && value !== undefined) {
          flags.set[key] = value;
        }
      }
    } else if (arg && !arg.startsWith('--')) {
      if (!cmd) {
        cmd = arg;
      } else {
        args.push(arg);
      }
    }
  }
  /* eslint-enable security/detect-object-injection */

  return { cmd, args, flags };
}

function log(message: string, silent = false) {
  if (!silent) {
    console.log(message);
  }
}

async function main() {
  const { cmd, args, flags } = parseArgs();

  switch (cmd) {
    case 'init':
      await cmdInit(args[0], flags.silent);
      break;
    case 'validate':
      await cmdValidate(args[0], flags.silent);
      break;
    case 'synth':
      await cmdSynth(args[0], args[1], flags);
      break;
    case 'diff':
      await cmdDiff(args[0], args[1], flags.silent);
      break;
    case 'deploy':
      await cmdDeploy(args[0], args[1], flags);
      break;
    case 'package':
      await cmdPackage(args[0], args[1], flags.silent);
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
