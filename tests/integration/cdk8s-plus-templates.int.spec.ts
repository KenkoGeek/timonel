import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('CDK8s-Plus Templates Integration', () => {
  const testDir = path.join(__dirname, '__temp_templates__');
  const cliPath = path.join(__dirname, '../../dist/cli.js');

  beforeAll(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Basic Chart Template', () => {
    it('should generate basic chart structure', () => {
      const chartName = 'test-basic-chart';
      const chartDir = path.join(testDir, chartName);

      // Generate basic chart using CLI
      execSync(`node ${cliPath} init ${chartName}`, {
        cwd: testDir,
        stdio: 'pipe',
      });

      // Verify chart.ts was created
      const chartFile = path.join(chartDir, 'chart.ts');
      expect(fs.existsSync(chartFile)).toBe(true);

      // Verify content structure
      const content = fs.readFileSync(chartFile, 'utf8');
      expect(content).toContain('import { App }');
      expect(content).toContain('BasicChart');
      expect(content).toContain('app.synth()');

      // Verify that the basic chart template (source) uses cdk8s-plus-33
      const basicTemplateSource = path.join(
        process.cwd(),
        'src',
        'lib',
        'templates',
        'basic-chart.ts',
      );
      expect(fs.existsSync(basicTemplateSource)).toBe(true);
      const templateContent = fs.readFileSync(basicTemplateSource, 'utf8');
      expect(templateContent).toContain('cdk8s-plus-33');
      expect(templateContent).toContain('kplus.Deployment');
      expect(templateContent).toContain('kplus.Service');
    });
  });

  describe('Umbrella Chart Template', () => {
    it('should generate umbrella chart with cdk8s-plus-33', () => {
      const chartName = 'test-umbrella';
      const chartDir = path.join(testDir, chartName);

      // Generate umbrella chart
      execSync(`node ${cliPath} umbrella init ${chartName}`, {
        cwd: testDir,
        stdio: 'pipe',
      });

      // Check that umbrella.ts was created
      const umbrellaFile = path.join(chartDir, 'umbrella.ts');
      expect(fs.existsSync(umbrellaFile)).toBe(true);

      // Check that umbrella.config.json was created
      const configFile = path.join(chartDir, 'umbrella.config.json');
      expect(fs.existsSync(configFile)).toBe(true);

      // Check umbrella.ts content structure
      const umbrellaContent = fs.readFileSync(umbrellaFile, 'utf8');
      expect(umbrellaContent).toContain('import { App }');
      expect(umbrellaContent).toContain('UmbrellaChart');
      expect(umbrellaContent).toContain('app.synth()');

      // Check config file content
      const configContent = fs.readFileSync(configFile, 'utf8');
      const config = JSON.parse(configContent);
      expect(config.name).toBe(chartName);
      expect(config.version).toBe('0.1.0');
      expect(config.subcharts).toEqual([]);

      // Verify that the umbrella chart template (source) uses cdk8s-plus-33
      const umbrellaTemplateSource = path.join(
        process.cwd(),
        'src',
        'lib',
        'templates',
        'umbrella-chart.ts',
      );
      expect(fs.existsSync(umbrellaTemplateSource)).toBe(true);
      const templateContent = fs.readFileSync(umbrellaTemplateSource, 'utf8');
      expect(templateContent).toContain('cdk8s-plus-33');
    });
  });
});
