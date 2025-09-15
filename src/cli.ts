#!/usr/bin/env node
import * as cp from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { SecurityUtils } from './lib/security.js';

// ES modules equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HELM_INSTALL_URL = 'https://helm.sh/docs/intro/install/';
const HELM_ENV_VAR_MSG = 'Or set HELM_BIN environment variable to helm binary path.';

function usageAndExit(msg?: string): never {
  if (msg) console.error(SecurityUtils.sanitizeLogMessage(msg));
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
      'Umbrella Charts:',
      '  tl umbrella init <name>              Create umbrella chart structure',
      '  tl umbrella add <subchart>           Add subchart to umbrella',
      '  tl umbrella synth [outDir]           Generate umbrella chart',
      '',
      'Flags:',
      '  --dry-run                            Show what would be done without executing',
      '  --silent                             Suppress output (useful for CI)',
      '  --env <environment>                  Use environment-specific values',
      '  --set <key=value>                    Override values (can be used multiple times)',
      '  --version, -v                        Show version information',
      '  --help, -h                           Show this help message',
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

  // Validate chart name for security using centralized validation
  if (!SecurityUtils.isValidChartName(name)) {
    usageAndExit(
      'Invalid chart name: must be RFC 1123 compliant (lowercase alphanumeric with hyphens)',
    );
  }
  const sanitizedName = name; // Already validated by SecurityUtils

  const base = SecurityUtils.validatePath(
    path.join(process.cwd(), 'charts', sanitizedName),
    process.cwd(),
  );
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
  log(SecurityUtils.sanitizeLogMessage(`Scaffold created at ${file}`), silent);
}

async function cmdValidate(projectDir?: string, silent = false) {
  if (!projectDir) usageAndExit('Missing <projectDir>');
  const proj = projectDir as string;

  // Validate and secure the project directory path
  const basePath = path.isAbsolute(proj) ? path.dirname(proj) : process.cwd();
  const chartTs = path.isAbsolute(proj)
    ? SecurityUtils.validatePath(path.join(proj, 'chart.ts'), basePath)
    : SecurityUtils.validatePath(path.join(process.cwd(), proj, 'chart.ts'), process.cwd());
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartTs)) {
    console.error(SecurityUtils.sanitizeLogMessage(`chart.ts not found at ${chartTs}`));
    process.exit(1);
  }

  // Check if helm is available
  const helm = process.env['HELM_BIN'] || 'helm';
  try {
    cp.execSync(`${helm} version --short`, { stdio: 'ignore' });
  } catch {
    console.error('✗ Helm not found. Install Helm to enable chart validation.');
    console.error(`  Install: ${HELM_INSTALL_URL}`);
    console.error(`  ${HELM_ENV_VAR_MSG}`);
    process.exit(1);
  }

  const tempDir = path.join(process.cwd(), '.timonel-validate');
  try {
    // Generate chart to temp directory for validation
    await cmdSynth(projectDir, tempDir, { dryRun: false, silent: true, set: {} });

    // Run helm lint on generated chart
    const lintResult = cp.spawnSync(helm, ['lint', tempDir], {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });

    if (lintResult.status !== 0) {
      if (silent && lintResult.stderr) {
        console.error(SecurityUtils.sanitizeLogMessage(lintResult.stderr));
      }
      console.error('✗ Chart validation failed: Helm lint errors found');
      process.exit(1);
    }

    log('✓ Chart validation passed', silent);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('✗ Chart validation failed:', SecurityUtils.sanitizeLogMessage(errorMsg));
    process.exit(1);
  } finally {
    // Cleanup temp directory

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

/**
 * Execute TypeScript chart using tsx with proper error handling.
 * @param resolvedPath - Resolved path to the TypeScript file
 * @param outDir - Output directory for the chart
 * @param flags - CLI flags
 * @since 2.7.3
 */
async function executeTypeScriptChart(resolvedPath: string, outDir: string, flags?: CliFlags) {
  const wrapperScript = `
import { pathToFileURL } from 'url';

const mod = await import(pathToFileURL('${resolvedPath}').href);
const runner = mod.default || mod.run || mod.synth;
if (typeof runner !== 'function') {
  console.error('chart.ts must export a default/run/synth function');
  process.exit(1);
}

${
  flags?.set && Object.keys(flags.set).length > 0
    ? `
// Apply --set overrides if provided
if (mod.rutter && typeof mod.rutter.setValues === 'function') {
  mod.rutter.setValues(${JSON.stringify(flags.set)});
}
`
    : ''
}

const outDir = '${outDir}';
const fs = await import('fs');
fs.mkdirSync(outDir, { recursive: true });
await Promise.resolve(runner(outDir));
console.log('Chart written to ' + outDir);
`;

  const wrapperFile = path.join(process.cwd(), '.timonel-wrapper.mjs');

  try {
    fs.writeFileSync(wrapperFile, wrapperScript);

    const result = cp.spawnSync('npx', ['tsx', wrapperFile], {
      stdio: flags?.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      if (flags?.silent && result.stderr) {
        console.error(SecurityUtils.sanitizeLogMessage(result.stderr));
      }
      process.exit(result.status ?? 1);
    }
  } finally {
    // Cleanup wrapper file
    if (fs.existsSync(wrapperFile)) {
      fs.unlinkSync(wrapperFile);
    }
  }
}

async function cmdSynth(projectDir?: string, out?: string, flags?: CliFlags) {
  if (!projectDir) usageAndExit('Missing <projectDir>');
  const proj = projectDir as string;

  // Validate and secure the project directory path
  const basePath = path.isAbsolute(proj) ? path.dirname(proj) : process.cwd();
  const chartTs = path.isAbsolute(proj)
    ? SecurityUtils.validatePath(path.join(proj, 'chart.ts'), basePath)
    : SecurityUtils.validatePath(path.join(process.cwd(), proj, 'chart.ts'), process.cwd());
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartTs)) {
    console.error(SecurityUtils.sanitizeLogMessage(`chart.ts not found at ${chartTs}`));
    process.exit(1);
  }

  // Validate TypeScript file extension
  if (!SecurityUtils.isValidTypeScriptFile(chartTs)) {
    console.error('Security: Only TypeScript files (.ts) are allowed');
    process.exit(1);
  }

  // Additional path validation is already done by SecurityUtils.validatePath above
  const resolvedPath = path.resolve(chartTs);
  const outDir = out || path.join(path.dirname(chartTs), 'dist');

  if (flags?.dryRun) {
    log(`[DRY RUN] Would write chart to ${outDir}`, flags.silent);
    return;
  }

  try {
    await executeTypeScriptChart(resolvedPath, outDir, flags);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(SecurityUtils.sanitizeLogMessage(`Failed to execute chart: ${errorMsg}`));
    process.exit(1);
  }
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
    console.error('✗ Helm not found. Install Helm to enable deployment.');
    console.error(`  Install: ${HELM_INSTALL_URL}`);
    console.error(`  ${HELM_ENV_VAR_MSG}`);
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

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

async function cmdUmbrella(subcommand?: string, args?: string[], flags?: CliFlags) {
  const UMBRELLA_USAGE_MSG = 'Missing umbrella subcommand (init|add|synth)';
  if (!subcommand) usageAndExit(UMBRELLA_USAGE_MSG);

  switch (subcommand) {
    case 'init':
      await cmdUmbrellaInit(args?.[0], flags?.silent);
      break;
    case 'add':
      await cmdUmbrellaAdd(args?.[0], flags?.silent);
      break;
    case 'synth':
      await cmdUmbrellaSynth(args?.[0], flags);
      break;
    default:
      usageAndExit(`Unknown umbrella subcommand: ${subcommand}`);
  }
}

const UMBRELLA_CONFIG_FILE = 'umbrella.config.json';

async function cmdUmbrellaInit(name?: string, silent = false) {
  const MISSING_NAME_MSG = 'Missing umbrella chart name';
  if (!name) usageAndExit(MISSING_NAME_MSG);

  const base = path.join(process.cwd(), name);
  const umbrellaFile = path.join(base, 'umbrella.ts');
  const configFile = path.join(base, UMBRELLA_CONFIG_FILE);

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(base, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(path.join(base, 'charts'), { recursive: true });

  // Create umbrella.ts
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(umbrellaFile, exampleUmbrellaTs(name));

  // Create config file
  const config = {
    name,
    version: '0.1.0',
    description: `${name} umbrella chart`,
    subcharts: [],
  };
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  log(`Umbrella chart structure created at ${base}`, silent);
  log(`Add subcharts with: tl umbrella add <subchart-name>`, silent);
}

async function cmdUmbrellaAdd(subchartName?: string, silent = false) {
  const MISSING_SUBCHART_MSG = 'Missing subchart name';
  if (!subchartName) usageAndExit(MISSING_SUBCHART_MSG);

  const configFile = path.join(process.cwd(), UMBRELLA_CONFIG_FILE);

  if (!fs.existsSync(configFile)) {
    console.error(`${UMBRELLA_CONFIG_FILE} not found. Run \`tl umbrella init\` first.`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  // Create subchart directory and scaffold
  const subchartDir = path.join(process.cwd(), 'charts', subchartName);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(subchartDir, { recursive: true });

  const chartFile = path.join(subchartDir, 'chart.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(chartFile, exampleSubchartTs(subchartName));

  // Update config
  config.subcharts.push({
    name: subchartName,
    version: '0.1.0',
    path: `./charts/${subchartName}/chart.ts`,
  });

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  log(`Subchart ${subchartName} added to umbrella`, silent);
}

/**
 * Execute TypeScript umbrella chart using tsx with proper error handling.
 * @param resolvedPath - Resolved path to the TypeScript file
 * @param outDir - Output directory for the chart
 * @param flags - CLI flags
 * @since 2.7.3
 */
async function executeTypeScriptUmbrella(resolvedPath: string, outDir: string, flags?: CliFlags) {
  const wrapperScript = `
import { pathToFileURL } from 'url';

const mod = await import(pathToFileURL('${resolvedPath}').href);
const runner = mod.default || mod.run || mod.synth;
if (typeof runner !== 'function') {
  console.error('umbrella.ts must export a default/run/synth function');
  process.exit(1);
}

const output = '${outDir}';
const fs = await import('fs');
fs.mkdirSync(output, { recursive: true });
await Promise.resolve(runner(output));
console.log('Umbrella chart written to ' + output);
`;

  const wrapperFile = path.join(process.cwd(), '.timonel-umbrella-wrapper.mjs');

  try {
    fs.writeFileSync(wrapperFile, wrapperScript);

    const result = cp.spawnSync('npx', ['tsx', wrapperFile], {
      stdio: flags?.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
    });

    if (result.status !== 0) {
      if (flags?.silent && result.stderr) {
        console.error(SecurityUtils.sanitizeLogMessage(result.stderr));
      }
      process.exit(result.status ?? 1);
    }
  } finally {
    // Cleanup wrapper file
    if (fs.existsSync(wrapperFile)) {
      fs.unlinkSync(wrapperFile);
    }
  }
}

async function cmdUmbrellaSynth(outDir?: string, flags?: CliFlags) {
  const configFile = path.join(process.cwd(), UMBRELLA_CONFIG_FILE);

  if (!fs.existsSync(configFile)) {
    console.error(`${UMBRELLA_CONFIG_FILE} not found. Run \`tl umbrella init\` first.`);
    process.exit(1);
  }

  const umbrellaFile = path.join(process.cwd(), 'umbrella.ts');

  if (!fs.existsSync(umbrellaFile)) {
    console.error('umbrella.ts not found.');
    process.exit(1);
  }

  // Validate TypeScript file extension
  if (!SecurityUtils.isValidTypeScriptFile(umbrellaFile)) {
    console.error('Security: Only TypeScript files (.ts) are allowed');
    process.exit(1);
  }

  // Validate path to prevent traversal attacks
  const validatedPath = SecurityUtils.validatePath(umbrellaFile, process.cwd());
  const resolvedPath = path.resolve(validatedPath);
  const output = outDir || path.join(process.cwd(), 'dist');

  if (flags?.dryRun) {
    log(`[DRY RUN] Would write umbrella chart to ${output}`, flags.silent);
    return;
  }

  try {
    await executeTypeScriptUmbrella(resolvedPath, output, flags);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(SecurityUtils.sanitizeLogMessage(`Failed to execute umbrella: ${errorMsg}`));
    process.exit(1);
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
    console.error(`✗ Failed to execute Helm: ${res.error.message}`);
    console.error(`  Install: ${HELM_INSTALL_URL}`);
    console.error(`  ${HELM_ENV_VAR_MSG}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

function exampleUmbrellaTs(name: string): string {
  return `import { createUmbrella } from 'timonel';
import { Rutter } from 'timonel';

// Import subcharts (these will be created with 'tl umbrella add')
// import { rutter as fluentBit } from './charts/fluent-bit/chart';
// import { rutter as openObserve } from './charts/openobserve/chart';

// Create umbrella chart
const umbrella = createUmbrella({
  meta: {
    name: '${name}',
    version: '0.1.0',
    description: '${name} umbrella chart',
    appVersion: '1.0.0',
  },
  subcharts: [
    // Add your subcharts here:
    // { name: 'fluent-bit', rutter: fluentBit },
    // { name: 'openobserve', rutter: openObserve },
  ],
  defaultValues: {
    global: {
      // Global values shared across subcharts
    },
  },
  envValues: {
    dev: {
      // Development environment overrides
    },
    prod: {
      // Production environment overrides
    },
  },
});

export default function run(outDir: string) {
  umbrella.write(outDir);
}
`;
}

/**
 * Generate TypeScript code for a subchart with correct package imports.
 * Uses published package imports instead of relative development paths.
 * @param name - The name of the subchart
 * @returns TypeScript code string for the subchart
 * @since 2.7.3
 */
function exampleSubchartTs(name: string): string {
  return `import { Rutter } from 'timonel';
import { valuesRef } from './lib/helm.js';

// Define subchart
const rutter = new Rutter({
  meta: {
    name: '${name}',
    version: '0.1.0',
    description: '${name} subchart',
    appVersion: '1.0.0',
  },
  defaultValues: {
    image: { repository: 'nginx', tag: '1.27' },
    replicas: 1,
    service: { port: 80 },
  },
});

// Add resources
rutter.addDeployment({
  name: '${name}-deployment',
  image: String(valuesRef('image.repository')) + ':' + String(valuesRef('image.tag')),
  replicas: 1,
  containerPort: 80,
});

rutter.addService({
  name: '${name}-service',
  ports: [{ port: 80, targetPort: 80 }],
  selector: { app: '${name}' },
});

export default function run(outDir: string) {
  rutter.write(outDir);
}

// Export rutter for umbrella chart
export { rutter };
`;
}

/**
 * Generate TypeScript code for a main chart with correct package imports.
 * Uses published package imports instead of relative development paths.
 * @param name - The name of the chart
 * @returns TypeScript code string for the chart
 * @since 2.7.3
 */
function exampleChartTs(name: string): string {
  return `import { Rutter } from 'timonel';
import { valuesRef, helm } from './lib/helm.js';

// Define chart metadata and default/env values
const rutter = new Rutter({
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
rutter.addDeployment({
  name: '${name}-deployment',
  image: String(valuesRef('image.repository')) + ':' + String(valuesRef('image.tag')),
  replicas: valuesRef('replicas'),
  containerPort: 80,
  env: {
    APP_NAME: '${name}',
    RELEASE: helm.releaseName,
  },
});

rutter.addService({
  name: '${name}-service',
  ports: [{ port: valuesRef('service.port'), targetPort: 80 }],
  type: 'ClusterIP',
  selector: { app: '${name}' },
});

// Optional ingress with advanced path routing and TLS support
// Helm conditionals can be embedded as comments; template users can wrap templates with if blocks
// Here we just generate an ingress; for real conditional generation you could split assets yourself.
rutter.addIngress({
  name: '${name}-ingress',
  ingressClassName: String(valuesRef('ingress.className')),
  rules: [{
    host: String(valuesRef('ingress.host')),
    paths: [{
      path: '/',
      pathType: 'Prefix',
      backend: {
        service: {
          name: '${name}',
          port: { number: valuesRef('service.port') },
        },
      },
    }],
  }],
});

export default function run(outDir: string) {
  rutter.write(outDir);
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
    } else if (arg === '--version' || arg === '-v') {
      showVersion();
      process.exit(0);
    } else if (arg === '--help' || arg === '-h') {
      usageAndExit();
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

/**
 * Display the current version of Timonel CLI.
 * Reads version from package.json using ES modules compatible path resolution.
 * @since 2.7.3
 */
function showVersion() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  try {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    console.log(`timonel v${packageJson.version}`);
  } catch {
    console.log('timonel (version unknown)');
  }
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
    case 'umbrella':
      await cmdUmbrella(args[0], args.slice(1), flags);
      break;
    default:
      usageAndExit();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
