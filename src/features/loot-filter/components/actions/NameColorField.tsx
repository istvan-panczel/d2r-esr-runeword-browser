import type { ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLOR_CODES, colorCodeRgb } from '../../engine/colors';
import type { FilterText } from '../../engine/types';
import { nameColorCode, nameColorText } from '../../utils/ruleView';
import { Field } from '../Field';

const NO_COLOR = '__none';

function Swatch({ code }: { readonly code: string }) {
  const rgb = colorCodeRgb(code);
  if (rgb === undefined) return <span className="inline-block size-3 shrink-0 rounded-sm border border-dashed" aria-hidden />;
  return (
    <span className="inline-block size-3 shrink-0 rounded-sm border" style={{ backgroundColor: `rgb(${rgb.join(' ')})` }} aria-hidden />
  );
}

interface NameColorFieldProps {
  readonly id: string;
  /** Whose replaceName it edits, for the wording. */
  readonly owner?: 'rule' | 'style';
  /** The replaceName the field shows: the rule's (or style's) own, else the rule's style's. */
  readonly replaceName: FilterText | undefined;
  /** The rule's style sets a replaceName: no None (Reset to style brings the style's back). */
  readonly fromStyle?: boolean;
  /** After the label (the style mark). */
  readonly badge?: ReactNode;
  readonly onChange: (replaceName: string | undefined) => void;
}

/**
 * The Basic view's name colour: a colour code select over `replaceName: "ÿc<code>{name}"` (the game's own name in
 * that colour). A replaceName with other text is not this control's: it is disabled and points to Replace name.
 * A style's editor uses it too (`owner="style"`).
 */
export function NameColorField({ id, owner = 'rule', replaceName, fromStyle = false, badge, onChange }: NameColorFieldProps) {
  const code = nameColorCode(replaceName);
  const custom = replaceName !== undefined && code === undefined;
  let none: string;
  if (fromStyle) none = 'The style gives this rule its name colour; another colour here overrides it.';
  else if (owner === 'style')
    none = 'None: this style writes no name; a rule that uses it keeps its own name colour, an earlier rule’s or the game’s.';
  else none = 'None: this rule writes no name; the item keeps an earlier rule’s name or the game’s quality colour.';
  const hint = custom ? (
    'The name is replaced with other text: edit it under Replace name.'
  ) : (
    <>
      Written as a whole new name (replaceName ÿc&lt;code&gt;{'{name}'}), so a later rule&apos;s replaceName overrides it. {none}
    </>
  );
  return (
    <Field id={id} label="Name colour" hint={hint} badge={badge}>
      <Select
        value={custom ? '' : (code ?? NO_COLOR)}
        disabled={custom}
        onValueChange={(value) => {
          onChange(value === NO_COLOR ? undefined : nameColorText(value));
        }}
      >
        <SelectTrigger id={id} className="w-full sm:w-72">
          <SelectValue placeholder="Custom name" />
        </SelectTrigger>
        <SelectContent>
          {!fromStyle && <SelectItem value={NO_COLOR}>None (no name colour from this {owner})</SelectItem>}
          {COLOR_CODES.map((entry) => (
            <SelectItem key={entry.code} value={entry.code}>
              <Swatch code={entry.code} />
              <span className="font-mono">ÿc{entry.code}</span> {entry.name}
              {entry.usedFor !== '' && <span className="text-muted-foreground">· {entry.usedFor}</span>}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
