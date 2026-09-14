import { ApiObject, type ApiObjectProps } from 'cdk8s';

import type { Rutter } from '../src/lib/rutter.js';

/** Test-only bridge for legacy object fixtures after the public addManifest API was removed. */
export function addTestManifest(
  rutter: Rutter,
  manifest: Record<string, unknown>,
  id: string,
): ApiObject {
  return new ApiObject(rutter.getChart(), id, manifest as ApiObjectProps);
}
