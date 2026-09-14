import { describe, expect, it } from 'vitest';

import * as Timonel from '../src/index.js';

describe('Timonel Entry Point', () => {
  it('exports typed chart building components', () => {
    expect(Timonel.Rutter).toBeDefined();
    expect(Timonel.TypedCustomResource).toBeDefined();
    expect(Timonel.ServiceMonitor).toBeDefined();
    expect(Timonel.PrometheusRule).toBeDefined();
    expect(Timonel.SecurityUtils).toBeDefined();
    expect(Timonel.createUmbrella).toBeDefined();
  });

  it('does not export raw chart-writing compatibility surfaces', () => {
    expect('HelmChartWriter' in Timonel).toBe(false);
    expect('createFlexibleSubchart' in Timonel).toBe(false);
    expect('FlexibleSubchart' in Timonel).toBe(false);
    expect('UmbrellaChart' in Timonel).toBe(false);
  });

  it('exports Helm fragment helpers without raw resource helpers', () => {
    expect(Timonel.createHelper).toBeDefined();
    expect(Timonel.formatHelpers).toBeDefined();
    expect(Timonel.getDefaultHelpers).toBeDefined();
    expect(Timonel.STANDARD_HELPERS).toBeDefined();
  });

  it('exports logging utilities', () => {
    expect(Timonel.createLogger).toBeDefined();
    expect(Timonel.LogLevel).toBeDefined();
  });

  it('exports Karpenter utilities', () => {
    expect(Timonel.KarpenterVersionUtils).toBeDefined();
    expect(Timonel.isValidKubernetesDuration).toBeDefined();
  });
});
