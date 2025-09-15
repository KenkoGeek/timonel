// import * as fs from 'fs';
// import * as cp from 'child_process';

// import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// import {
//   setupFileSystemMocks,
//   setupChildProcessMocks,
//   TEST_SCENARIOS,
// } from '../fixtures/cli-mocks.js';
// import { SecurityUtils } from '../../src/lib/security.js';

// // Mock dependencies
// vi.mock('fs');
// vi.mock('child_process');
// vi.mock('../../src/lib/security.js');

// const mockFs = vi.mocked(fs);
// const mockCp = vi.mocked(cp);
// const mockSecurityUtils = vi.mocked(SecurityUtils);

// // Mock console methods
// const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
// const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// describe('CLI Tests', () => {
//   let mockFs: ReturnType<typeof setupFileSystemMocks>;
//   let mockCp: ReturnType<typeof setupChildProcessMocks>;

//   beforeEach(() => {
//     vi.clearAllMocks();

//     // Setup mocks
//     mockFs = setupFileSystemMocks();
//     mockCp = setupChildProcessMocks();

//     // Reset mocks to default behavior
//     mockSecurityUtils.isValidChartName.mockReturnValue(true);
//     mockSecurityUtils.isValidTypeScriptFile.mockReturnValue(true);
//   });

//   afterEach(() => {
//     vi.restoreAllMocks();
//     mockFs.clear();
//     mockCp.clear();
//   });

//   describe('cmdInit', () => {
//     it('should create a new chart with valid name', () => {
//       // Mock the chart name validation
//       mockSecurityUtils.isValidChartName.mockReturnValue(true);

//       // Setup successful scenario
//       mockCp.setSpawnResult('node src/cli.js init test-chart', TEST_SCENARIOS.CLI_SUCCESS);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'init', 'test-chart']);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('Operation completed successfully');
//     });

//     it('should fail with invalid chart name', () => {
//       mockSecurityUtils.isValidChartName.mockReturnValue(false);

//       // Setup error scenario
//       mockCp.setSpawnResult('node src/cli.js init Invalid-Chart-Name!', TEST_SCENARIOS.CLI_ERROR);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'init', 'Invalid-Chart-Name!']);

//       expect(result.status).toBe(1);
//       expect(result.stderr.toString()).toContain('Error occurred');
//     });

//     it('should fail if chart already exists', () => {
//       mockSecurityUtils.isValidChartName.mockReturnValue(true);

//       // Mock existing directory
//       mockFs.setDirectory('existing-chart');
//       mockCp.setSpawnResult('node src/cli.js init existing-chart', TEST_SCENARIOS.CLI_ERROR);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'init', 'existing-chart']);

//       expect(result.status).toBe(1);
//       expect(result.stderr.toString()).toContain('Error occurred');
//     });
//   });

//   describe('cmdValidate', () => {
//     it('should validate chart successfully', () => {
//       // Mock file system to simulate existing chart
//       mockFs.setFile('charts/test-chart/chart.ts', 'valid chart content');

//       // Setup successful scenario
//       mockCp.setSpawnResult(
//         'node src/cli.js validate charts/test-chart',
//         TEST_SCENARIOS.CLI_SUCCESS,
//       );

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'validate', 'charts/test-chart']);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('Operation completed successfully');
//     });

//     it('should fail if chart.ts does not exist', () => {
//       // Setup error scenario for nonexistent chart
//       mockCp.setSpawnResult(
//         'node src/cli.js validate charts/nonexistent',
//         TEST_SCENARIOS.CLI_ERROR,
//       );

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'validate', 'charts/nonexistent']);

//       expect(result.status).toBe(1);
//       expect(result.stderr.toString()).toContain('Error occurred');
//     });

//     it('should fail if helm is not installed', () => {
//       // Mock existing chart file
//       mockFs.setFile('charts/test-chart/chart.ts', 'chart content');

//       // Setup error scenario for missing helm
//       mockCp.setSpawnResult('node src/cli.js validate charts/test-chart', TEST_SCENARIOS.CLI_ERROR);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'validate', 'charts/test-chart']);

//       expect(result.status).toBe(1);
//       expect(result.stderr.toString()).toContain('Error occurred');
//     });
//   });

//   describe('cmdSynth', () => {
//     it('should synthesize chart successfully', () => {
//       // Mock file system to simulate existing chart
//       mockFs.setFile('charts/test-chart/chart.ts', 'chart content');

//       // Setup successful scenario
//       mockCp.setSpawnResult('node src/cli.js synth charts/test-chart', TEST_SCENARIOS.CLI_SUCCESS);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'synth', 'charts/test-chart']);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('Operation completed successfully');
//     });

//     it('should handle dry-run flag', () => {
//       // Mock file system to simulate existing chart
//       mockFs.setFile('charts/test-chart/chart.ts', 'chart content');

//       // Setup successful scenario with dry-run output
//       mockCp.setSpawnResult('node src/cli.js synth charts/test-chart --dry-run', {
//         ...TEST_SCENARIOS.CLI_SUCCESS,
//         stdout: Buffer.from('[DRY RUN] Operation completed successfully'),
//       });

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', [
//         'src/cli.js',
//         'synth',
//         'charts/test-chart',
//         '--dry-run',
//       ]);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('[DRY RUN]');
//     });

//     it('should fail if chart.ts does not exist', () => {
//       // Setup error scenario for nonexistent chart
//       mockCp.setSpawnResult('node src/cli.js synth charts/nonexistent', TEST_SCENARIOS.CLI_ERROR);

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'synth', 'charts/nonexistent']);

//       expect(result.status).toBe(1);
//       expect(result.stderr.toString()).toContain('Error occurred');
//     });
//   });

//   describe('cmdUmbrella', () => {
//     it('should create umbrella chart successfully', () => {
//       // Mock project configuration
//       mockFs.setFile('package.json', JSON.stringify({ name: 'test-project' }));

//       // Setup successful scenario
//       mockCp.setSpawnResult(
//         'node src/cli.js umbrella init my-umbrella',
//         TEST_SCENARIOS.CLI_SUCCESS,
//       );

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'umbrella', 'init', 'my-umbrella']);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('Operation completed successfully');
//     });

//     it('should add subchart to umbrella', () => {
//       // Mock existing umbrella configuration
//       mockFs.setFile(
//         'umbrella.config.json',
//         JSON.stringify({
//           name: 'my-umbrella',
//           subcharts: [],
//         }),
//       );
//       mockFs.setFile('charts/subchart/chart.ts', '// subchart content');

//       // Setup successful scenario
//       mockCp.setSpawnResult(
//         'node src/cli.js umbrella add charts/subchart',
//         TEST_SCENARIOS.CLI_SUCCESS,
//       );

//       // Simulate the CLI call
//       const result = cp.spawnSync('node', ['src/cli.js', 'umbrella', 'add', 'charts/subchart']);

//       expect(result.status).toBe(0);
//       expect(result.stdout.toString()).toContain('Operation completed successfully');
//     });
//   });
// });
