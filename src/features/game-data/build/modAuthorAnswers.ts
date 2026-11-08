/**
 * The mod author's answers (CelestialRay, Discord, 2026-11-07) on perks the files do not back, by perk stat; none is a
 * `bug` at ESR 3.3.02, which fixed the Elixir of Reincarnation recipe and the Alien Artefacts perk gate. The generators add the `note` only while the files still show the gap, so it drops out once a patch closes it.
 *
 * - `plugin`: the perk works, granted by a launcher plugin outside the tables, so "nothing reads it" is no gap: no
 *   such note and no warning.
 * - `bug`: the files are wrong; the note says what the next patch changes. The warning stays, so the patch that fixes
 *   it shows in the generator output.
 */
export const MOD_AUTHOR_PERK_ANSWERS: Readonly<Record<string, { kind: 'plugin' | 'bug'; note: string }>> = {
  // Deep Pockets: "Granted directly by the plugin, not in the excel files."
  archaeology_4: {
    kind: 'plugin',
    note: 'The mod author (2026-11-07): the plugin grants it directly, outside the game tables, so the perk works.',
  },
};

/** The mod author's note on a perk stat, of the given kind; undefined when there is none */
export function modAuthorNote(stat: string, kind: 'plugin' | 'bug'): string | undefined {
  const answer = Object.hasOwn(MOD_AUTHOR_PERK_ANSWERS, stat) ? MOD_AUTHOR_PERK_ANSWERS[stat] : undefined;
  return answer?.kind === kind ? answer.note : undefined;
}
