import type { SocketableBonuses } from '@/core/db/models';

export type SocketableCategory = 'gems' | 'esrRunes' | 'lodRunes' | 'kanjiRunes' | 'crystals';

export interface UnifiedSocketable {
  readonly name: string;
  readonly category: SocketableCategory;
  readonly color: string | null;
  readonly reqLevel: number;
  readonly bonuses: SocketableBonuses;
  readonly sortOrder: number;
}
