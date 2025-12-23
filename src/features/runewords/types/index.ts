export interface RuneGroup {
  readonly label: string;
  readonly category: 'esrRunes' | 'lodRunes' | 'kanjiRunes';
  readonly tier: number | null;
  readonly runes: readonly string[];
}
