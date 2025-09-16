#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { SecurityUtils } from './lib/security.js';
import type { SubchartProps } from './lib/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const UMBRELLA_CONFIG_FILE = 'umbrella.config.json';
const UMBRELLA_FILE_NAME = 'umbrella.ts';

// Helper functions
function log(msg: string, silent = false) {
  if (!silent) {
    console.log(msg);
  }
}

function usageAndExit(msg?: string) {
  if (msg) {
    console.error(`Error: ${msg}`);
  }
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
      '  --version, -v                        Show version information',
      '  --help, -h                           Show this help message',
      '',
      'Examples:',
      '  tl init my-app',
      '  tl synth my-app my-app/dist',
      '  tl validate my-app',
      '  tl deploy my-app my-release --env prod',
      '  tl synth my-app --dry-run --silent',
      '  tl synth my-app --set replicas=5 --set image.tag=v2.0.0',
      '  tl deploy my-app my-release --set service.port=8080',
    ].join('\n'),
  );
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
  const { generateBasicChart } = await import('./lib/templates/basic-chart.js');

  // Write chart file only - following CDK8s best practices
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(chartFile, generateBasicChart(validName));

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
 * @since 2.8.4
 */
async function cmdSynth(chartDirOrOutDir?: string, flags?: CliFlags) {
  let chartDir = process.cwd();
  let outDir: string | undefined;

  // If the parameter is a directory containing chart.ts, use it as chart directory
  if (chartDirOrOutDir && fs.existsSync(path.join(chartDirOrOutDir, 'chart.ts'))) {
    chartDir = path.resolve(chartDirOrOutDir);
  } else {
    // Otherwise, treat it as output directory for backward compatibility
    outDir = chartDirOrOutDir;
  }

  const chartFile = path.join(chartDir, 'chart.ts');
  const defaultOutDir = path.join(chartDir, 'dist');

  if (!fs.existsSync(chartFile)) {
    console.error('chart.ts not found. Run `tl init` first.');
    process.exit(1);
  }

  const resolvedOutDir = outDir ? path.resolve(outDir) : defaultOutDir;

  // Read the original chart file and modify the writeHelmChart output directory
  const originalContent = fs.readFileSync(chartFile, 'utf8');
  const modifiedContent = originalContent.replace(
    /chart\.writeHelmChart\(['"][^'"]*['"]\)/,
    `chart.writeHelmChart('${resolvedOutDir}')`,
  );

  // Create a temporary modified chart file
  const tempChartFile = path.join(chartDir, '.timonel-temp-chart.ts');
  fs.writeFileSync(tempChartFile, modifiedContent);

  // Create wrapper script for tsx execution
  const wrapperScript = `
import { pathToFileURL } from 'url';

// Import the modified chart file which should execute the synthesis directly
await import(pathToFileURL('${tempChartFile}').href);
`;

  const wrapperFile = path.join(chartDir, '.timonel-wrapper.mjs');

  try {
    fs.writeFileSync(wrapperFile, wrapperScript);

    const result = spawnSync('npx', ['tsx', wrapperFile].filter(Boolean), {
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
    if (fs.existsSync(wrapperFile)) {
      fs.unlinkSync(wrapperFile);
    }
    // Clean up temporary chart file
    if (fs.existsSync(tempChartFile)) {
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
 */
async function cmdValidate(flags?: CliFlags) {
  const result = spawnSync('helm', ['lint', '.'], {
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
 */
async function cmdDeploy(release?: string, namespace?: string, flags?: CliFlags) {
  if (!release) usageAndExit('Missing <release>');

  const args = ['upgrade', '--install', release, '.'];
  if (namespace) {
    args.push('--namespace', namespace);
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
    console.log(JSON.stringify(templates));
  } else {
    console.log('Available templates:');
    templates.forEach((t) => {
      console.log(`\n${t.name}`);
      console.log(`  Description: ${t.description}`);
      console.log(`  Usage: ${t.usage}`);
    });
  }
}

interface CliFlags {
  dryRun?: boolean;
  silent?: boolean;
  env?: string;
  set?: string[];
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
    version: '0.1.0',
    description: `${validName} umbrella chart`,
    subcharts: [] as SubchartProps[],
  };

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
  const hasExistingEntries = /\{\s*name:\s*['"]/.test(subchartsContent || '');

  if (!hasExistingEntries) {
    return `\n    // Add your subcharts here:\n    ${subchartEntry},\n  `;
  }

  const trimmedContent = subchartsContent?.trimEnd() ?? '';
  const needsComma = !trimmedContent.endsWith(',');
  const comma = needsComma ? ',' : '';
  return trimmedContent + `${comma}\n    ${subchartEntry}`;
}

function addSubchartToArray(content: string, chartName: string, camelCaseName: string): string {
  const subchartsRegex = /subcharts:\s*\[([\s\S]*?)\]/;
  const match = content.match(subchartsRegex);

  if (!match) {
    return content;
  }

  const subchartsContent = match[1];

  if (subchartsContent?.includes(`name: '${chartName}'`)) {
    return content;
  }

  const subchartEntry = `{ name: '${chartName}', chart: ${camelCaseName} }`;
  const newSubchartsContent = buildSubchartsContent(subchartsContent, subchartEntry);

  return content.replace(subchartsRegex, `subcharts: [${newSubchartsContent}\n  ]`);
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
  const subchartDir = path.join(process.cwd(), 'charts', validSubchartPath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.mkdirSync(subchartDir, { recursive: true });

  const chartFile = path.join(subchartDir, 'chart.ts');
  const { generateSubchartTemplate } = await import('./lib/templates/subchart.js');
  const subchartContent = generateSubchartTemplate(subchartName);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI tool needs dynamic paths
  fs.writeFileSync(chartFile, subchartContent);

  // Update config
  config.subcharts.push({
    name: subchartName,
    version: '0.1.0',
    path: `./charts/${validSubchartPath}/chart.ts`,
  } as SubchartProps);

  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

  // Update umbrella.ts file automatically with the path
  updateUmbrellaTs(validSubchartPath, subchartName);

  log(`Subchart ${subchartName} added to umbrella at path '${validSubchartPath}'`, silent);
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

  const resolvedOutDir = outDir ? path.resolve(outDir) : defaultOutDir;
  await executeTypeScriptUmbrella(umbrellaFile, resolvedOutDir, flags);
}

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

    const result = spawnSync('npx', ['tsx', wrapperFile].filter(Boolean), {
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
      case '--version':
      case '-v':
        console.log('Timonel v0.1.0');
        process.exit(0);
        break;
      case '--help':
      case '-h':
        usageAndExit();
        break;
      default:
        usageAndExit(`Unknown flag: ${flag}`);
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
      await cmdSynth(args[0], flags);
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
    case undefined:
      usageAndExit('Missing command');
      break;
    default:
      usageAndExit(`Unknown command: ${command}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args.shift();

  const flags = parseFlags(args);
  await executeCommand(command, args, flags);
}

// Run CLI
main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
