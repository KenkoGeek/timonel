// import * as fs from 'fs';
// import * as path from 'path';
// import * as cp from 'child_process';
// import { promisify } from 'util';

// import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// // Types
// interface Subchart {
//   name: string;
//   path: string;
// }

// const execAsync = promisify(cp.exec);

// // Test directories
// const TEST_DIR = path.join(process.cwd(), 'test-integration');
// const CHARTS_DIR = path.join(TEST_DIR, 'charts');
// const CLI_PATH = path.join(process.cwd(), 'dist', 'cli.js');

/*
describe('CLI Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });

    // Change to test directory
    process.chdir(TEST_DIR);
  });

  afterEach(() => {
    // Return to original directory
    process.chdir(path.join(__dirname, '../..'));

    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Full Chart Lifecycle', () => {
    it('should create, validate, and synthesize a chart', async () => {
      const chartName = 'test-app';
      const chartPath = path.join('charts', chartName);
      const chartFile = path.join(chartPath, 'chart.ts');

      // Step 1: Initialize a new chart
      const initResult = cp.spawnSync('node', [CLI_PATH, 'init', chartName], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(initResult.status).toBe(0);
      expect(fs.existsSync(chartFile)).toBe(true);

      // Verify chart content
      const chartContent = fs.readFileSync(chartFile, 'utf8');
      expect(chartContent).toContain(`name: '${chartName}'`);
      expect(chartContent).toContain("import { Rutter, helm } from 'timonel'");

      // Step 2: Validate the chart (skip if helm not available)
      try {
        cp.execSync('helm version', { stdio: 'ignore' });

        const validateResult = cp.spawnSync('node', [CLI_PATH, 'validate', chartPath], {
          cwd: TEST_DIR,
          encoding: 'utf8',
        });

        expect(validateResult.status).toBe(0);
      } catch (error) {
        console.log('Helm not available, skipping validation test');
      }

      // Step 3: Synthesize the chart (dry run)
      const synthResult = cp.spawnSync('node', [CLI_PATH, 'synth', chartPath, '--dry-run'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(synthResult.status).toBe(0);
      expect(synthResult.stdout).toContain('[DRY RUN]');
    }, 30000);

    it('should handle chart with custom values', async () => {
      const chartName = 'custom-app';
      const chartPath = path.join('charts', chartName);

      // Initialize chart
      const initResult = cp.spawnSync('node', [CLI_PATH, 'init', chartName], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(initResult.status).toBe(0);

      // Synthesize with custom values
      const synthResult = cp.spawnSync(
        'node',
        [
          CLI_PATH,
          'synth',
          chartPath,
          '--set',
          'replicas=3',
          '--set',
          'image.tag=v2.0.0',
          '--dry-run',
        ],
        {
          cwd: TEST_DIR,
          encoding: 'utf8',
        },
      );

      expect(synthResult.status).toBe(0);
      expect(synthResult.stdout).toContain('[DRY RUN]');
    }, 15000);
  });

  describe('Umbrella Chart Workflow', () => {
    it('should create umbrella chart and add subcharts', async () => {
      const umbrellaName = 'my-umbrella';

      // Step 1: Initialize umbrella chart
      const umbrellaInitResult = cp.spawnSync(
        'node',
        [CLI_PATH, 'umbrella', 'init', umbrellaName],
        {
          cwd: TEST_DIR,
          encoding: 'utf8',
        },
      );

      expect(umbrellaInitResult.status).toBe(0);
      expect(fs.existsSync(path.join(TEST_DIR, umbrellaName, 'umbrella.config.json'))).toBe(true);
      expect(fs.existsSync(path.join(TEST_DIR, umbrellaName, 'umbrella.ts'))).toBe(true);

      // Verify umbrella config
      const configContent = JSON.parse(
        fs.readFileSync(path.join(TEST_DIR, umbrellaName, 'umbrella.config.json'), 'utf8'),
      );
      expect(configContent.name).toBe(umbrellaName);
      expect(configContent.subcharts).toEqual([]);

      // Step 2: Create some subcharts
      const frontendResult = cp.spawnSync('node', [CLI_PATH, 'init', 'frontend'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });
      expect(frontendResult.status).toBe(0);

      const backendResult = cp.spawnSync('node', [CLI_PATH, 'init', 'backend'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });
      expect(backendResult.status).toBe(0);

      // Step 3: Add subcharts to umbrella
      const addFrontendResult = cp.spawnSync(
        'node',
        [
          CLI_PATH,
          'umbrella',
          'add',
          '../charts/frontend',
        ],
        {
          cwd: path.join(TEST_DIR, umbrellaName),
          encoding: 'utf8',
        },
      );
      expect(addFrontendResult.status).toBe(0);

      const addBackendResult = cp.spawnSync(
        'node',
        [
          CLI_PATH,
          'umbrella',
          'add',
          '../charts/backend',
        ],
        {
          cwd: path.join(TEST_DIR, umbrellaName),
          encoding: 'utf8',
        },
      );
      expect(addBackendResult.status).toBe(0);

      // Verify updated config
      const updatedConfig = JSON.parse(
        fs.readFileSync(path.join(TEST_DIR, umbrellaName, 'umbrella.config.json'), 'utf8'),
      );
      expect(updatedConfig.subcharts).toHaveLength(2);
      expect(updatedConfig.subcharts.some((sc: Subchart) => sc.name === 'frontend')).toBe(true);
      expect(updatedConfig.subcharts.some((sc: Subchart) => sc.name === 'backend')).toBe(true);

      // Step 4: Synthesize umbrella chart
      const umbrellaResult = cp.spawnSync('node', [CLI_PATH, 'umbrella', 'synth', '--dry-run'], {
        cwd: path.join(TEST_DIR, umbrellaName),
        encoding: 'utf8',
      });

      expect(umbrellaResult.status).toBe(0);
      expect(umbrellaResult.stdout).toContain('[DRY RUN]');
    }, 45000);
  });

  describe('Error Scenarios', () => {
    it('should handle invalid chart names gracefully', async () => {
      const invalidNames = ['Invalid-Name!', '123invalid', 'invalid@name'];

      for (const invalidName of invalidNames) {
        const result = cp.spawnSync('node', [CLI_PATH, 'init', invalidName], {
          cwd: TEST_DIR,
          encoding: 'utf8',
        });

        expect(result.status).toBe(1);
        expect(result.stderr || result.stdout).toContain('Invalid chart name');
      }
    });

    it('should handle invalid chart names with spaces', async () => {
      const invalidName = 'invalid name';

      const result = cp.spawnSync('node', [CLI_PATH, 'init', invalidName], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(result.status).toBe(1);
      expect(result.stderr || result.stdout).toContain('Invalid chart name');
    });

    it('should handle missing chart files', async () => {
      // Try to validate non-existent chart
      const validateResult = cp.spawnSync('node', [CLI_PATH, 'validate', 'charts/nonexistent'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(validateResult.status).toBe(1);
      expect(validateResult.stderr).toContain('chart.ts not found');

      // Try to synthesize non-existent chart
      const synthResult = cp.spawnSync('node', [CLI_PATH, 'synth', 'charts/nonexistent'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(synthResult.status).toBe(1);
      expect(synthResult.stderr).toContain('chart.ts not found');
    });

    it('should handle umbrella operations without config', async () => {
      // Try to add subchart without umbrella config
      const addResult = cp.spawnSync('node', [CLI_PATH, 'umbrella', 'add', 'charts/frontend'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(addResult.status).toBe(1);
      expect(addResult.stderr).toContain('umbrella.config.json not found');

      // Try to synthesize umbrella without config
      const synthResult = cp.spawnSync('node', [CLI_PATH, 'umbrella', 'synth'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(synthResult.status).toBe(1);
      expect(synthResult.stderr).toContain('umbrella.config.json not found');
    });
  });

  describe('CLI Help and Usage', () => {
    it('should display help when no command is provided', async () => {
      const result = cp.spawnSync('node', [CLI_PATH], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Umbrella Charts:');
    });

    it('should display help for unknown commands', async () => {
      const result = cp.spawnSync('node', [CLI_PATH, 'unknown-command'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(result.stdout).toContain('Usage:');
    });

    it('should handle --help flag', async () => {
      const result = cp.spawnSync('node', [CLI_PATH, '--help'], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });

      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Umbrella Charts:');
    });
  });

  describe('Environment and Configuration', () => {
    it('should handle different environments', async () => {
      const chartName = 'env-test';
      const chartPath = path.join('charts', chartName);

      // Initialize chart
      const initResult = cp.spawnSync('node', [CLI_PATH, 'init', chartName], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });
      expect(initResult.status).toBe(0);

      // Test with different environments
      const environments = ['development', 'staging', 'production'];

      for (const env of environments) {
        const synthResult = cp.spawnSync(
          'node',
          [CLI_PATH, 'synth', chartPath, '--env', env, '--dry-run'],
          {
            cwd: TEST_DIR,
            encoding: 'utf8',
          },
        );

        expect(synthResult.status).toBe(0);
        expect(synthResult.stdout).toContain('[DRY RUN]');
      }
    });

    it('should handle silent mode', async () => {
      const chartName = 'silent-test';
      const chartPath = path.join('charts', chartName);

      // Initialize chart
      const initResult = cp.spawnSync('node', [CLI_PATH, 'init', chartName], {
        cwd: TEST_DIR,
        encoding: 'utf8',
      });
      expect(initResult.status).toBe(0);

      // Test silent mode
      const synthResult = cp.spawnSync(
        'node',
        [
          CLI_PATH,
          'synth',
          chartPath,
          '--silent',
          '--dry-run',
        ],
        {
          cwd: TEST_DIR,
          encoding: 'utf8',
        },
      );

      expect(synthResult.status).toBe(0);
      // In silent mode, there should be minimal output
      expect(synthResult.stdout.length).toBeLessThan(100);
    });
  });
});
*/
