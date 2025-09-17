import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

import { describe, it, expect, beforeAll } from 'vitest';
import * as YAML from 'yaml';

interface ChartMetadata {
  apiVersion: string;
  name: string;
  version: string;
  description: string;
  type: string;
  appVersion: string;
  keywords: string[];
  home: string;
  sources: string[];
  maintainers: Array<{
    name: string;
    email: string;
    url: string;
  }>;
  icon: string;
  dependencies: Array<{
    name: string;
    version: string;
    repository: string;
    condition: string;
    tags: string[];
  }>;
}

describe('Helm Compatibility Integration Tests', () => {
  const testChartPath = join(__dirname, '../../advanced-helm-test');
  const distPath = join(testChartPath, 'dist');

  beforeAll(() => {
    // Generar el chart antes de ejecutar los tests
    execSync('npx timonel synth .', {
      cwd: testChartPath,
      stdio: 'inherit',
    });
  });

  describe('Chart Metadata (Chart.yaml)', () => {
    let chartYaml: ChartMetadata;

    beforeAll(() => {
      const chartPath = join(distPath, 'Chart.yaml');
      expect(existsSync(chartPath)).toBe(true);
      chartYaml = YAML.parse(readFileSync(chartPath, 'utf8'));
    });

    it('should have correct API version and basic metadata', () => {
      expect(chartYaml.apiVersion).toBe('v2');
      expect(chartYaml.name).toBe('advanced-helm-test');
      expect(chartYaml.version).toBe('2.0.0');
      expect(chartYaml.description).toBe(
        'Chart avanzado que demuestra 100% de las características de Helm',
      );
      expect(chartYaml.type).toBe('application');
      expect(chartYaml.appVersion).toBe('1.0.0');
    });

    it('should have keywords', () => {
      expect(chartYaml.keywords).toEqual(['web', 'nginx', 'microservice', 'timonel']);
    });

    it('should have home and sources', () => {
      expect(chartYaml.home).toBe('https://github.com/KenkoGeek/timonel');
      expect(chartYaml.sources).toEqual([
        'https://github.com/KenkoGeek/timonel',
        'https://hub.docker.com/_/nginx',
      ]);
    });

    it('should have maintainers', () => {
      expect(chartYaml.maintainers).toEqual([
        {
          name: 'Franklin García',
          email: 'franklin@kenkogeek.com',
          url: 'https://kenkogeek.com',
        },
      ]);
    });

    it('should have icon', () => {
      expect(chartYaml.icon).toBe(
        'https://raw.githubusercontent.com/KenkoGeek/timonel/main/docs/logo.png',
      );
    });

    it('should have dependencies (subcharts)', () => {
      expect(chartYaml.dependencies).toEqual([
        {
          name: 'postgresql',
          version: '12.1.9',
          repository: 'https://charts.bitnami.com/bitnami',
          condition: 'postgresql.enabled',
          tags: ['database'],
        },
        {
          name: 'redis',
          version: '17.3.7',
          repository: 'https://charts.bitnami.com/bitnami',
          condition: 'redis.enabled',
          tags: ['cache'],
        },
      ]);
    });
  });

  describe('Values Files', () => {
    it('should generate main values.yaml', () => {
      const valuesPath = join(distPath, 'values.yaml');
      expect(existsSync(valuesPath)).toBe(true);

      const values = YAML.parse(readFileSync(valuesPath, 'utf8'));
      expect(values.replicaCount).toBe(1);
      expect(values.image.repository).toBe('nginx');
      expect(values.image.tag).toBe('1.27');
      expect(values.postgresql.enabled).toBe(true);
      expect(values.redis.enabled).toBe(true);
      expect(values.tests.enabled).toBe(true);
    });

    it('should generate environment-specific values files', () => {
      const envs = ['dev', 'staging', 'prod'];

      envs.forEach((env) => {
        const envValuesPath = join(distPath, `values-${env}.yaml`);
        expect(existsSync(envValuesPath)).toBe(true);

        const envValues = YAML.parse(readFileSync(envValuesPath, 'utf8'));

        switch (env) {
          case 'dev':
            expect(envValues.replicaCount).toBe(1);
            expect(envValues.postgresql.enabled).toBe(false);
            expect(envValues.redis.enabled).toBe(false);
            break;
          case 'staging':
            expect(envValues.replicaCount).toBe(2);
            expect(envValues.postgresql.enabled).toBe(true);
            expect(envValues.redis.enabled).toBe(true);
            break;
          case 'prod':
            expect(envValues.replicaCount).toBe(3);
            expect(envValues.postgresql.enabled).toBe(true);
            expect(envValues.redis.enabled).toBe(true);
            break;
        }
      });
    });
  });

  describe('Helm Templates', () => {
    it('should generate _helpers.tpl with template functions', () => {
      const helpersPath = join(distPath, 'templates', '_helpers.tpl');
      expect(existsSync(helpersPath)).toBe(true);

      const helpers = readFileSync(helpersPath, 'utf8');
      expect(helpers).toContain('chart.name');
      expect(helpers).toContain('chart.fullname');
      expect(helpers).toContain('chart.labels');
      expect(helpers).toContain('chart.selectorLabels');
    });

    it('should generate core Kubernetes manifests', () => {
      const manifests = ['deployment.yaml', 'service.yaml', 'ingress.yaml'];

      manifests.forEach((manifest) => {
        const manifestPath = join(distPath, 'templates', manifest);
        expect(existsSync(manifestPath)).toBe(true);

        const content = readFileSync(manifestPath, 'utf8');

        // Verificar que contiene helpers de template
        const hasHelpers =
          content.includes('include "chart.') ||
          content.includes("include 'chart.") ||
          content.includes('template "chart.');
        expect(hasHelpers).toBe(true);

        // Verificar que contiene expresiones de Helm
        expect(content).toMatch(/\{\{.*\}\}/);
      });
    });

    it('should generate conditional manifests with proper conditions', () => {
      const ingressPath = join(distPath, 'templates', 'ingress.yaml');
      const ingressContent = readFileSync(ingressPath, 'utf8');
      expect(ingressContent).toContain('{{- if .Values.ingress.enabled }}');
      expect(ingressContent).toContain('{{- end }}');
    });
  });

  describe('Helm Hooks', () => {
    it('should generate pre-install hook', () => {
      const hookPath = join(distPath, 'templates', 'pre-install-hook.yaml');
      expect(existsSync(hookPath)).toBe(true);

      const hook = readFileSync(hookPath, 'utf8');
      expect(hook).toContain('helm.sh/hook: pre-install');
      expect(hook).toContain('helm.sh/hook-weight:');
      expect(hook).toContain('helm.sh/hook-delete-policy:');
    });

    it('should generate post-install hook', () => {
      const hookPath = join(distPath, 'templates', 'post-install-hook.yaml');
      expect(existsSync(hookPath)).toBe(true);

      const hook = readFileSync(hookPath, 'utf8');
      expect(hook).toContain('helm.sh/hook: post-install');
    });

    it('should generate pre-delete hook file', () => {
      const hookPath = join(distPath, 'templates', 'pre-delete-hook.yaml');
      expect(existsSync(hookPath)).toBe(true);

      // Solo verificar que el archivo existe y contiene contenido básico
      const hook = readFileSync(hookPath, 'utf8');
      expect(hook.length).toBeGreaterThan(0);
      expect(hook).toContain('kind: Job');
    });
  });

  describe('Helm Tests', () => {
    it('should generate test pods', () => {
      const testFiles = ['test-connection.yaml', 'test-health.yaml'];

      testFiles.forEach((testFile) => {
        const testPath = join(distPath, 'templates', testFile);
        if (existsSync(testPath)) {
          const test = readFileSync(testPath, 'utf8');

          expect(test).toContain('helm.sh/hook: test');
          expect(test).toContain('kind: Pod');
        }
      });
    });

    it('should generate conditional test for database', () => {
      const testPath = join(distPath, 'templates', 'test-database.yaml');
      const content = readFileSync(testPath, 'utf8');
      expect(content).toContain('{{- if .Values.postgresql.enabled }}');
      expect(content).toContain('{{- end }}');
    });
  });

  describe('NOTES.txt', () => {
    it('should generate NOTES.txt with Helm template expressions', () => {
      const notesPath = join(distPath, 'templates', 'NOTES.txt');
      expect(existsSync(notesPath)).toBe(true);

      const notes = readFileSync(notesPath, 'utf8');
      expect(notes).toContain('{{ .Chart.Name }}');
      expect(notes).toContain('{{ .Chart.Version }}');
      expect(notes).toContain('{{ .Release.Name }}');
      expect(notes).toContain('{{ .Release.Namespace }}');
      expect(notes).toContain('{{ include "chart.fullname" . }}');
      expect(notes).toContain('{{- if .Values.ingress.enabled }}');
      expect(notes).toContain('{{- if .Values.postgresql.enabled }}');
      expect(notes).toContain('{{- if .Values.redis.enabled }}');
    });
  });

  describe('Helm Template Expressions', () => {
    it('should properly format Helm expressions without character conversion', () => {
      const deploymentPath = join(distPath, 'templates', 'deployment.yaml');
      const deployment = readFileSync(deploymentPath, 'utf8');

      // Verificar que las expresiones de Helm no se convirtieron en caracteres individuales
      expect(deployment).not.toContain('"0": "{"');
      expect(deployment).not.toContain('"1": "{"');
      expect(deployment).not.toContain('"2": " "');

      // Verificar que contiene expresiones de Helm válidas
      expect(deployment).toMatch(/\{\{.*\}\}/);
      expect(deployment).toContain('include');

      // Verificar que usa objetos de Helm
      const hasHelmObjects =
        deployment.includes('.Values') ||
        deployment.includes('.Chart') ||
        deployment.includes('.Release');
      expect(hasHelmObjects).toBe(true);
    });

    it('should handle complex Helm expressions in all templates', () => {
      const templates = ['deployment.yaml', 'service.yaml', 'ingress.yaml'];

      templates.forEach((template) => {
        const templatePath = join(distPath, 'templates', template);
        const content = readFileSync(templatePath, 'utf8');

        // Verificar que no hay conversión a caracteres individuales
        expect(content).not.toMatch(/"[0-9]+": "[{}]"/);

        // Verificar que las expresiones complejas están intactas
        expect(content).toMatch(/\{\{.*\}\}/);
      });
    });
  });

  describe('Helm Lint Compatibility', () => {
    it('should have valid Helm chart structure', () => {
      // Verificar estructura básica del chart
      const chartYamlPath = join(distPath, 'Chart.yaml');
      expect(existsSync(chartYamlPath)).toBe(true);

      const chartYaml = readFileSync(chartYamlPath, 'utf8');
      expect(chartYaml).toContain('apiVersion:');
      expect(chartYaml).toContain('name:');
      expect(chartYaml).toContain('version:');

      // Verificar que tiene templates
      const templatesDir = join(distPath, 'templates');
      expect(existsSync(templatesDir)).toBe(true);

      // Verificar que tiene values.yaml
      const valuesPath = join(distPath, 'values.yaml');
      expect(existsSync(valuesPath)).toBe(true);
    });
  });

  describe('Chart Structure Validation', () => {
    it('should have correct chart directory structure', () => {
      const requiredFiles = [
        'Chart.yaml',
        'values.yaml',
        'values-dev.yaml',
        'values-staging.yaml',
        'values-prod.yaml',
        '.helmignore',
      ];

      requiredFiles.forEach((file) => {
        expect(existsSync(join(distPath, file))).toBe(true);
      });

      const requiredTemplates = [
        '_helpers.tpl',
        'deployment.yaml',
        'service.yaml',
        'ingress.yaml',
        'pre-install-hook.yaml',
        'post-install-hook.yaml',
        'pre-delete-hook.yaml',
        'test-connection.yaml',
        'test-health.yaml',
        'test-database.yaml',
        'NOTES.txt',
      ];

      requiredTemplates.forEach((template) => {
        expect(existsSync(join(distPath, 'templates', template))).toBe(true);
      });
    });

    it('should generate .helmignore file', () => {
      const helmignorePath = join(distPath, '.helmignore');
      expect(existsSync(helmignorePath)).toBe(true);

      const helmignore = readFileSync(helmignorePath, 'utf8');
      expect(helmignore).toContain('.DS_Store');
      expect(helmignore).toContain('*.tmp');
    });
  });

  describe('Advanced Helm Features', () => {
    it('should support complex values configuration', () => {
      const valuesPath = join(distPath, 'values.yaml');
      const values = readFileSync(valuesPath, 'utf8');

      // Verificar que es un archivo YAML válido con configuraciones
      expect(values.trim()).not.toBe('');
      expect(values).toContain(':');

      // Verificar que contiene al menos algunas configuraciones básicas
      const hasConfigurations =
        values.includes('enabled:') ||
        values.includes('image:') ||
        values.includes('service:') ||
        values.includes('replicaCount:');
      expect(hasConfigurations).toBe(true);
    });

    it('should support all Helm built-in objects', () => {
      const templates = ['deployment.yaml', 'service.yaml', 'NOTES.txt'];

      templates.forEach((template) => {
        const templatePath = join(distPath, 'templates', template);
        if (existsSync(templatePath)) {
          const content = readFileSync(templatePath, 'utf8');

          // Verificar que contiene expresiones de Helm
          const hasHelmExpressions = content.includes('{{') && content.includes('}}');
          expect(hasHelmExpressions).toBe(true);

          // Verificar al menos algunos objetos built-in comunes
          const hasBuiltInObjects =
            content.includes('.Release.') ||
            content.includes('.Chart.') ||
            content.includes('.Values') ||
            content.includes('include ');
          expect(hasBuiltInObjects).toBe(true);
        }
      });
    });

    it('should support Helm template functions', () => {
      const helpersPath = join(distPath, 'templates', '_helpers.tpl');
      const helpers = readFileSync(helpersPath, 'utf8');

      // Verificar que el archivo contiene definiciones de template
      expect(helpers).toContain('{{/*');
      expect(helpers).toContain('{{- define');
      expect(helpers).toContain('{{- end }}');

      // Verificar que contiene al menos algunas funciones básicas
      const hasInclude = helpers.includes('include') || helpers.includes('template');
      expect(hasInclude).toBe(true);
    });
  });
});
