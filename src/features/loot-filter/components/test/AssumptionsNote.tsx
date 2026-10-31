import { ChevronRight } from 'lucide-react';

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
  'A stat check without param holds when any entry of that stat passes; an entry without param has param 0. (Verified: a stat the item lacks counts as 0.)',
  '{stat:ID} without a param shows the first entry of that stat; ID may also be a stat name.',
  '{ethereal} becomes "Ethereal" for ethereal items and nothing otherwise.',
  '"Hide unmatched items" hides an item on the ground that no rule applied to.',
  'Items without a normal/exceptional/elite family (rings, amulets, charms, jewels, arrows, mythical bases) match no base-tier condition.',
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
