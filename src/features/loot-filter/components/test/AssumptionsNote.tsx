import { ChevronRight } from 'lucide-react';
import { OMITTED_PARAM_RULE } from '../../engine/evaluate';
import { REPORT_STAT_URL } from '../../utils/inGameCheck';
import { FORMULA_ASSUMPTIONS } from '../../engine/formula';

/** The full list: the "Verify in game" section of docs/features/LOOT-FILTER.md. */
const FULL_LIST_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser/blob/master/docs/features/LOOT-FILTER.md#verify-in-game';

/** The evaluator's main guesses where the guide is silent (engine/evaluate.ts header), in plain words; a short list. */
const ASSUMPTIONS: readonly string[] = [
  'A rule limited to other filter levels is skipped and never hides the item, not even with "hide if other conditions fail".',
  '"Hide if other conditions fail" hides only when the item codes, item types and location match; every other condition counts as "other".',
  "A hidden item keeps nothing from earlier rules (colours, border, icon, droplight, chat lines, sounds); its only chat line is the hiding rule's chat message when hidden, and the hiding rule's other actions do not apply.",
  'Replace name, name prefix and name suffix are each taken from the last rule that sets it, independently of each other.',
  'Notify prints the drop line unless the rule (or its style) has its own chat message.',
  "{name} is always the game's name of the item, never the name a rule changed, also in the drop line.",
  'In {stat:ID}, ID may also be a stat name.',
  '{ethereal} becomes "Ethereal" for ethereal items and nothing otherwise.',
  '"Hide unmatched items" hides an item on the ground that no rule applied to.',
  'After a Show rule, a later hide rule applies like a rule without hide (its looks, chat line and sound) and the rules after it still run; its chat line when hidden does not print.',
  'Items without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows, mythical bases) match no base-tier condition.',
];

/** What an in-game test confirmed (engine/evaluate.ts header, engine/statQuirks.ts). */
const VERIFIED: readonly string[] = [
  'A stat the item lacks counts as 0.',
  OMITTED_PARAM_RULE,
  'Skill tab params are numbered class × 8 + tab, as the game stores them (Sorceress Fire Skills = 8).',
  'Enhanced Damage reads 0 on weapons and Enhanced Defense reads 0 on armour (the test here does not model that); Enhanced Damage on a jewel reads correctly.',
];

/** Stat readings nobody has checked in game yet; each is a validator warning too. */
const NOT_VERIFIED: readonly string[] = [
  'Life, Mana and Stamina are stored ×256 in the game (+40 Life = 10240): whether the plugin reads 40 or 10240 is not known.',
  'Per-level stats (Strength per level…) are stored in eighths per character level (+1 per level = 8; Life and Mana per level also ×256): whether the plugin reads the stored or the shown value is not known.',
  'A rule with a wrong-shaped condition or action (e.g. "sockets": "2" instead of 2) is most likely switched off by the plugin, so the test skips it.',
  '"activeInLevels": 4 (a number instead of [4]) works in game; the test reads it as [4], but whether the plugin also leaves the rule off at the other levels is not known.',
];

/** A collapsed list of what the test assumes and should be checked in game. */
export function AssumptionsNote() {
  return (
    <details className="group rounded-md border px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        Assumptions (verify in game)
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {ASSUMPTIONS.map((assumption) => (
          <li key={assumption}>{assumption}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium">Verified in game</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {VERIFIED.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium">Not yet verified</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {NOT_VERIFIED.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs font-medium">Formulas</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        {FORMULA_ASSUMPTIONS.map((assumption) => (
          <li key={assumption}>{assumption}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        To see what the plugin reads, use <span className="font-medium text-foreground">Check in game</span> on a rule (Rules tab): it adds
        a rule that prints the values of the rule&apos;s stats in front of the item name. If a number differs from the tooltip, the plugin
        reads that stat differently;{' '}
        <a href={REPORT_STAT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
          tell us
        </a>
        .
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {'{string:KEY}'} (a game string) is shown as written here; the game replaces it with the string&apos;s text.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        The full list (colour codes, sprite files, row numbers…) is in the{' '}
        <a href={FULL_LIST_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
          loot filter docs
        </a>
        .
      </p>
    </details>
  );
}
