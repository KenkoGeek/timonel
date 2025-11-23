import * as fs from 'fs';
import * as path from 'path';

import { App, Chart } from 'cdk8s';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  FlexibleSubchart,
  createFlexibleSubchart,
  generateFlexibleSubchartTemplate,
} from '../../src/lib/templates/flexible-subchart';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe('FlexibleSubchart', () => {
  let app: App;
  let parentChart: Chart;

  beforeEach(() => {
    app = new App();
    parentChart = new Chart(app, 'parent-chart');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('createFlexibleSubchart', () => {
    it('should create a FlexibleSubchart instance', () => {
      const subchart = createFlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
        version: '1.0.0',
        description: 'Test subchart',
      });

      expect(subchart).toBeInstanceOf(FlexibleSubchart);
      expect(subchart.node.id).toBe('test-subchart');
    });

    it('should handle additional configuration properties', () => {
      const subchart = createFlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
        customProp: { some: 'value' },
      });

      const constructs = subchart.getConstructs();
      expect(constructs).toHaveLength(1);
      expect(constructs[0]).toEqual({
        construct: { some: 'value' },
        id: 'customProp',
      });
    });
  });

  describe('FlexibleSubchart Class', () => {
    it('should add constructs via addConstruct', () => {
      const subchart = new FlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
      });

      const construct = { kind: 'Deployment' };
      subchart.addConstruct(construct, 'my-deployment');

      const constructs = subchart.getConstructs();
      expect(constructs).toContainEqual({
        construct,
        id: 'my-deployment',
      });
    });

    it('should add manifests via addManifest', () => {
      const subchart = new FlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
      });

      const manifest = { apiVersion: 'v1', kind: 'Service' };
      subchart.addManifest(manifest, 'my-service');

      const manifests = subchart.getManifests();
      expect(manifests).toContainEqual({
        manifest,
        id: 'my-service',
      });
    });

    it('should configure with initial construct and manifest', () => {
      const construct = { kind: 'Deployment' };
      const manifest = { apiVersion: 'v1', kind: 'Service' };

      const subchart = new FlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
        construct,
        manifest,
      });

      expect(subchart.getConstructs()).toContainEqual(expect.objectContaining({ construct }));
      expect(subchart.getManifests()).toContainEqual(expect.objectContaining({ manifest }));
    });

    it('should write helm chart files', () => {
      const subchart = new FlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
        version: '1.0.0',
      });

      subchart.addManifest(
        {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name: 'test-config' },
          data: { key: 'value' },
        },
        'config-map',
      );

      const outputDir = 'dist/test-subchart';
      subchart.writeHelmChart(outputDir);

      // Verify directory creation
      expect(fs.mkdirSync).toHaveBeenCalledWith(outputDir, { recursive: true });
      expect(fs.mkdirSync).toHaveBeenCalledWith(path.join(outputDir, 'templates'), {
        recursive: true,
      });

      // Verify file writing
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'Chart.yaml'),
        expect.stringContaining('name: test-subchart'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'values.yaml'),
        expect.stringContaining('enabled: true'),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'templates', '_helpers.tpl'),
        expect.any(String),
      );
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        path.join(outputDir, 'templates', 'config-map.yaml'),
        expect.stringContaining('kind: ConfigMap'),
      );
    });

    it('should handle empty manifest in _generateManifestTemplate', () => {
      const subchart = new FlexibleSubchart(parentChart, 'test-subchart', {
        name: 'test-subchart',
      });

      // Access private method for testing
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (subchart as any)._generateManifestTemplate(null, 'test-id');
      expect(result).toBe('{}\n');
    });
  });

  describe('generateFlexibleSubchartTemplate', () => {
    it('should generate a valid template string', () => {
      const template = generateFlexibleSubchartTemplate('my-subchart');

      expect(template).toContain("import { App } from 'cdk8s';");
      expect(template).toContain("import { Rutter } from 'timonel';");
      expect(template).toContain("name: 'my-subchart'");
      expect(template).toContain("await chart.write('dist');");
    });
  });
});
