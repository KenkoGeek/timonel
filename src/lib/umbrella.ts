/**
 * @fileoverview Umbrella chart utilities for managing multiple subcharts as a single unit
 * @since 0.2.0
 */

import type { UmbrellaRutter, UmbrellaRutterProps } from './umbrellaRutter.js';
import { UmbrellaRutter as UmbrellaRutterClass } from './umbrellaRutter.js';

/**
 * Create an umbrella chart from multiple Rutter instances
 *
 * @param props - Umbrella chart configuration
 * @returns UmbrellaRutter instance for managing subcharts
 *
 * @example
 * ```typescript
 * const umbrella = createUmbrella({
 *   meta: { name: 'my-umbrella', version: '1.0.0' },
 *   subcharts: [
 *     { name: 'frontend', rutter: frontendChart },
 *     { name: 'backend', rutter: backendChart }
 *   ]
 * });
 * ```
 *
 * @since 0.2.0
 */
export function createUmbrella(props: UmbrellaRutterProps): UmbrellaRutter {
  return new UmbrellaRutterClass(props);
}

// Re-export types for convenience
export type { UmbrellaRutterProps, SubchartSpec } from './umbrellaRutter.js';
