import { execSync } from 'child_process';
import * as path from 'path';

import { describe, it, expect } from 'vitest';

describe('CLI Templates Command Integration', () => {
  const cliPath = path.join(__dirname, '../../dist/cli.js');

  it('should list available templates', () => {
    const output = execSync(`node ${cliPath} templates`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../..'),
    });

    expect(output).toContain('Available chart templates:');
    expect(output).toContain('basic-chart');
    expect(output).toContain('umbrella-chart');
    expect(output).toContain('subchart');
    expect(output).toContain(
      'Description: Basic chart template with Deployment and Service using cdk8s-plus-33',
    );
    expect(output).toContain('Usage: tl init <chart-name>');
  });

  it('should run templates command with silent flag', () => {
    const output = execSync(`node ${cliPath} templates --silent`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '../..'),
    });

    // With silent flag, there should be no output
    expect(output.trim()).toBe('');
  });
});
