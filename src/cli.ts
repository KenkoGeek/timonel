#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { SecurityUtils } from './lib/security.js';
import { createLogger } from './lib/utils/logger.js';
import type { SubchartProps } from './lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const esmRequire = createRequire(import.meta.url);

/**
 * Resolves the project-local tsx CLI entry point for spawning through Node.js.
 * @returns Absolute filesystem path to the tsx CLI module.
 * @since 2.12.2 Prevents reliance on npx downloads during synthesis.
 */
function getLocalTsxCliPath(): string {
  return esmRequire.resolve('tsx/cli');
}

/**
 * Escapes a string for safe inclusion inside single-quoted TypeScript literals.
 * @param value - Path or text segment that needs escaping.
 * @returns Escaped string suitable for single-quoted literals.
 * @since 2.12.2 Avoids malformed chart.ts rewrites when directories contain quotes.
 */
function escapeForSingleQuotedLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Resolves and validates an output directory against traversal and file misdirection attempts.
 * @param requestedOutDir - Raw output directory provided via CLI arguments.
 * @param baseDir - Directory that relative paths must remain within.
 * @param silent - When true, suppresses console error output on failure.
 * @returns Absolute, security-checked directory path.
 * @since 2.12.2 Protects against traversal while permitting explicit absolute destinations.
 */
function resolveOutputDirectory(
  requestedOutDir: string,
  baseDir: string,
  silent?: boolean,
): string {
  let validatedOutDir: string;
  try {
    validatedOutDir = SecurityUtils.validatePath(requestedOutDir, baseDir, {
      allowAbsolute: true,
    });
  } catch (error) {
    if (!silent) {
      console.error(SecurityUtils.sanitizeLogMessage((error as Error).message));
    }
    process.exit(1);
  }

  if (
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by SecurityUtils
    fs.existsSync(validatedOutDir)
  ) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by SecurityUtils
      const stats = fs.statSync(validatedOutDir);
      if (!stats.isDirectory()) {
        if (!silent) {
          console.error(
            `Invalid output path: ${SecurityUtils.sanitizeLogMessage(validatedOutDir)} must be a directory`,
          );
        }
        process.exit(1);
      }
    } catch (error) {
      if (!silent) {
        console.error(SecurityUtils.sanitizeLogMessage((error as Error).message));
      }
      process.exit(1);
    }
  }

  return validatedOutDir;
}

const TSX_CLI_PATH = getLocalTsxCliPath();

// Constants
const UMBRELLA_CONFIG_FILE = 'umbrella.config.json';
const UMBRELLA_FILE_NAME = 'umbrella.ts';
const PACKAGE_JSON_FILE = 'package.json';

// Helper functions

/**
 * Retrieves the version from the package manifest located next to the compiled CLI file
 * @returns The version number or 'unknown' if not found
 * @since 2.11.1 Uses the CLI directory as the base for manifest lookup in installed scenarios
 */
function getVersion(): string {
  try {
    const packagePath = path.resolve(__dirname, '..', PACKAGE_JSON_FILE);
    const allowedBase = path.resolve(__dirname, '..');
    const validatedPath = SecurityUtils.validatePath(packagePath, allowedBase);

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path validated by SecurityUtils
    const packageJson = JSON.parse(fs.readFileSync(validatedPath, 'utf8'));
    if (packageJson.version) {
      return packageJson.version;
    }
  } catch {
    // Fallback handled below
  }

  if (process.env.npm_package_version) {
    return process.env.npm_package_version;
  }

  return 'unknown';
}

// Create CLI logger instance
const cliLogger = createLogger('cli');

/**
 * Enhanced logging function that respects silent flag globally
 * @param msg - Message to log
 * @param silent - Whether to suppress output
 * @since 2.10.3
 */
function log(msg: string, silent = false) {
  if (!silent) {
    cliLogger.info(msg, { operation: 'cli_log' });
  }
}

/**
 * Enhanced error logging function that respects silent flag
 * @param msg - Error message to log
 * @param silent - Whether to suppress output
 * @since 2.10.3
 */
function logError(msg: string, silent = false) {
  if (!silent) {
    cliLogger.error(msg, { operation: 'cli_error' });
  }
}

/**
 * Display usage information and exit
 * @param msg - Optional error message
 * @param silent - Whether to suppress output
 * @since 2.9.2
 */
function usageAndExit(msg?: string, silent = false) {
  if (msg) {
    logError(`Error: ${msg}`, silent);
  }

  if (!silent) {
    console.log(
      [
        'Usage: tl <command> [options]',
        '',
        'Commands:',
        '  tl init <chart-name>              Create new chart',
        '  tl synth [outDir]                 Generate Helm chart',
        '  tl validate                       Validate chart',
        '  tl deploy <release> [namespace]   Deploy chart',
        '  tl templates                      List available templates',
        '  tl help                           Show this help message',
        '',
        'Umbrella Charts:',
        '  tl umbrella init <n>              Create umbrella chart structure',
        '  tl umbrella add <subchart>           Add subchart to umbrella',
        '  tl umbrella synth [outDir]           Generate umbrella chart',
        '',
        'Flags:',
        '  --dry-run                            Show what would be done without executing',
        '  --silent                             Suppress output (useful for CI)',
        '  --env <environment>                  Use environment-specific values',
        '  --set <key=value>                    Override values (can be used multiple times)',
        '  --mode <dependencies|inline>         Umbrella synth mode (default: dependencies)',
        '  --help, -h                           Show this help message',
        '',
        'Examples:',
        '  tl init my-app',
        '  tl synth my-app my-app/dist',
        '  tl validate my-app',
        '  tl deploy my-app my-release --env prod',
        '  tl synth --dry-run --silent',
        '  tl synth --set replicas=5 --set image.tag=v2.0.0',
        '  tl deploy my-app my-release --set service.port=8080',
      ].join('\n'),
    );
  }
  process.exit(msg ? 1 : 0);
}

/**
 * Initialize a new chart
 * @since 2.8.4 Updated to mention Helm chart generation instead of Kubernetes manifests
 */
async function cmdInit(name?: string, silent = false) {
  if (!name) usageAndExit('Missing <chart-name>');
  const validName = name as string; // Now guaranteed to be defined

  // Validate chart name for security
  if (!SecurityUtils.isValidChartName(validName)) {
    usageAndExit(
      'Invalid chart name. Must be lowercase, start with a letter, and contain only letters, numbers, and dashes.',
    );
  }

  const base = path.join(process.cwd(), validName);
  const chartFile = path.join(base, 'chart.ts');

  // Create directory
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(base, { recursive: true });

  // Import template generator
  const { generateFlexibleSubchartTemplate } = await import('./lib/templates/flexible-subchart.js');

  // Write chart file only - following CDK8s best practices
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(chartFile, generateFlexibleSubchartTemplate(validName));

  log(`Chart created at ${base}`, silent);
  log(`Generated chart.ts file`, silent);
  log(`Run 'tl synth ${validName}' to generate complete Helm chart`, silent);
}

/**
 * Synthesizes a chart to generate a complete Helm chart structure.
 * Creates Chart.yaml, values.yaml, templates/, and _helpers.tpl files.
 * Supports both chart directory and output directory parameters.
 *
 * @param chartDirOrOutDir - Either the chart directory path or output directory path
 * @param flags - CLI flags for controlling synthesis behavior
 * @param explicitOutDir - Optional explicit destination directory for generated charts
 * @since 2.8.4
 * @since 2.12.2 Supports explicit output directory argument while retaining legacy behavior
 */
async function cmdSynth(chartDirOrOutDir?: string, flags?: CliFlags, explicitOutDir?: string) {
  let chartDir = process.cwd();
  let outDir: string | undefined;

  // If the parameter is a directory containing chart.ts, use it as chart directory
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (chartDirOrOutDir && fs.existsSync(path.join(chartDirOrOutDir, 'chart.ts'))) {
    chartDir = path.resolve(chartDirOrOutDir);
  } else {
    // Otherwise, treat it as output directory for backward compatibility
    outDir = chartDirOrOutDir;
  }

  if (explicitOutDir) {
    outDir = explicitOutDir;
  }

  const chartFile = path.join(chartDir, 'chart.ts');
  const defaultOutDir = path.join(chartDir, 'dist');

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  if (!fs.existsSync(chartFile)) {
    console.error('chart.ts not found. Run `tl init` first.');
    process.exit(1);
  }

  const requestedOutDir = outDir ?? defaultOutDir;
  const validatedOutDir = resolveOutputDirectory(requestedOutDir, chartDir, flags?.silent);

  // Read the original chart file and modify the writeHelmChart output directory
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  const originalContent = fs.readFileSync(chartFile, 'utf8');
  const safeOutDirLiteral = escapeForSingleQuotedLiteral(validatedOutDir);
  let modifiedContent = originalContent.replace(
    /chart\.writeHelmChart\(['"][^'"]*['"]\)/,
    `chart.writeHelmChart('${safeOutDirLiteral}')`,
  );

  if (modifiedContent === originalContent) {
    modifiedContent = originalContent.replace(
      /chart\.write\(['"][^'"]*['"]\)/,
      `chart.write('${safeOutDirLiteral}')`,
    );
  }

  // Create a temporary modified chart file
  const tempChartFile = path.join(chartDir, '.timonel-temp-chart.ts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(tempChartFile, modifiedContent);

  // Create wrapper script for tsx execution
  const wrapperScript = `
import { pathToFileURL } from 'url';

// Import the modified chart file which should execute the synthesis directly
await import(pathToFileURL(${JSON.stringify(tempChartFile)}).href);
`;

  const wrapperFile = path.join(chartDir, '.timonel-wrapper.mjs');

  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    fs.writeFileSync(wrapperFile, wrapperScript);

    const result = spawnSync(process.execPath, [TSX_CLI_PATH, wrapperFile], {
      stdio: flags?.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
      cwd: chartDir,
    });

    if (result.status !== 0) {
      if (flags?.silent && result.stderr) {
        console.error(SecurityUtils.sanitizeLogMessage(result.stderr));
      }
      process.exit(result.status ?? 1);
    }
  } finally {
    // Clean up wrapper file
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (fs.existsSync(wrapperFile)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
      fs.unlinkSync(wrapperFile);
    }
    // Clean up temporary chart file
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
    if (fs.existsSync(tempChartFile)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
      fs.unlinkSync(tempChartFile);
    }
  }
}

/**
 * Validates a Helm chart using helm lint command.
 * Runs helm lint on the current directory to check chart validity.
 *
 * @param flags - CLI flags for controlling validation behavior
 * @since 2.8.4
 * @since 2.11.1 Supports --env and --set flags for environment-specific linting
 */
async function cmdValidate(flags?: CliFlags) {
  const lintArgs = ['lint', '.'];
  if (flags?.env) {
    try {
      const sanitizedEnv = SecurityUtils.sanitizeEnvironmentName(flags.env);
      lintArgs.push('-f', `values-${sanitizedEnv}.yaml`);
    } catch (error) {
      console.error(SecurityUtils.sanitizeLogMessage((error as Error).message));
      process.exit(1);
    }
  }

  if (flags?.set) {
    for (const setValue of flags.set) {
      lintArgs.push('--set', setValue);
    }
  }

  const result = spawnSync('helm', lintArgs, {
    stdio: flags?.silent ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    if (flags?.silent && result.stderr) {
      console.error(SecurityUtils.sanitizeLogMessage(result.stderr));
    }
    process.exit(result.status ?? 1);
  }
}

/**
 * Deploys a Helm chart to a Kubernetes cluster.
 * Uses helm upgrade --install to deploy or update a release.
 *
 * @param release - The release name for the deployment
 * @param namespace - Optional namespace for the deployment
 * @param flags - CLI flags for controlling deployment behavior
 * @since 2.8.4
 * @since 2.11.1 Honors --env and --set flags when invoking helm upgrade
 */
async function cmdDeploy(release?: string, namespace?: string, flags?: CliFlags) {
  if (!release) usageAndExit('Missing <release>');

  const args = ['upgrade', '--install', release, '.'];
  if (namespace) {
    args.push('--namespace', namespace);
  }

  if (flags?.env) {
    try {
      const sanitizedEnv = SecurityUtils.sanitizeEnvironmentName(flags.env);
      args.push('-f', `values-${sanitizedEnv}.yaml`);
    } catch (error) {
      console.error(SecurityUtils.sanitizeLogMessage((error as Error).message));
      process.exit(1);
    }
  }

  if (flags?.set) {
    for (const setValue of flags.set) {
      args.push('--set', setValue);
    }
  }

  const result = spawnSync(
    'helm',
    args.filter((arg): arg is string => Boolean(arg)),
    {
      stdio: flags?.silent ? 'pipe' : 'inherit',
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    if (flags?.silent && result.stderr) {
      console.error(SecurityUtils.sanitizeLogMessage(result.stderr));
    }
    process.exit(result.status ?? 1);
  }
}

/**
 * Lists available chart templates.
 * Shows all available templates that can be used with tl init.
 *
 * @param flags - CLI flags for controlling output format
 * @since 2.8.4
 */
async function cmdTemplates(flags?: CliFlags) {
  const templates = [
    {
      name: 'basic-chart',
      description: 'Basic chart with deployment and service',
      usage: 'tl init my-app',
    },
    {
      name: 'umbrella-chart',
      description: 'Umbrella chart for managing multiple subcharts',
      usage: 'tl umbrella init my-app',
    },
    {
      name: 'subchart',
      description: 'Subchart for use with umbrella charts',
      usage: 'tl umbrella add my-subchart',
    },
  ];

  if (flags?.silent) {
    // In silent mode, output only JSON for programmatic consumption
    console.log(JSON.stringify(templates, null, 2));
  } else {
    console.log('Available templates:');
    templates.forEach((t) => {
      console.log(`  ${t.name.padEnd(15)} - ${t.description}`);
      console.log(`  ${''.padEnd(15)}   Usage: ${t.usage}`);
    });
  }
}

const UMBRELLA_SYNTH_MODES = ['dependencies', 'inline'] as const;
type UmbrellaSynthMode = (typeof UMBRELLA_SYNTH_MODES)[number];

interface CliFlags {
  dryRun?: boolean;
  silent?: boolean;
  env?: string;
  set?: string[];
  mode?: UmbrellaSynthMode;
}

/**
 * Handles umbrella chart commands (init, add, synth).
 * Routes to appropriate umbrella subcommand handlers.
 *
 * @param subcommand - The umbrella subcommand to execute
 * @param args - Arguments for the subcommand
 * @param flags - CLI flags for controlling behavior
 * @since 2.8.4
 */
async function cmdUmbrella(subcommand?: string, args?: string[], flags?: CliFlags) {
  if (!subcommand) usageAndExit('Missing umbrella subcommand');

  const workingArgs = [...(args ?? [])];
  const subcommandFlags = parseFlags(workingArgs);
  const mergedFlags = mergeCliFlags(flags, subcommandFlags);

  switch (subcommand) {
    case 'init':
      await cmdUmbrellaInit(workingArgs[0], mergedFlags.silent);
      break;
    case 'add':
      await cmdUmbrellaAdd(workingArgs[0], mergedFlags.silent);
      break;
    case 'synth':
      await cmdUmbrellaSynth(workingArgs[0], mergedFlags);
      break;
    default:
      usageAndExit(`Unknown umbrella subcommand: ${subcommand}`);
  }
}

/**
 * Initializes a new umbrella chart.
 * Creates an umbrella chart structure for managing multiple subcharts.
 *
 * @param name - The name of the umbrella chart
 * @param silent - Whether to suppress output messages
 * @since 2.8.4
 */
async function cmdUmbrellaInit(name?: string, silent = false) {
  const MISSING_NAME_MSG = 'Missing umbrella chart name';
  if (!name) usageAndExit(MISSING_NAME_MSG);
  const validName = name as string; // Now guaranteed to be defined

  const base = path.join(process.cwd(), validName);
  const umbrellaFile = path.join(base, UMBRELLA_FILE_NAME);
  const configFile = path.join(base, UMBRELLA_CONFIG_FILE);

  // Create directory
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(base, { recursive: true });

  // Create umbrella.ts
  // Import template generator
  const { generateUmbrellaChart } = await import('./lib/templates/umbrella-chart.js');

  // Write umbrella.ts
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(umbrellaFile, generateUmbrellaChart(validName));

  // Create umbrella.config.json
  const config = {
    name: validName,
    version: getVersion(),
    description: `${validName} umbrella chart`,
    subcharts: [] as SubchartProps[],
  };

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  // Create charts directory for subcharts
  const chartsDir = path.join(base, 'charts');
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(chartsDir, { recursive: true });

  log(`Umbrella chart structure created at ${base}`, silent);
  log(`Add subcharts with: tl umbrella add <subchart-name>`, silent);
}

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1]?.toUpperCase() || '');
}

function findLastImportIndex(lines: string[]): number {
  let lastImportIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    if (lines[i]?.trim().startsWith('import ')) {
      lastImportIndex = i;
      // eslint-disable-next-line security/detect-object-injection
    } else if (lines[i]?.trim() && !lines[i]?.trim().startsWith('import ')) {
      // Stop at first non-import, non-empty line
      break;
    }
  }

  return lastImportIndex;
}

function addImportStatement(content: string, importStatement: string): string {
  if (content.includes(importStatement)) {
    return content;
  }

  const lines = content.split('\n');
  const lastImportIndex = findLastImportIndex(lines);

  if (lastImportIndex >= 0) {
    lines.splice(lastImportIndex + 1, 0, importStatement);
  } else {
    lines.splice(0, 0, importStatement);
  }

  return lines.join('\n');
}

function buildSubchartsContent(
  subchartsContent: string | undefined,
  subchartEntry: string,
): string {
  const existingEntries = (subchartsContent || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('//'))
    .map((line) => line.replace(/,$/, ''));

  if (existingEntries.includes(subchartEntry)) {
    return subchartsContent ?? '';
  }

  const entries = [...existingEntries, subchartEntry];
  const lines = ['  // Add your subcharts here:'];
  for (const entry of entries) {
    lines.push(`  ${entry},`);
  }

  return `\n${lines.join('\n')}\n`;
}

function addSubchartToArray(content: string, chartName: string, camelCaseName: string): string {
  const subchartsRegex = /(const SUBCHARTS[\s\S]*?=\s*\[)([\s\S]*?)(\];)/;
  const match = content.match(subchartsRegex);

  if (!match) {
    return content;
  }

  const [, prefix, body, suffix] = match;

  if (body?.includes(`name: '${chartName}'`)) {
    return content;
  }

  const subchartEntry = `{ name: '${chartName}', factory: ${camelCaseName} }`;
  const newBody = buildSubchartsContent(body, subchartEntry);

  return content.replace(subchartsRegex, `${prefix}${newBody}${suffix}`);
}

function mergeCliFlags(base?: CliFlags, override?: CliFlags): CliFlags {
  const merged: CliFlags = { ...(base || {}) };

  if (!override) {
    return merged;
  }

  if (override.dryRun !== undefined) merged.dryRun = override.dryRun;
  if (override.silent !== undefined) merged.silent = override.silent;
  if (override.env !== undefined) merged.env = override.env;
  if (override.mode !== undefined) merged.mode = override.mode;

  const baseSet = base?.set ?? [];
  const overrideSet = override.set ?? [];
  if (baseSet.length || overrideSet.length) {
    merged.set = [...baseSet, ...overrideSet];
  }

  return merged;
}

function updateUmbrellaTs(subchartPath: string, chartName: string) {
  const umbrellaFile = path.join(process.cwd(), UMBRELLA_FILE_NAME);
  const content = processUmbrellaFile(umbrellaFile, subchartPath, chartName);

  fs.writeFileSync(umbrellaFile, content);
}

function processUmbrellaFile(
  umbrellaFile: string,
  subchartPath: string,
  chartName: string,
): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  let content = fs.readFileSync(umbrellaFile, 'utf8');

  const importData = createImportData(subchartPath, chartName);
  content = addImportStatement(content, importData.importStatement);
  content = addSubchartToArray(content, chartName, importData.camelCaseName);

  return content;
}

function createImportData(subchartPath: string, chartName: string) {
  const importPath = `./charts/${subchartPath}/chart`;
  const camelCaseName = toCamelCase(chartName);
  const importStatement = `import ${camelCaseName} from '${importPath}';`;

  return { importPath, camelCaseName, importStatement };
}

/**
 * Adds a subchart to an existing umbrella chart.
 * Creates a new subchart and updates the umbrella configuration.
 *
 * @param subchartPath - The path/name for the new subchart
 * @param silent - Whether to suppress output messages
 * @since 2.8.4
 */
async function cmdUmbrellaAdd(subchartPath?: string, silent = false) {
  const MISSING_SUBCHART_MSG = 'Missing subchart name or path';
  if (!subchartPath) usageAndExit(MISSING_SUBCHART_MSG);
  const validSubchartPath = subchartPath as string; // Now guaranteed to be defined

  const configFile = path.join(process.cwd(), UMBRELLA_CONFIG_FILE);

  if (!fs.existsSync(configFile)) {
    console.error(`${UMBRELLA_CONFIG_FILE} not found. Run \`tl umbrella init\` first.`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  // Extract subchart name from path (last segment)
  const subchartName = path.basename(validSubchartPath);

  // Create full subchart directory path
  const chartsRoot = path.join(process.cwd(), 'charts');
  const targetSubchartPath = path.join(chartsRoot, validSubchartPath);

  let subchartDir: string;
  try {
    // @since 2.11.1 Ensure requested subchart path stays inside charts directory
    subchartDir = SecurityUtils.validatePath(targetSubchartPath, chartsRoot);
  } catch (error) {
    console.error(SecurityUtils.sanitizeLogMessage((error as Error).message));
    process.exit(1);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(subchartDir, { recursive: true });

  const relativeSubchartPath = path.relative(chartsRoot, subchartDir) || subchartName;
  const normalizedSubchartPath = relativeSubchartPath.split(path.sep).join('/');

  const chartFile = path.join(subchartDir, 'chart.ts');
  const { generateFlexibleSubchartTemplate } = await import('./lib/templates/flexible-subchart.js');
  const subchartContent = generateFlexibleSubchartTemplate(subchartName);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(chartFile, subchartContent);

  // Update config
  config.subcharts.push({
    name: subchartName,
    version: getVersion(),
    path: `./charts/${normalizedSubchartPath}/chart.ts`,
  } as SubchartProps);

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  // Update umbrella.ts file automatically with the path
  updateUmbrellaTs(normalizedSubchartPath, subchartName);

  log(`Subchart ${subchartName} added to umbrella at path '${normalizedSubchartPath}'`, silent);
}

/**
 * Synthesizes an umbrella chart to generate Helm charts for all subcharts.
 * Executes the umbrella.ts file to generate charts for all configured subcharts.
 *
 * @param outDir - Optional output directory for generated charts
 * @param flags - CLI flags for controlling synthesis behavior
 * @since 2.8.4
 */
async function cmdUmbrellaSynth(outDir?: string, flags?: CliFlags) {
  const umbrellaFile = path.join(process.cwd(), UMBRELLA_FILE_NAME);
  const defaultOutDir = path.join(process.cwd(), 'dist');

  if (!fs.existsSync(umbrellaFile)) {
    console.error('umbrella.ts not found. Run `tl umbrella init` first.');
    process.exit(1);
  }

  const synthMode: UmbrellaSynthMode = flags?.mode ?? 'dependencies';
  if (!UMBRELLA_SYNTH_MODES.includes(synthMode)) {
    usageAndExit('Invalid mode. Use "dependencies" or "inline".', flags?.silent);
  }
  await executeTypeScriptUmbrella(umbrellaFile, outDir ?? defaultOutDir, synthMode, flags);
}

async function executeTypeScriptUmbrella(
  resolvedPath: string,
  outDir: string,
  mode: UmbrellaSynthMode,
  flags?: CliFlags,
) {
  const umbrellaBase = path.dirname(resolvedPath);
  const validatedOutDir = resolveOutputDirectory(outDir, umbrellaBase, flags?.silent);
  const wrapperScript = `
import { pathToFileURL } from 'url';

const mod = await import(pathToFileURL(${JSON.stringify(resolvedPath)}).href);
const runner = mod.default || mod.run || mod.synth;
if (typeof runner !== 'function') {
  console.error('umbrella.ts must export a default/run/synth function');
  process.exit(1);
}

const output = ${JSON.stringify(validatedOutDir)};
const synthOptions = { mode: ${JSON.stringify(mode)} };
const fs = await import('fs');
fs.mkdirSync(output, { recursive: true });
await Promise.resolve(runner(output, synthOptions));
console.log('Umbrella chart written to ' + output);
`;

  const wrapperFile = path.join(process.cwd(), '.timonel-umbrella-wrapper.mjs');

  try {
    fs.writeFileSync(wrapperFile, wrapperScript);

    const result = spawnSync(process.execPath, [TSX_CLI_PATH, wrapperFile], {
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

// Main CLI function
/**
 * Parse command line flags with improved help handling
 * @param args - Command line arguments
 * @returns Parsed flags object
 * @since 2.9.2
 */
function parseFlags(args: string[]): CliFlags {
  const flags: CliFlags = {};

  while (args.length > 0 && args[0]?.startsWith('-')) {
    const flag = args.shift();
    switch (flag) {
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--silent':
        flags.silent = true;
        break;
      case '--env': {
        const envValue = args.shift();
        if (envValue) flags.env = envValue;
        break;
      }
      case '--set': {
        const setValue = args.shift();
        if (setValue) {
          flags.set = flags.set || [];
          flags.set.push(setValue);
        }
        break;
      }
      case '--mode': {
        const modeValue = args.shift();
        if (!modeValue || !UMBRELLA_SYNTH_MODES.includes(modeValue as UmbrellaSynthMode)) {
          usageAndExit('Invalid mode. Use "dependencies" or "inline".', flags.silent);
        }
        flags.mode = modeValue as UmbrellaSynthMode;
        break;
      }
      case '--help':
      case '-h':
        usageAndExit(undefined, flags.silent);
        break;
      default:
        usageAndExit(`Unknown flag: ${flag}`, flags.silent);
    }
  }
  return flags;
}

async function executeCommand(
  command: string | undefined,
  args: string[],
  flags: CliFlags,
): Promise<void> {
  switch (command) {
    case 'init':
      await cmdInit(args[0], flags.silent);
      break;
    case 'synth':
      await cmdSynth(args[0], flags, args[1]);
      break;
    case 'validate':
      await cmdValidate(flags);
      break;
    case 'deploy':
      await cmdDeploy(args[0], args[1], flags);
      break;
    case 'templates':
      await cmdTemplates(flags);
      break;
    case 'umbrella':
      await cmdUmbrella(args[0], args.slice(1), flags);
      break;
    case 'help':
    case undefined:
      usageAndExit(undefined, flags.silent);
      break;
    default:
      usageAndExit(`Unknown command: ${command}`, flags.silent);
  }
}

/**
 * Enhanced main function with better error handling
 * @since 2.9.2
 */
async function main() {
  const args = process.argv.slice(2);

  // Check for silent flag early
  const isSilent = args.includes('--silent');

  // Handle help flags first, before extracting command
  if (args.includes('--help') || args.includes('-h')) {
    usageAndExit(undefined, isSilent);
    return;
  }

  const command = args.shift();
  const flags = parseFlags(args);
  await executeCommand(command, args, flags);
}

// Run CLI with enhanced error handling
main().catch((error) => {
  const flags = parseFlags(process.argv.slice(2));
  if (!flags.silent) {
    console.error('Error:', SecurityUtils.sanitizeLogMessage(error.message));
  }
  process.exit(1);
});
