#!/usr/bin/env tsx

/**
 * Documentation Coverage Validation Script.
 *
 * Validates that the project maintains a minimum documentation coverage threshold.
 * This script is designed to be used in CI/CD pipelines and pre-commit hooks to
 * ensure documentation quality standards are maintained.
 *
 * @example Usage in CI/CD
 * ```bash
 * npx tsx scripts/validate-doc-coverage.ts
 * ```
 *
 * @example Usage with custom threshold
 * ```bash
 * DOC_COVERAGE_THRESHOLD=95 npx tsx scripts/validate-doc-coverage.ts
 * ```
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Configuration for documentation coverage validation.
 */
interface CoverageConfig {
  /** Minimum required documentation coverage percentage. */
  minCoverage: number;
  /** Maximum number of files allowed below 80% coverage. */
  maxFilesBelow80: number;
  /** Whether to fail on any files below the minimum threshold. */
  strictMode: boolean;
}

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG: CoverageConfig = {
  minCoverage: 85.0,
  maxFilesBelow80: 5,
  strictMode: false,
};

/**
 * ANSI color codes for console output.
 */
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

/**
 * Parses documentation coverage output to extract metrics.
 *
 * @param output - Raw output from the doc-coverage script.
 * @returns Parsed coverage metrics.
 */
function parseCoverageOutput(output: string): {
  totalCoverage: number;
  filesBelow80: number;
  filesAnalyzed: number;
} {
  const lines = output.split('\n');

  let totalCoverage = 0;
  let filesBelow80 = 0;
  let filesAnalyzed = 0;

  for (const line of lines) {
    // Parse total coverage: "🎯 Total Coverage: 92.1%"
    const coverageMatch = line.match(/🎯 Total Coverage: ([\d.]+)%/);
    if (coverageMatch) {
      totalCoverage = parseFloat(coverageMatch[1]);
    }

    // Parse files below 80%: "⚠️  Files Below 80%: 3"
    const filesBelow80Match = line.match(/⚠️\s+Files Below 80%: (\d+)/);
    if (filesBelow80Match) {
      filesBelow80 = parseInt(filesBelow80Match[1], 10);
    }

    // Parse files analyzed: "📁 Files Analyzed: 41"
    const filesAnalyzedMatch = line.match(/📁 Files Analyzed: (\d+)/);
    if (filesAnalyzedMatch) {
      filesAnalyzed = parseInt(filesAnalyzedMatch[1], 10);
    }
  }

  return { totalCoverage, filesBelow80, filesAnalyzed };
}

/**
 * Validates documentation coverage against configured thresholds.
 *
 * @param config - Coverage validation configuration.
 * @returns Promise that resolves if validation passes, rejects if it fails.
 */
async function validateDocumentationCoverage(config: CoverageConfig): Promise<void> {
  console.log(`${colors.blue}${colors.bold}📊 Validating Documentation Coverage${colors.reset}`);
  console.log(`${colors.cyan}Minimum required coverage: ${config.minCoverage}%${colors.reset}`);
  console.log(`${colors.cyan}Maximum files below 80%: ${config.maxFilesBelow80}${colors.reset}`);
  console.log('');

  try {
    // Check if the project-doc-coverage script exists
    const scriptPath = join(process.cwd(), 'scripts', 'project-doc-coverage.ts');
    if (!existsSync(scriptPath)) {
      throw new Error(
        'Documentation coverage script not found. Please ensure scripts/project-doc-coverage.ts exists.',
      );
    }

    // Run the documentation coverage analysis
    console.log(`${colors.blue}Running documentation coverage analysis...${colors.reset}`);
    const output = execSync('npx tsx scripts/project-doc-coverage.ts', {
      encoding: 'utf8',
      stdio: 'pipe',
    });

    // Parse the coverage metrics
    const metrics = parseCoverageOutput(output);

    if (metrics.totalCoverage === 0) {
      throw new Error(
        'Failed to parse documentation coverage output. Please check the script output format.',
      );
    }

    console.log(`${colors.green}✅ Documentation coverage analysis completed${colors.reset}`);
    console.log('');

    // Display current metrics
    console.log(`${colors.bold}📈 Current Documentation Metrics:${colors.reset}`);
    console.log(`   Total Coverage: ${colors.bold}${metrics.totalCoverage}%${colors.reset}`);
    console.log(`   Files Below 80%: ${colors.bold}${metrics.filesBelow80}${colors.reset}`);
    console.log(`   Files Analyzed: ${colors.bold}${metrics.filesAnalyzed}${colors.reset}`);
    console.log('');

    // Validate against thresholds
    const failures: string[] = [];

    if (metrics.totalCoverage < config.minCoverage) {
      failures.push(
        `Total coverage ${metrics.totalCoverage}% is below minimum required ${config.minCoverage}%`,
      );
    }

    if (metrics.filesBelow80 > config.maxFilesBelow80) {
      failures.push(
        `${metrics.filesBelow80} files below 80% coverage exceeds maximum allowed ${config.maxFilesBelow80}`,
      );
    }

    if (failures.length > 0) {
      console.log(
        `${colors.red}${colors.bold}❌ Documentation Coverage Validation Failed${colors.reset}`,
      );
      console.log('');
      failures.forEach((failure) => {
        console.log(`   ${colors.red}• ${failure}${colors.reset}`);
      });
      console.log('');
      console.log(`${colors.yellow}💡 To improve documentation coverage:${colors.reset}`);
      console.log(`   1. Add JSDoc comments to functions, classes, and interfaces`);
      console.log(`   2. Include @param, @returns, and @throws tags where appropriate`);
      console.log(`   3. Add @example blocks for complex APIs`);
      console.log(`   4. Run 'npm run doc:coverage' to see detailed coverage report`);
      console.log('');

      process.exit(1);
    }

    // Success!
    console.log(
      `${colors.green}${colors.bold}✅ Documentation Coverage Validation Passed${colors.reset}`,
    );
    console.log(
      `${colors.green}   Coverage ${metrics.totalCoverage}% meets minimum requirement of ${config.minCoverage}%${colors.reset}`,
    );
    console.log(
      `${colors.green}   ${metrics.filesBelow80} files below 80% is within limit of ${config.maxFilesBelow80}${colors.reset}`,
    );
    console.log('');
  } catch (error) {
    console.log(
      `${colors.red}${colors.bold}❌ Documentation Coverage Validation Error${colors.reset}`,
    );
    console.log(
      `${colors.red}${error instanceof Error ? error.message : String(error)}${colors.reset}`,
    );
    console.log('');
    process.exit(1);
  }
}

/**
 * Main execution function.
 */
async function main(): Promise<void> {
  // Load configuration from environment variables
  const config: CoverageConfig = {
    minCoverage: parseFloat(
      process.env.DOC_COVERAGE_THRESHOLD || String(DEFAULT_CONFIG.minCoverage),
    ),
    maxFilesBelow80: parseInt(
      process.env.DOC_MAX_FILES_BELOW_80 || String(DEFAULT_CONFIG.maxFilesBelow80),
      10,
    ),
    strictMode: process.env.DOC_STRICT_MODE === 'true',
  };

  await validateDocumentationCoverage(config);
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export { validateDocumentationCoverage, parseCoverageOutput };
