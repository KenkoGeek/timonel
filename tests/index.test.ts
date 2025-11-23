import { describe, it, expect } from 'vitest';

import * as Timonel from '../src/index.js';

describe('Timonel Entry Point', () => {
  it('should export core components', () => {
    expect(Timonel.Rutter).toBeDefined();
    expect(Timonel.HelmChartWriter).toBeDefined();
    expect(Timonel.SecurityUtils).toBeDefined();
    expect(Timonel.createUmbrella).toBeDefined();
  });

  it('should export templates', () => {
    expect(Timonel.createFlexibleSubchart).toBeDefined();
    expect(Timonel.UmbrellaChart).toBeDefined();
  });

  it('should export helpers', () => {
    expect(Timonel.createHelper).toBeDefined();
    expect(Timonel.formatHelpers).toBeDefined();
    expect(Timonel.getDefaultHelpers).toBeDefined();
    expect(Timonel.STANDARD_HELPERS).toBeDefined();
  });

  it('should export logging utilities', () => {
    expect(Timonel.createLogger).toBeDefined();
    expect(Timonel.LogLevel).toBeDefined();
  });

  it('should export Karpenter utilities', () => {
    expect(Timonel.KarpenterVersionUtils).toBeDefined();
    expect(Timonel.isValidKubernetesDuration).toBeDefined();
  });
});
