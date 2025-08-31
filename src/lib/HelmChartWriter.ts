import * as fs from 'fs';
import * as path from 'path';

import YAML from 'yaml';

export interface HelmChartMeta {
  name: string;
  version: string; // SemVer chart version
  description?: string;
  appVersion?: string; // Underlying app version (string)
  type?: 'application' | 'library';
  kubeVersion?: string;
  keywords?: string[];
  home?: string;
  sources?: string[];
  maintainers?: { name: string; email?: string; url?: string }[];
  icon?: string;
}

export interface EnvValuesMap {
  [env: string]: Record<string, unknown>;
}

export interface SynthAsset {
  /** filename or logical id */
  id: string;
  /** YAML string, may contain multiple docs separated by --- */
  yaml: string;
}

export interface HelmChartWriteOptions {
  outDir: string; // e.g., dist/charts/my-chart
  meta: HelmChartMeta;
  defaultValues?: Record<string, unknown> | undefined;
  envValues?: EnvValuesMap | undefined; // { dev: {...}, prod: {...} }
  /**
   * Kubernetes manifests to place under templates/
   * Accepts one or multiple documents per SynthAsset.
   */
  assets: SynthAsset[];
  /**
   * Optional Helm helpers content for templates/_helpers.tpl.
   * If a string is provided, it's written verbatim.
   * If an array is provided, each item becomes a named Helm template
   * block as: {{- define "<name>" -}} ... {{- end }}
   */
  helpersTpl?: string | HelperDefinition[];
}

export interface HelperDefinition {
  name: string;
  body: string;
}

export class HelmChartWriter {
  static write(opts: HelmChartWriteOptions) {
    const { outDir, meta, defaultValues = {}, envValues = {}, assets, helpersTpl } = opts;
    // Prepare structure
    fs.mkdirSync(path.join(outDir, 'templates'), { recursive: true });

    // Chart.yaml
    const chartYaml = YAML.stringify({
      apiVersion: 'v2',
      name: meta.name,
      version: meta.version,
      description: meta.description,
      type: meta.type ?? 'application',
      appVersion: meta.appVersion,
      kubeVersion: meta.kubeVersion,
      keywords: meta.keywords,
      home: meta.home,
      sources: meta.sources,
      maintainers: meta.maintainers,
      icon: meta.icon,
    });
    fs.writeFileSync(path.join(outDir, 'Chart.yaml'), chartYaml);

    // values.yaml and env values files
    fs.writeFileSync(path.join(outDir, 'values.yaml'), YAML.stringify(defaultValues));
    for (const [env, values] of Object.entries(envValues)) {
      fs.writeFileSync(path.join(outDir, `values-${env}.yaml`), YAML.stringify(values));
    }

    // templates/
    let counter = 0;
    for (const asset of assets) {
      const parts = asset.yaml
        .split(/^---\s*$/m)
        .map((p) => p.trim())
        .filter((p) => p.length);
      for (const doc of parts) {
        const filename = `${String(counter).padStart(4, '0')}-${asset.id}.yaml`;
        fs.writeFileSync(path.join(outDir, 'templates', filename), doc + '\n');
        counter++;
      }
    }

    // Optional helpers
    if (helpersTpl) {
      let content = '';
      if (typeof helpersTpl === 'string') {
        content = helpersTpl.endsWith('\n') ? helpersTpl : helpersTpl + '\n';
      } else if (Array.isArray(helpersTpl)) {
        content = helpersTpl
          .map((h) => [`{{- define "${h.name}" -}}`, h.body.trimEnd(), '{{- end }}', ''].join('\n'))
          .join('\n');
      }
      fs.writeFileSync(path.join(outDir, 'templates', '_helpers.tpl'), content);
    }

    // Emit a default .helmignore if missing
    const helmIgnorePath = path.join(outDir, '.helmignore');
    if (!fs.existsSync(helmIgnorePath)) {
      const helmIgnore = [
        '# VCS',
        '.git/',
        '.hg/',
        '.svn/',
        '',
        '# OS/editor',
        '.DS_Store',
        '.idea/',
        '.vscode/',
        '',
        '# Backups',
        '*.swp',
        '*.bak',
        '*.tmp',
        '*.orig',
        '',
        '# Chart dependencies and packages',
        'charts/',
        '*.tgz',
        '',
      ].join('\n');
      fs.writeFileSync(helmIgnorePath, helmIgnore);
    }
  }
}
