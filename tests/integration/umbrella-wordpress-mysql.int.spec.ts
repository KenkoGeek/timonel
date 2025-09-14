/**
 * @fileoverview Integration tests for umbrella chart generation with WordPress+MySQL architecture
 * @since 0.2.0
 */

import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import YAML from 'yaml';

import { createUmbrella } from '../../src/lib/umbrella.js';
import {
  createWordPressMySQLUmbrellaFixture,
  createMinimalUmbrellaFixture,
} from '../fixtures/umbrella/wordpress-mysql.fixture.js';
import {
  expectedChartYaml,
  expectedValuesYaml,
  expectedProductionValuesYaml,
  expectedStagingValuesYaml,
  expectedDirectoryStructure,
  expectedDependencies,
  expectedWordPressChartYaml,
  expectedMySQLChartYaml,
} from '../goldens/umbrella/wordpress-mysql.golden.js';

describe('Umbrella Chart Integration - WordPress+MySQL', () => {
  let tempDir: string;
  let outputDir: string;

  beforeEach(() => {
    // Create temporary directory for test output within project
    tempDir = mkdtempSync(join(process.cwd(), 'temp-test-'));
    outputDir = join(tempDir, 'wordpress-umbrella');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should generate complete umbrella chart with WordPress and MySQL subcharts', () => {
    // Create umbrella chart using fixture
    const umbrellaProps = createWordPressMySQLUmbrellaFixture();
    const umbrella = createUmbrella(umbrellaProps);
    umbrella.write(outputDir);

    // Verify umbrella chart structure using golden data
    expectedDirectoryStructure.forEach((path) => {
      const fullPath = join(outputDir, path);
      expect(existsSync(fullPath)).toBe(true);
    });

    // Verify umbrella Chart.yaml content using golden data
    const chartYamlContent = readFileSync(join(outputDir, 'Chart.yaml'), 'utf-8');
    const chartYaml = YAML.parse(chartYamlContent);
    const expectedChart = YAML.parse(expectedChartYaml);

    expect(chartYaml).toMatchObject(expectedChart);
    expect(chartYaml.dependencies).toEqual(expectedDependencies);

    // Verify umbrella values.yaml content using golden data
    const valuesYamlContent = readFileSync(join(outputDir, 'values.yaml'), 'utf-8');
    const valuesYaml = YAML.parse(valuesYamlContent);
    const expectedValues = YAML.parse(expectedValuesYaml);

    expect(valuesYaml).toMatchObject(expectedValues);

    // Verify production values override using golden data
    const prodValuesContent = readFileSync(join(outputDir, 'values-production.yaml'), 'utf-8');
    const prodValues = YAML.parse(prodValuesContent);
    const expectedProdValues = YAML.parse(expectedProductionValuesYaml);

    expect(prodValues).toMatchObject(expectedProdValues);

    // Verify staging values override using golden data
    const stagingValuesContent = readFileSync(join(outputDir, 'values-staging.yaml'), 'utf-8');
    const stagingValues = YAML.parse(stagingValuesContent);
    const expectedStagingValues = YAML.parse(expectedStagingValuesYaml);

    expect(stagingValues).toMatchObject(expectedStagingValues);

    // Verify NOTES.txt content
    const notesContent = readFileSync(join(outputDir, 'templates', 'NOTES.txt'), 'utf-8');
    expect(notesContent).toContain('Get the application URLs');
    expect(notesContent).toContain('charts/wordpress/README.md');
    expect(notesContent).toContain('charts/mysql/README.md');

    // Verify subchart metadata using golden data
    const wordpressChartContent = readFileSync(
      join(outputDir, 'charts', 'wordpress', 'Chart.yaml'),
      'utf-8',
    );
    const wordpressChart = YAML.parse(wordpressChartContent);
    const expectedWordPressChart = YAML.parse(expectedWordPressChartYaml);
    expect(wordpressChart).toMatchObject(expectedWordPressChart);

    const mysqlChartContent = readFileSync(
      join(outputDir, 'charts', 'mysql', 'Chart.yaml'),
      'utf-8',
    );
    const mysqlChart = YAML.parse(mysqlChartContent);
    const expectedMySQLChart = YAML.parse(expectedMySQLChartYaml);
    expect(mysqlChart).toMatchObject(expectedMySQLChart);

    // Validate with helm lint if available
    try {
      execSync('helm version', { stdio: 'ignore' });
      const result = execSync(`helm lint ${outputDir}`, { encoding: 'utf8' });
      console.log('Helm lint result:', result);
      expect(result).toContain('0 chart(s) failed');
    } catch (error) {
      if (error.message.includes('helm')) {
        console.warn('Helm not available, skipping helm lint validation');
      } else {
        console.error('Helm lint failed:', error.message);
        throw error;
      }
    }
  });

  it('should handle umbrella chart with minimal configuration', () => {
    // Create minimal umbrella chart using fixture
    const minimalProps = createMinimalUmbrellaFixture();
    const umbrella = createUmbrella(minimalProps);
    umbrella.write(outputDir);

    // Verify basic structure
    expect(existsSync(join(outputDir, 'Chart.yaml'))).toBe(true);
    expect(existsSync(join(outputDir, 'values.yaml'))).toBe(true);
    expect(existsSync(join(outputDir, 'charts', 'simple-app'))).toBe(true);

    // Verify Chart.yaml has default values for optional fields
    const chartContent = readFileSync(join(outputDir, 'Chart.yaml'), 'utf-8');
    const chart = YAML.parse(chartContent);

    expect(chart.dependencies[0]).toMatchObject({
      name: 'simple-app',
      version: '0.1.0',
      repository: 'file://./charts/simple-app',
    });
    expect(chart.dependencies[0]).not.toHaveProperty('condition');
    expect(chart.dependencies[0]).not.toHaveProperty('tags');
  });

  // Helm validation is now integrated into the main chart generation test above
});
