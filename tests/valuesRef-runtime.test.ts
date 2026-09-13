import { describe, expect, it } from 'vitest';

import { dumpHelmAwareYaml } from '../src/lib/utils/helmYamlSerializer.js';
import { isHelmMapRange, isHelmRange, isHelmWith, valuesRef } from '../src/lib/utils/valuesRef.js';

interface Values {
  enabled: boolean;
  replicas: number;
  items: Array<{ name: string; value: string }>;
  envKeys: string[];
  env: Record<string, string>;
  nestedEnv: Record<string, Record<string, string>>;
  dynamicKey: string;
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

  it('supports literal and dynamic map lookups with root-stable paths', () => {
    const v = valuesRef<Values>();

    expect(v.env.hasKey('PORT').__condition).toBe('hasKey $.Values.env "PORT"');
    expect(v.env.hasKey(v.dynamicKey).__condition).toBe('hasKey $.Values.env $.Values.dynamicKey');
    expect(v.env.index('PORT').__path).toBe('(index $.Values.env "PORT")');
    expect(v.env.index(v.dynamicKey).__path).toBe('(index $.Values.env $.Values.dynamicKey)');
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

  it('supports dynamic map lookup from an array range callback', () => {
    const v = valuesRef<Values>();
    const range = v.envKeys.range((key) => ({
      name: key,
      value: v.env.index(key).quote(),
    }));

    const yaml = dumpHelmAwareYaml({ env: range });
    expect(yaml).toContain('{{ range $index, $item := .Values.envKeys }}');
    expect(yaml).toContain('name: {{ $item }}');
    expect(yaml).toContain('value: {{ ((index $.Values.env $item) | quote) }}');
  });

  it('returns a HelmMapRange marker and preserves typed key/value callback paths', () => {
    const v = valuesRef<Values>();
    const range = v.env.rangeEntries((key, value) => ({
      name: key,
      value: value.quote(),
    }));

    expect(isHelmMapRange(range)).toBe(true);

    const yaml = dumpHelmAwareYaml({ env: range });
    expect(yaml).toContain('{{ range $key, $value := $.Values.env }}');
    expect(yaml).toContain('name: {{ $key }}');
    expect(yaml).toContain('value: {{ ($value | quote) }}');
    expect(yaml).toContain('{{ end }}');
  });

  it('uses distinct variables for nested map ranges and preserves outer captures', () => {
    const v = valuesRef<Values>();
    const range = v.nestedEnv.rangeEntries((outerKey, innerMap) => ({
      group: outerKey,
      entries: innerMap.rangeEntries((innerKey, innerValue) => ({
        group: outerKey,
        name: innerKey,
        value: innerValue,
      })),
    }));

    const yaml = dumpHelmAwareYaml({ groups: range });
    expect(yaml).toContain('{{ range $key, $value := $.Values.nestedEnv }}');
    expect(yaml).toContain('{{ range $key1, $value1 := $value }}');
    expect(yaml).toContain('group: {{ $key }}');
    expect(yaml).toContain('name: {{ $key1 }}');
    expect(yaml).toContain('value: {{ $value1 }}');
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
