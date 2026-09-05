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
}

describe('ValuesRef runtime contract', () => {
  it('keeps nested property paths on real proxies', () => {
    const v = valuesRef<Values>();

    expect(v.database.host.__path).toBe('.Values.database.host');
    expect(v.items.__path).toBe('.Values.items');
    expect(v.enabled.not().__condition).toBe('not .Values.enabled');
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
