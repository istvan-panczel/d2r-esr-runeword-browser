import type { Gem, GemType } from '@/core/db';

export interface GemGroup {
  readonly type: GemType;
  readonly gems: readonly Gem[];
}
