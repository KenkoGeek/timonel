/**
 * Mock utilities for CLI testing
 */

import * as fs from 'fs';
import * as cp from 'child_process';

import { vi } from 'vitest';

import { SecurityUtils } from '../../src/lib/security.js';

// Mock data
export const MOCK_CHART_CONTENT = `import { Rutter, helm } from 'timonel';

const rutter = new Rutter();

rutter.metadata = {
  name: 'test-chart',
  version: '0.1.0',
  description: 'A test chart'
};

rutter.values = {
  replicaCount: 1,
  image: {
    repository: 'nginx',
    tag: 'latest'
  }
};

export const run = () => {
  rutter.write();
};
`;

export const MOCK_UMBRELLA_CONFIG = {
  name: 'test-umbrella',
  version: '0.1.0',
  description: 'Test umbrella chart',
  subcharts: [
    {
      name: 'frontend',
      path: 'charts/frontend',
      enabled: true,
      values: {
        replicaCount: 2,
      },
    },
    {
      name: 'backend',
      path: 'charts/backend',
      enabled: true,
      values: {
        replicaCount: 3,
      },
    },
  ],
};

export const MOCK_PACKAGE_JSON = {
  name: 'test-project',
  version: '1.0.0',
  description: 'Test project',
  main: 'index.js',
  scripts: {
    test: 'vitest',
    build: 'tsc',
  },
  dependencies: {
    timonel: '^1.0.0',
  },
};

// Mock implementations
export class MockFileSystem {
  private files: Map<string, string> = new Map();
  private directories: Set<string> = new Set();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  setDirectory(path: string): void {
    this.directories.add(path);
  }

  existsSync = vi.fn((path: string): boolean => {
    return this.files.has(path) || this.directories.has(path);
  });

  readFileSync = vi.fn((path: string): string => {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  });

  writeFileSync = vi.fn((path: string, content: string): void => {
    this.files.set(path, content);
  });

  mkdirSync = vi.fn((path: string, options?: { recursive?: boolean }): void => {
    this.directories.add(path);
  });

  rmSync = vi.fn((path: string, options?: { recursive?: boolean; force?: boolean }): void => {
    this.files.delete(path);
    this.directories.delete(path);
  });

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }
}

export class MockChildProcess {
  private mockResults: Map<string, cp.SpawnSyncReturns<Buffer>> = new Map();
  private mockExecResults: Map<string, Buffer | Error> = new Map();

  setSpawnResult(command: string, result: cp.SpawnSyncReturns<Buffer>): void {
    this.mockResults.set(command, result);
  }

  setExecResult(command: string, result: Buffer | Error): void {
    this.mockExecResults.set(command, result);
  }

  spawnSync = vi.fn(
    (
      command: string,
      args: string[],
      options?: cp.SpawnSyncOptions,
    ): cp.SpawnSyncReturns<Buffer> => {
      const key = `${command} ${args.join(' ')}`;
      const result = this.mockResults.get(key);

      if (result) {
        return result;
      }

      // Default success result
      return {
        status: 0,
        stderr: Buffer.from(''),
        stdout: Buffer.from('Command executed successfully'),
        signal: null,
        error: undefined,
        pid: 12345,
        output: [null, Buffer.from('Command executed successfully'), Buffer.from('')],
      };
    },
  );

  execSync = vi.fn((command: string): Buffer => {
    const result = this.mockExecResults.get(command);

    if (result instanceof Error) {
      throw result;
    }

    if (result) {
      return result;
    }

    // Default success result
    return Buffer.from('Command executed successfully');
  });

  clear(): void {
    this.mockResults.clear();
    this.mockExecResults.clear();
  }
}

export class MockSecurityUtils {
  isValidChartName = vi.fn((name: string): boolean => {
    // Basic validation: alphanumeric, hyphens, no special chars
    return /^[a-z0-9-]+$/.test(name) && !name.startsWith('-') && !name.endsWith('-');
  });

  isValidTypeScriptFile = vi.fn((path: string): boolean => {
    return path.endsWith('.ts') && !path.includes('..');
  });

  validatePath = vi.fn((path: string): string => {
    if (path.includes('..')) {
      throw new Error('Path traversal detected');
    }
    return path;
  });

  sanitizeLogMessage = vi.fn((message: string): string => {
    // Remove control characters and non-printable characters
    return message.replace(/[\r\n\t]/g, ' ').replace(/[^\x20-\x7E]/g, '');
  });
}

// Helper functions to setup mocks
export function setupFileSystemMocks(): MockFileSystem {
  const mockFs = new MockFileSystem();

  vi.mocked(fs.existsSync).mockImplementation(mockFs.existsSync as unknown as typeof fs.existsSync);
  vi.mocked(fs.readFileSync).mockImplementation(
    mockFs.readFileSync as unknown as typeof fs.readFileSync,
  );
  vi.mocked(fs.writeFileSync).mockImplementation(
    mockFs.writeFileSync as unknown as typeof fs.writeFileSync,
  );
  vi.mocked(fs.mkdirSync).mockImplementation(mockFs.mkdirSync as unknown as typeof fs.mkdirSync);
  vi.mocked(fs.rmSync).mockImplementation(mockFs.rmSync as unknown as typeof fs.rmSync);

  return mockFs;
}

export function setupChildProcessMocks(): MockChildProcess {
  const mockCp = new MockChildProcess();

  vi.mocked(cp.spawnSync).mockImplementation(mockCp.spawnSync as unknown as typeof cp.spawnSync);
  vi.mocked(cp.execSync).mockImplementation(mockCp.execSync);

  return mockCp;
}

export function setupSecurityUtilsMocks(): MockSecurityUtils {
  const mockSecurity = new MockSecurityUtils();

  vi.mocked(SecurityUtils.isValidChartName).mockImplementation(mockSecurity.isValidChartName);
  vi.mocked(SecurityUtils.isValidTypeScriptFile).mockImplementation(
    mockSecurity.isValidTypeScriptFile,
  );

  return mockSecurity;
}

// Common test scenarios
export const TEST_SCENARIOS = {
  VALID_CHART_NAMES: ['test-chart', 'my-app', 'frontend', 'backend-api', 'web-service'],
  INVALID_CHART_NAMES: [
    'Invalid-Name!',
    '123invalid',
    'invalid@name',
    'invalid name',
    '-invalid',
    'invalid-',
  ],

  HELM_SUCCESS: {
    status: 0,
    stderr: Buffer.from(''),
    stdout: Buffer.from('Helm validation successful'),
    signal: null,
    error: undefined,
    pid: 12345,
    output: [null, Buffer.from('Helm validation successful'), Buffer.from('')],
  } as cp.SpawnSyncReturns<Buffer>,

  HELM_NOT_FOUND: new Error('helm: command not found'),

  CLI_SUCCESS: {
    status: 0,
    stderr: Buffer.from(''),
    stdout: Buffer.from('Operation completed successfully'),
    signal: null,
    error: undefined,
    pid: 12345,
    output: [null, Buffer.from('Operation completed successfully'), Buffer.from('')],
  } as cp.SpawnSyncReturns<Buffer>,

  CLI_ERROR: {
    status: 1,
    stderr: Buffer.from('Error occurred'),
    stdout: Buffer.from(''),
    signal: null,
    error: undefined,
    pid: 12345,
    output: [null, Buffer.from(''), Buffer.from('Error occurred')],
  } as cp.SpawnSyncReturns<Buffer>,
};

// Test data generators
export function generateChartContent(chartName: string): string {
  return MOCK_CHART_CONTENT.replace(/test-chart/g, chartName);
}

export function generateUmbrellaConfig(name: string, subcharts: string[] = []): string {
  const config = {
    ...MOCK_UMBRELLA_CONFIG,
    name,
    subcharts: subcharts.map((subchart) => ({
      name: subchart,
      path: `charts/${subchart}`,
      enabled: true,
      values: {},
    })),
  };
  return JSON.stringify(config, null, 2);
}

export function generatePackageJson(projectName: string): string {
  const pkg = {
    ...MOCK_PACKAGE_JSON,
    name: projectName,
  };
  return JSON.stringify(pkg, null, 2);
}
