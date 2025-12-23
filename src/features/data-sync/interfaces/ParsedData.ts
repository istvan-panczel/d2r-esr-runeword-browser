import type { Gem, EsrRune, LodRune, KanjiRune, Crystal } from '@/core/db';

export interface ParsedData {
  readonly gems: Gem[];
  readonly esrRunes: EsrRune[];
  readonly lodRunes: LodRune[];
  readonly kanjiRunes: KanjiRune[];
  readonly crystals: Crystal[];
}
