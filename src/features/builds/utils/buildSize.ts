import type { BuildData } from '../buildData';
import { BUILD_DATA_MAX_BYTES } from '../constants';

/** UTF-8 bytes of the build's JSON, the measure BUILD_DATA_MAX_BYTES caps. */
export function buildDataBytes(buildData: BuildData): number {
  return new TextEncoder().encode(JSON.stringify(buildData)).length;
}

/** The save error for a build over BUILD_DATA_MAX_BYTES, or null when it fits. */
export function buildDataTooLargeMessage(buildData: BuildData): string | null {
  const bytes = buildDataBytes(buildData);
  if (bytes <= BUILD_DATA_MAX_BYTES) return null;
  const size = Math.ceil(bytes / 1024);
  const limit = BUILD_DATA_MAX_BYTES / 1024;
  return `This build is too large to save (${String(size)} KB, limit ${String(limit)} KB). Remove some alternatives or variants.`;
}
