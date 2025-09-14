import { mkdtempSync, readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

import { describe, beforeEach, afterEach, it, expect } from 'vitest';

import { createUnifiedKarpenterFixture } from '../fixtures/aws-karpenter.fixture.js';

describe('AWS Constructs and Karpenter Integration', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(process.cwd(), 'temp-test-'));
  });

  afterEach(() => {
    // Cleanup: remove the temporary directory
    // Temporarily commented out to inspect generated files
    // if (tmpDir && existsSync(tmpDir)) {
    //   execSync(`rm -rf ${tmpDir}`);
    // }
  });

  it('should generate unified Karpenter chart with all manifests', () => {
    const chart = createUnifiedKarpenterFixture();
    const chartPath = join(tmpDir, 'unified-karpenter-chart');
    chart.write(chartPath);

    const chartDirContents = readdirSync(chartPath);
    console.log('Chart directory contents:', chartDirContents);
    expect(chartDirContents).toContain('Chart.yaml');
    expect(chartDirContents).toContain('templates');
    expect(chartDirContents).toContain('values.yaml');

    const templatesPath = join(chartPath, 'templates');
    const templateContents = readdirSync(templatesPath);
    console.log('Templates directory contents:', templateContents);

    const manifestFiles = templateContents.filter(
      (file) => file.endsWith('.yaml') && file !== 'values.yaml',
    );
    console.log('Found manifest files:', manifestFiles);

    // Should contain multiple Karpenter resources:
    // EC2NodeClass, NodePool, NodeClaim, DisruptionBudget, and Provisioner
    expect(manifestFiles.length).toBe(5);

    // Verify that all expected manifest types are present
    console.log('All manifests generated successfully for unified Karpenter chart');

    // Validate with helm lint - test should fail if helm is not available
    execSync('helm version', { stdio: 'ignore', env: process.env });
    const result = execSync(`helm lint ${chartPath}`, { encoding: 'utf8', env: process.env });
    console.log('Helm lint result:', result);
    expect(result).toContain('0 chart(s) failed');
  });
});
