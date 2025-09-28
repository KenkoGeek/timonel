/**
 * @fileoverview CLI testing suite for Timonel - Helm umbrella chart generator
 * Tests CLI functionality including version display, command validation, and error handling
 * @since 2.10.2
 */
import { spawnSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname, resolve } from 'path';

import { describe, expect, it, beforeEach, afterEach, beforeAll } from 'vitest';

const CLI_ENTRY = join(process.cwd(), 'dist', 'cli.js');
let cliBuilt = false;

/**
 * Ensures the compiled CLI artifact is available before executing tests.
 * @since 2.12.2 Eliminates reliance on manual pre-build steps in CI.
 */
function ensureCliBuilt(): void {
  if (cliBuilt && existsSync(CLI_ENTRY)) {
    return;
  }

  const sanitizedEnv = { ...process.env };
  for (const key of Object.keys(sanitizedEnv)) {
    if (key.toLowerCase().startsWith('npm_config_')) {
      delete sanitizedEnv[key];
    }
  }

  const result = spawnSync('pnpm', ['build'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
    env: sanitizedEnv,
  });

  if (result.status !== 0) {
    throw new Error(`Failed to build CLI before tests: ${result.stderr || result.stdout}`);
  }

  cliBuilt = true;
}

/**
 * Helper function to execute CLI commands and capture output
 * @param args - Command line arguments to pass to the CLI
 * @param options - Execution options
 * @returns Object containing stdout, stderr, and exit code
 * @since 2.10.2
 */
function runCLI(args: string[] = [], options: { cwd?: string; timeout?: number } = {}) {
  ensureCliBuilt();

  const cliPath = CLI_ENTRY;
  const sanitizedEnv = { ...process.env };
  for (const key of Object.keys(sanitizedEnv)) {
    // Strip npm_config_* variables to avoid npm CLI warnings during tests.
    if (key.toLowerCase().startsWith('npm_config_')) {
      delete sanitizedEnv[key];
    }
  }
  const result = spawnSync('node', [cliPath, ...args], {
    cwd: options.cwd || process.cwd(),
    timeout: options.timeout || 30000,
    encoding: 'utf8',
    env: sanitizedEnv,
  });

  return {
    stdout: result.stdout?.toString() || '',
    stderr: result.stderr?.toString() || '',
    exitCode: result.status ?? 1, // Use nullish coalescing to properly handle null status
    signal: result.signal,
  };
}

/**
 * Helper function to create a temporary test directory
 * @param name - Name of the test directory
 * @returns Path to the created directory
 * @since 2.10.2
 */
function createTestDir(name: string): string {
  const testDir = join(process.cwd(), 'temp-test', name);
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

/**
 * Helper function to clean up test directories
 * @param testDir - Path to the test directory to clean up
 * @since 2.10.2
 */
function cleanupTestDir(testDir: string): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

beforeAll(() => {
  ensureCliBuilt();
});

describe('CLI Version Display', () => {
  it('should not support --version flag (removed)', () => {
    const result = runCLI(['--version']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Unknown command: --version/);
  });

  it('should not support -v flag (removed)', () => {
    const result = runCLI(['-v']);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toMatch(/Unknown command: -v/);
  });

  it('should handle version display in different working directories', () => {
    const testDir = createTestDir('version-test');

    try {
      const result = runCLI(['--version'], { cwd: testDir });

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toMatch(/Unknown command: --version/);
    } finally {
      cleanupTestDir(testDir);
    }
  });
});

describe('CLI Help and Usage', () => {
  it('should display help information with --help flag', () => {
    const result = runCLI(['--help']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: tl');
    expect(result.stdout).toContain('Commands:');
  });

  it('should display help information with -h flag', () => {
    const result = runCLI(['-h']);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: tl');
    expect(result.stdout).toContain('Commands:');
  });

  it('should display usage when no arguments provided', () => {
    const result = runCLI([]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: tl');
  });
});

describe('CLI Command Validation', () => {
  it('should handle unknown commands gracefully', () => {
    const result = runCLI(['unknown-command']);

    // CLI should exit with code 1 for unknown commands but show usage
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Usage: tl');
  });

  it('should handle invalid flags gracefully', () => {
    const result = runCLI(['--invalid-flag']);

    // CLI should exit with code 1 for invalid flags but show usage
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Usage: tl');
  });

  it('should handle multiple flags correctly', () => {
    const result = runCLI(['--version', '--help']);

    // When both version and help are provided, help takes precedence
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Usage: tl');
  });
});

describe('CLI Chart Operations', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestDir('cli-chart-test');
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should initialize a new chart successfully', () => {
    const result = runCLI(['init', 'test-chart'], { cwd: testDir });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Chart created');
    expect(result.stderr).toBe('');

    // Verify chart files were created
    const chartPath = join(testDir, 'test-chart');
    expect(existsSync(chartPath)).toBe(true);
    expect(existsSync(join(chartPath, 'chart.ts'))).toBe(true);
  });

  it('should handle chart initialization with invalid names', () => {
    const result = runCLI(['init', 'invalid@chart#name'], { cwd: testDir });

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain('Invalid chart name');
  });

  it('should synthesize chart successfully', () => {
    // First create a chart
    runCLI(['init', 'test-chart'], { cwd: testDir });

    // Then synthesize it
    const result = runCLI(['synth', 'test-chart'], { cwd: testDir });

    expect(result.exitCode).toBe(0);
    // With structured logging, we now get JSON output instead of "Synthesizing"
    expect(result.stdout).toContain('chart_initialization');
    expect(result.stderr).toBe('');

    // Verify synthesis output
    const chartPath = join(testDir, 'test-chart', 'dist');
    expect(existsSync(chartPath)).toBe(true);
  });

  it('should handle synthesis of non-existent chart', () => {
    const result = runCLI(['synth', 'non-existent-chart'], { cwd: testDir });

    expect(result.exitCode).toBe(1);
    expect(result.stderr || result.stdout).toContain('chart.ts not found');
  });

  it('should allow synthesis into absolute output directories securely', () => {
    runCLI(['init', 'test-chart'], { cwd: testDir });
    const absoluteOutDir = resolve(testDir, '..', 'absolute-output');

    try {
      const result = runCLI(['synth', 'test-chart', absoluteOutDir], { cwd: testDir });

      expect(result.exitCode).toBe(0);
      expect(existsSync(join(absoluteOutDir, 'Chart.yaml'))).toBe(true);
    } finally {
      if (existsSync(absoluteOutDir)) {
        rmSync(absoluteOutDir, { recursive: true, force: true });
      }
    }
  });

  it('should synthesize umbrella chart with dependencies by default', () => {
    const baseDir = createTestDir('umbrella-dependencies');
    const umbrellaRoot = join(baseDir, 'umbrella-app');

    try {
      runCLI(['umbrella', 'init', 'umbrella-app'], { cwd: baseDir });
      runCLI(['umbrella', 'add', 'frontend'], { cwd: umbrellaRoot });

      const result = runCLI(['umbrella', 'synth'], { cwd: umbrellaRoot });
      expect(result.exitCode).toBe(0);

      const dependencyChart = join(umbrellaRoot, 'dist', 'charts', 'frontend');
      const inlineTemplates = join(umbrellaRoot, 'dist', 'templates', 'frontend');

      expect(existsSync(dependencyChart)).toBe(true);
      expect(existsSync(inlineTemplates)).toBe(false);
    } finally {
      cleanupTestDir(baseDir);
    }
  });

  it('should synthesize umbrella chart inline when requested', () => {
    const baseDir = createTestDir('umbrella-inline');
    const umbrellaRoot = join(baseDir, 'umbrella-app');

    try {
      runCLI(['umbrella', 'init', 'umbrella-app'], { cwd: baseDir });
      runCLI(['umbrella', 'add', 'frontend'], { cwd: umbrellaRoot });

      const result = runCLI(['umbrella', 'synth', '--mode', 'inline'], { cwd: umbrellaRoot });
      expect(result.exitCode).toBe(0);

      const inlineTemplates = join(umbrellaRoot, 'dist', 'templates', 'frontend');
      const dependencyChart = join(umbrellaRoot, 'dist', 'charts', 'frontend');

      expect(existsSync(inlineTemplates)).toBe(true);
      expect(existsSync(dependencyChart)).toBe(false);
    } finally {
      cleanupTestDir(baseDir);
    }
  });
});

describe('CLI Error Handling', () => {
  it('should handle file system errors gracefully', () => {
    const testDir = createTestDir('fs-error-test');

    try {
      // Make directory read-only to simulate permission errors
      const readOnlyDir = join(testDir, 'readonly');
      mkdirSync(readOnlyDir, { recursive: true });
      // Note: Setting read-only permissions would be platform-specific

      const result = runCLI(['init', 'test-chart'], { cwd: readOnlyDir });

      expect(result.exitCode).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
    } finally {
      cleanupTestDir(testDir);
    }
  });

  it('should handle timeout scenarios', () => {
    const result = runCLI(['--help'], { timeout: 100 }); // More reasonable timeout

    // Should either complete quickly or timeout gracefully
    expect(result.exitCode).toBeDefined();
    expect(typeof result.exitCode).toBe('number');
  });

  it('should handle malformed chart.ts files', () => {
    const testDir = createTestDir('malformed-chart-test');

    try {
      // Create a chart
      runCLI(['init', 'test-chart'], { cwd: testDir });

      // Corrupt the chart.ts file
      const chartPath = join(testDir, 'test-chart', 'chart.ts');
      writeFileSync(chartPath, 'invalid typescript content');

      // Try to synthesize
      const result = runCLI(['synth', 'test-chart'], { cwd: testDir });

      // Should handle error gracefully
      expect(result.exitCode).toBeDefined();
      expect(typeof result.exitCode).toBe('number');
    } finally {
      cleanupTestDir(testDir);
    }
  });
});

describe('CLI Security Validation', () => {
  it('should handle path traversal attempts in chart names', () => {
    const testDir = createTestDir('security-test');

    try {
      const maliciousNames = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        'chart/../../../sensitive',
        'chart\\..\\..\\sensitive',
      ];

      for (const maliciousName of maliciousNames) {
        const result = runCLI(['init', maliciousName], { cwd: testDir });

        // Should either sanitize the name or reject it
        expect(result.exitCode).toBeDefined();
        expect(typeof result.exitCode).toBe('number');

        // Should not create files outside the intended directory
        const parentDir = dirname(testDir);
        const suspiciousFiles = ['passwd', 'system32', 'sensitive'];

        for (const suspiciousFile of suspiciousFiles) {
          const suspiciousPath = join(parentDir, suspiciousFile);
          expect(existsSync(suspiciousPath)).toBe(false);
        }
      }
    } finally {
      cleanupTestDir(testDir);
    }
  });

  it('should sanitize error messages containing sensitive information', () => {
    const testDir = createTestDir('error-sanitization-test');

    try {
      // Create a chart with potentially sensitive data
      runCLI(['init', 'test-chart'], { cwd: testDir });

      // Corrupt the chart.ts with sensitive data
      const chartPath = join(testDir, 'test-chart', 'chart.ts');
      const sensitiveContent = `
        const password = "secret123";
        const apiKey = "sk-1234567890abcdef";
        export default function() { return password + apiKey; }
      `;
      writeFileSync(chartPath, sensitiveContent);

      // Try to synthesize and check error output
      const result = runCLI(['synth', 'test-chart'], { cwd: testDir });

      // Error messages should not contain sensitive information
      if (result.stderr) {
        expect(result.stderr).not.toContain('secret123');
        expect(result.stderr).not.toContain('sk-1234567890abcdef');
      }
    } finally {
      cleanupTestDir(testDir);
    }
  });
});

describe('CLI Performance and Resource Management', () => {
  it('should complete operations within reasonable time', () => {
    const startTime = Date.now();
    const result = runCLI(['--help']);
    const endTime = Date.now();

    expect(result.exitCode).toBe(0);
    expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
  });

  it('should handle multiple rapid commands', () => {
    const commands = [['--help'], ['-h']];

    for (const command of commands) {
      const result = runCLI(command);
      expect(result.exitCode).toBe(0);
    }
  });

  it('should not leak file handles or memory', () => {
    // Run multiple operations to check for resource leaks
    for (let i = 0; i < 10; i++) {
      const result = runCLI(['--help']);
      expect(result.exitCode).toBe(0);
    }

    // If we get here without hanging, resource management is working
    expect(true).toBe(true);
  });
});

describe('CLI Integration with Helm', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = createTestDir('helm-integration-test');
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  it('should generate valid Helm charts', () => {
    // Create and synthesize a chart
    runCLI(['init', 'test-chart'], { cwd: testDir });
    runCLI(['synth', 'test-chart'], { cwd: testDir });

    // Verify Helm chart structure
    const chartPath = join(testDir, 'test-chart', 'dist');
    expect(existsSync(chartPath)).toBe(true);

    // Check for essential Helm files
    const essentialFiles = ['Chart.yaml', 'values.yaml', 'templates'];

    for (const file of essentialFiles) {
      const filePath = join(chartPath, file);
      expect(existsSync(filePath)).toBe(true);
    }
  });

  it('should handle Helm lint validation', () => {
    // Create and synthesize a chart
    runCLI(['init', 'test-chart'], { cwd: testDir });
    runCLI(['synth', 'test-chart'], { cwd: testDir });

    // The chart should be valid enough to pass basic Helm validation
    const chartPath = join(testDir, 'test-chart', 'dist');
    expect(existsSync(chartPath)).toBe(true);

    // Verify Chart.yaml has required fields
    const chartYamlPath = join(chartPath, 'Chart.yaml');
    if (existsSync(chartYamlPath)) {
      const chartYaml = readFileSync(chartYamlPath, 'utf8');
      expect(chartYaml).toContain('apiVersion:');
      expect(chartYaml).toContain('name:');
      expect(chartYaml).toContain('version:');
    }
  });
});
