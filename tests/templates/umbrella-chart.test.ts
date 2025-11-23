import * as fs from 'fs';
import * as path from 'path';

import { App, Chart } from 'cdk8s';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  UmbrellaChartTemplate,
  generateUmbrellaChart,
} from '../../src/lib/templates/umbrella-chart';
import { Rutter } from '../../src/lib/rutter';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  copyFileSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
  readFileSync: vi.fn(),
}));

// Mock Rutter
vi.mock('../src/lib/rutter', () => {
  return {
    Rutter: vi.fn().mockImplementation(() => ({
      write: vi.fn(),
      addManifest: vi.fn(),
      getAssets: vi.fn().mockReturnValue([]),
    })),
  };
});

describe('UmbrellaChartTemplate', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateUmbrellaChart', () => {
    it('should generate a valid template string', () => {
      const template = generateUmbrellaChart('my-umbrella');

      expect(template).toContain("import { App } from 'cdk8s';");
      expect(template).toContain("import { Rutter } from 'timonel';");
      expect(template).toContain("name: 'my-umbrella'");
      expect(template).toContain('await umbrella.write(outDir);');
    });
  });

  describe('UmbrellaChartTemplate Class', () => {
    it('should create an UmbrellaChartTemplate instance', () => {
      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
      });

      expect(umbrella).toBeInstanceOf(UmbrellaChartTemplate);
    });

    it('should configure with services', () => {
      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        services: [{ name: 'backend', port: 8080, targetPort: 8080 }],
      });

      // Check if Service construct was added (indirectly via node children)
      const children = umbrella.node.children;
      const service = children.find((c) => c.node.id === 'service-0');
      expect(service).toBeDefined();
    });

    it('should configure with flexible subcharts', () => {
      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        subcharts: [{ name: 'sub1', version: '1.0.0', chart: { kind: 'Deployment' } }],
      });

      const children = umbrella.node.children;
      const subchart = children.find((c) => c.node.id === 'sub1-0');
      expect(subchart).toBeDefined();
    });

    it('should handle function charts', () => {
      const mockChartFn = vi.fn().mockImplementation((scope) => {
        return new Chart(scope, 'mock-chart');
      });

      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        subcharts: [{ name: 'func-chart', chart: mockChartFn }],
      });

      expect(mockChartFn).toHaveBeenCalled();
    });

    it('should handle object charts (constructs)', () => {
      const mockConstruct = { kind: 'Deployment' };

      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        subcharts: [{ name: 'obj-chart', chart: mockConstruct }],
      });

      // Verification is implicit if no error is thrown and subchart is created
      const children = umbrella.node.children;
      const subchart = children.find((c) => c.node.id === 'obj-chart-0');
      expect(subchart).toBeDefined();
    });

    it('should write helm chart files', () => {
      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        subcharts: [{ name: 'sub1', version: '1.0.0', chart: { kind: 'Deployment' } }],
      });

      const outputDir = 'dist/test-umbrella';
      umbrella.writeHelmChart(outputDir);

      // Verify directory creation
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(outputDir, 'charts'), {
        recursive: true,
      });
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(outputDir, 'templates'), {
        recursive: true,
      });

      // Verify file writing
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'Chart.yaml'),
        expect.stringContaining('name: test-umbrella'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'values.yaml'),
        expect.stringContaining('global:'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'templates', 'namespace.yaml'),
        expect.stringContaining('kind: Namespace'),
      );
    });

    it('should handle Rutter instance in function chart', () => {
      const mockRutterFn = vi.fn().mockImplementation((scope) => {
        const rutter = new Rutter({
          meta: { name: 'rutter-chart', version: '1.0.0' },
          scope: scope,
        });
        // Mock write method
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (rutter as any).write = vi.fn();
        return rutter;
      });

      const umbrella = new UmbrellaChartTemplate(app, 'test-umbrella', {
        name: 'test-umbrella',
        version: '1.0.0',
        description: 'Test umbrella',
        subcharts: [{ name: 'rutter-sub', chart: mockRutterFn }],
      });

      // Should not throw
      expect(umbrella).toBeInstanceOf(UmbrellaChartTemplate);
    });
  });
});
