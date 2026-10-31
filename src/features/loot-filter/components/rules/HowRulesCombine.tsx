import { ChevronRight } from 'lucide-react';
import { useEditorTab } from '../../hooks/useEditorTab';

const CODE = 'rounded bg-muted px-1 font-mono';

/** A collapsed note on how conditions and rules combine (the guide's "How rules match"). */
export function HowRulesCombine() {
  const [, setTab] = useEditorTab();
  return (
    <details className="group rounded-md border px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        How rules combine (AND, OR, hide)
      </summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>
          Every condition in a rule must hold (AND). Inside one list any value matches (OR): item codes{' '}
          <code className={CODE}>cap, skp</code> means either.
        </li>
        <li>
          Item codes and item types are both checked: <code className={CODE}>cap</code> with type <code className={CODE}>helm</code>{' '}
          matches, <code className={CODE}>cap</code> with type <code className={CODE}>ring</code> never does.
        </li>
        <li>
          Rules run top to bottom; every matching rule applies and later ones override labels. Hide stops: nothing after it runs, and there
          is no &quot;show&quot; action, so an earlier rule cannot protect an item from a later hide.
        </li>
        <li>
          To hide most of a group but keep exceptions, put the exceptions into the hide rule as negated conditions. &quot;Hide caps, except
          rare, set, unique or socketed ones&quot; is one rule: item codes <code className={CODE}>cap</code>, quality inferior, normal,
          superior, magic, sockets exactly 0, hide. The except lists, quality lists and flags are the negations you have.
        </li>
        <li>
          &quot;Hide if other conditions fail&quot; is the other way round: the codes or types match but another condition does not, so the
          item is hidden.
        </li>
        <li>
          That counts every other condition, quality included: item type <code className={CODE}>weap</code>, quality magic, a stat check and
          &quot;hide if other conditions fail&quot; also hides unique and rare weapons. To keep only the magic weapons with a stat, write a
          hide rule with item type <code className={CODE}>weap</code>, quality magic and the stat under &quot;Except items with…&quot;: it
          is written as the check <code className={CODE}>&lt; 1</code>, which hides the ones without it (an item without the stat counts as
          0, verified in game).
        </li>
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Try it on an item in the{' '}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => {
            setTab('test');
          }}
        >
          Test tab
        </button>
        .
      </p>
    </details>
  );
}
