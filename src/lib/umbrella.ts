import type { UmbrellaRutter, UmbrellaRutterProps } from './UmbrellaRutter';
import { UmbrellaRutter as UmbrellaRutterClass } from './UmbrellaRutter';

/**
 * Create an umbrella chart from multiple Rutter instances
 */
export function createUmbrella(props: UmbrellaRutterProps): UmbrellaRutter {
  return new UmbrellaRutterClass(props);
}

// Re-export types for convenience
export type { UmbrellaRutterProps, SubchartSpec } from './UmbrellaRutter';
