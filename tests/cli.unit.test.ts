import fs from 'fs';
import { spawnSync } from 'child_process';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  cmdInit,
  cmdSynth,
  cmdValidate,
  cmdDeploy,
  cmdTemplates,
  cmdUmbrellaInit,
  cmdUmbrellaAdd,
} from '../src/cli';

// Mock dependencies
vi.mock('fs');
vi.mock('child_process');
vi.mock('../src/lib/templates/flexible-subchart.js', () => ({
  generateFlexibleSubchartTemplate: vi.fn().mockReturnValue('mock-template'),
}));
vi.mock('../src/lib/templates/umbrella-chart.js', () => ({
  generateUmbrellaChart: vi.fn().mockReturnValue('mock-umbrella-template'),
}));

describe('CLI Unit Tests', () => {
  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit called');
  });
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => {});
  const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('cmdInit', () => {
    it('should create a new chart', async () => {
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      await cmdInit('test-chart', true);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining('test-chart'), {
        recursive: true,
      });
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('chart.ts'),
        'mock-template',
      );
    });

    it('should fail with invalid name', async () => {
      await expect(cmdInit('InvalidName', true)).rejects.toThrow('process.exit called');
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Invalid chart name'));
    });

    it('should fail without name', async () => {
      await expect(cmdInit(undefined, true)).rejects.toThrow('process.exit called');
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('Missing <chart-name>'));
    });
  });

  describe('cmdSynth', () => {
    it('should synthesize a chart', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => true } as fs.Stats);
      vi.mocked(fs.readFileSync).mockReturnValue("chart.writeHelmChart('dist')");
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);
      vi.mocked(fs.unlinkSync).mockImplementation(() => undefined);
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });

      await cmdSynth('test-chart', { silent: true });

      expect(spawnSync).toHaveBeenCalled();
    });

    it('should fail if chart.ts not found', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(cmdSynth('test-chart', { silent: true })).rejects.toThrow('process.exit called');
      expect(mockError).toHaveBeenCalledWith(expect.stringContaining('chart.ts not found'));
    });
  });

  describe('cmdValidate', () => {
    it('should run helm lint', async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });

      await cmdValidate({ silent: true });

      expect(spawnSync).toHaveBeenCalledWith('helm', ['lint', '.'], expect.any(Object));
    });

    it('should handle env flag', async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });

      await cmdValidate({ silent: true, env: 'prod' });

      expect(spawnSync).toHaveBeenCalledWith(
        'helm',
        ['lint', '.', '-f', 'values-prod.yaml'],
        expect.any(Object),
      );
    });
  });

  describe('cmdDeploy', () => {
    it('should run helm upgrade', async () => {
      vi.mocked(spawnSync).mockReturnValue({
        status: 0,
        stdout: '',
        stderr: '',
        pid: 0,
        output: [],
        signal: null,
      });

      await cmdDeploy('release', 'namespace', { silent: true });

      expect(spawnSync).toHaveBeenCalledWith(
        'helm',
        ['upgrade', '--install', 'release', '.', '--namespace', 'namespace'],
        expect.any(Object),
      );
    });

    it('should fail without release', async () => {
      await expect(cmdDeploy(undefined, undefined, { silent: true })).rejects.toThrow(
        'process.exit called',
      );
    });
  });

  describe('cmdTemplates', () => {
    it('should list templates', async () => {
      await cmdTemplates({ silent: true });
      expect(mockLog).toHaveBeenCalled();
    });
  });

  describe('cmdUmbrellaInit', () => {
    it('should create umbrella chart', async () => {
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      await cmdUmbrellaInit('umbrella-app', true);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('umbrella.ts'),
        'mock-umbrella-template',
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('umbrella.config.json'),
        expect.any(String),
      );
    });
  });

  describe('cmdUmbrellaAdd', () => {
    it('should add subchart', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({ subcharts: [] }));
      vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
      vi.mocked(fs.writeFileSync).mockImplementation(() => undefined);

      await cmdUmbrellaAdd('subchart', true);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('umbrella.config.json'),
        expect.any(String),
      );
    });
  });
});
