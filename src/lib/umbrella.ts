import type { UmbrellaRutter, UmbrellaRutterProps } from './UmbrellaRutter.js';
import { UmbrellaRutter as UmbrellaRutterClass } from './UmbrellaRutter.js';

/**
 * Create an umbrella chart from multiple Rutter instances
 */
export function createUmbrella(props: UmbrellaRutterProps): UmbrellaRutter {
  return new UmbrellaRutterClass(props);
}

// Re-export types for convenience
export type { UmbrellaRutterProps, SubchartSpec } from './UmbrellaRutter.js';
