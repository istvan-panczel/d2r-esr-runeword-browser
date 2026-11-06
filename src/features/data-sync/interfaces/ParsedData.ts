import type {
  Gem,
  EsrRune,
  LodRune,
  KanjiRune,
  Crystal,
  Runeword,
  Gemword,
  HtmUniqueItem,
  MythicalUnique,
  Ascendancy,
  AscendancyChallenge,
} from '@/core/db';

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
  /** Not sanity-checked: empty when the page has no recognisable challenge section (the page then hides that part) */
  readonly ascendancyChallenges: AscendancyChallenge[];
  /** Remote ESR version fetched during the startup check; absent on force refresh. */
  readonly esrVersion?: string;
  /** ISO `Last-Modified` of the docs site's runewords.htm; absent when the header is missing. */
  readonly docsLastModified?: string;
}
