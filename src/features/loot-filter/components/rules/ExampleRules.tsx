import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { LootFilterRule } from '../../engine/types';
import { EXAMPLE_RULES } from '../../utils/exampleRules';

interface ExampleRulesProps {
  /** Adds the rule like Add rule does (after the selected rule, else at the end) and selects it. */
  readonly onAdd: (rule: LootFilterRule) => void;
}

/** A collapsed box of example rules for common goals, each with what it teaches and an "Add this rule" button. */
export function ExampleRules({ onAdd }: ExampleRulesProps) {
  return (
    <details className="group rounded-md border px-3 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-1 font-medium [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        Example rules
      </summary>
      <div className="mt-2 max-h-[50vh] space-y-2 overflow-y-auto text-xs text-muted-foreground">
        <p>
          Most players start from Sully&apos;s QoL filter (or a filter someone shared) and adapt it; a blank filter is for authors who know
          the format. An example is added after the selected rule, or at the end. Rules run top to bottom and every matching rule applies,
          later ones overriding earlier labels; a hide rule that matches hides the item and stops there.
        </p>
        <ul className="space-y-2">
          {EXAMPLE_RULES.map((example) => (
            <li key={example.id} className="rounded-md border p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium text-foreground">{example.title}</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 px-2 text-xs"
                  aria-label={`Add this rule: ${example.title}`}
                  onClick={() => {
                    onAdd(example.rule);
                  }}
                >
                  <Plus />
                  Add this rule
                </Button>
              </div>
              <p className="mt-1">{example.description}</p>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
