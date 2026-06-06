import type { Gem, EsrRune, LodRune, KanjiRune, Crystal, Runeword, Gemword, HtmUniqueItem, MythicalUnique, Ascendancy } from '@/core/db';

export interface ParsedData {
  readonly gems: Gem[];
  readonly esrRunes: EsrRune[];
  readonly lodRunes: LodRune[];
  readonly kanjiRunes: KanjiRune[];
  readonly crystals: Crystal[];
  readonly runewords: Runeword[];
  readonly gemwords: Gemword[];
  readonly htmUniqueItems: HtmUniqueItem[];
  readonly mythicalUniques: MythicalUnique[];
  readonly ascendancies: Ascendancy[];
}
