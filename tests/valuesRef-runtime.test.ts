import { describe, expect, it } from 'vitest';

import { dumpHelmAwareYaml } from '../src/lib/utils/helmYamlSerializer.js';
import { isHelmRange, isHelmWith, valuesRef } from '../src/lib/utils/valuesRef.js';

interface Values {
  enabled: boolean;
  replicas: number;
  items: Array<{ name: string; value: string }>;
  database: {
    host: string;
    port: number;
  };
  default: string;
  release: {
    name: string;
  };
  chart: {
    title: string;
  };
  settings: {
    default: string;
    range: string[];
    with: {
      enabled: boolean;
    };
  };
}

describe('ValuesRef runtime contract', () => {
  it('keeps nested property paths on real proxies', () => {
    const v = valuesRef<Values>();

    expect(v.database.host.__path).toBe('.Values.database.host');
    expect(v.items.__path).toBe('.Values.items');
    expect(v.enabled.not().__condition).toBe('not .Values.enabled');
  });

  it('provides typed access to values whose keys collide with methods or root helpers', () => {
    const v = valuesRef<Values>();

    expect(v.release.name.__path).toBe('.Release.Name');
    expect(v.at('release').name.__path).toBe('.Values.release.name');
    expect(v.at('chart').at('title').__path).toBe('.Values.chart.title');
    expect(v.at('default').__path).toBe('.Values.default');
    expect(v.settings.at('default').__path).toBe('.Values.settings.default');
    expect(v.settings.at('range').__path).toBe('.Values.settings.range');
    expect(v.settings.at('with').enabled.__path).toBe('.Values.settings.with.enabled');

    expect(v.default('fallback').__path).toBe('.Values | default "fallback"');
  });

  it('returns a HelmRange marker and preserves typed callback paths', () => {
    const v = valuesRef<Values>();
    const range = v.items.range((item, index) => ({
      name: item.name,
      value: item.value,
      index,
    }));

    expect(isHelmRange(range)).toBe(true);

    const yaml = dumpHelmAwareYaml({ env: range });
    expect(yaml).toContain('{{ range $index, $item := .Values.items }}');
    expect(yaml).toContain('- name: {{ $item.name }}');
    expect(yaml).toContain('value: {{ $item.value }}');
    expect(yaml).toContain('index: {{ $index }}');
    expect(yaml).toContain('{{ end }}');
  });

  it('returns a HelmWith marker and preserves scoped nested paths', () => {
    const v = valuesRef<Values>();
    const withBlock = v.database.with((database) => ({
      host: database.host,
      port: database.port,
    }));

    expect(isHelmWith(withBlock)).toBe(true);

    const yaml = dumpHelmAwareYaml({ database: withBlock });
    expect(yaml).toContain('{{ with .Values.database }}');
    expect(yaml).toContain('database:');
    expect(yaml).toContain('  host: {{ .host }}');
    expect(yaml).toContain('  port: {{ .port }}');
    expect(yaml).toContain('{{ end }}');
    expect(yaml).not.toContain('undefined');
  });
});
