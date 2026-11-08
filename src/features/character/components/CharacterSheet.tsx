import type { CharacterFile } from '../parser/types';
import type { HotkeyRow, SheetStat, SkillTabPoints } from '../engine/characterSheet';

const LAST_SAVED_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const NUMBER_FORMAT = new Intl.NumberFormat();

const CARD_CLASS = 'rounded-xl border bg-card p-4 shadow-sm';

/** Name, class, level and the save's own last-saved time */
export function CharacterHeader({ character }: { readonly character: CharacterFile }) {
  return (
    <header className={CARD_CLASS}>
      <h2 className="text-xl font-semibold break-all">{character.name}</h2>
      <p className="text-sm text-muted-foreground">
        {character.className} · Level {character.level} · Last saved {LAST_SAVED_FORMAT.format(character.lastSavedAt * 1000)}
      </p>
    </header>
  );
}

interface CharacterSheetProps {
  readonly attributes: readonly SheetStat[];
  readonly skills: readonly SkillTabPoints[];
  readonly hotkeys: readonly HotkeyRow[];
}

/** Base attributes, hard skill points by tab and the hotkeys: what the save stores, no totals */
export function CharacterSheet({ attributes, skills, hotkeys }: CharacterSheetProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <section className={CARD_CLASS} aria-labelledby="character-attributes">
        <h3 id="character-attributes" className="mb-2 font-semibold">
          Base attributes
        </h3>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-sm">
          {attributes.map((stat) => (
            <div key={stat.label} className="contents">
              <dt className="text-muted-foreground">{stat.label}</dt>
              <dd className="text-right tabular-nums">{NUMBER_FORMAT.format(stat.value)}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">The save stores these without gear, skills or other bonuses.</p>
      </section>

      <section className={CARD_CLASS} aria-labelledby="character-skills">
        <h3 id="character-skills" className="mb-2 font-semibold">
          Skill points spent
        </h3>
        {skills.length === 0 && <p className="text-sm text-muted-foreground">No skill points spent yet.</p>}
        <div className="space-y-3">
          {skills.map((tab) => (
            <div key={tab.name}>
              <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{tab.name}</h4>
              <ul className="text-sm">
                {tab.skills.map((skill) => (
                  <li key={skill.name} className="flex justify-between gap-3">
                    <span className="min-w-0">{skill.name}</span>
                    <span className="tabular-nums">{skill.points}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Points put in by hand; skill bonuses from items are not counted.</p>
      </section>

      <section className={CARD_CLASS} aria-labelledby="character-hotkeys">
        <h3 id="character-hotkeys" className="mb-2 font-semibold">
          Hotkeys
        </h3>
        {hotkeys.length === 0 && <p className="text-sm text-muted-foreground">No hotkeys set.</p>}
        <ul className="text-sm">
          {hotkeys.map((hotkey) => (
            <li key={hotkey.slot} className="flex gap-3">
              <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{hotkey.slot}</span>
              <span className="min-w-0">{hotkey.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
