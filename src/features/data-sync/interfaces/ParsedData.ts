import type { Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword, HtmUniqueItem, MythicalUnique } from '@/core/db';

export interface ParsedData {
  readonly gems: Gem[];
  readonly esrRunes: EsrRune[];
  readonly lodRunes: LodRune[];
  readonly kanjiRunes: KanjiRune[];
  readonly crystals: Crystal[];
  readonly runewords: Runeword[];
  readonly htmUniqueItems: HtmUniqueItem[];
  readonly mythicalUniques: MythicalUnique[];
}
