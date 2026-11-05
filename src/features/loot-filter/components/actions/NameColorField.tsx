import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLOR_CODES, colorCodeRgb, findColorCode } from '../../engine/colors';
import { resolveText } from '../../engine/text';
import type { FilterText } from '../../engine/types';
import { nameColorCode, nameColorText } from '../../utils/ruleView';
import { Field } from '../Field';
import { FromStyleHint } from './FromStyleHint';

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
  /** The rule's own replaceName. */
  readonly replaceName: FilterText | undefined;
  /** The replaceName the rule's style gives when the rule sets none, with the style's name. */
  readonly fromStyle?: { readonly styleName: string; readonly replaceName: FilterText };
  readonly onChange: (replaceName: string | undefined) => void;
}

/** A style's replaceName as the hint shows it: `ÿc4{name}` (gold), or the text it writes. */
export function StyleNameValue({ replaceName }: { readonly replaceName: FilterText }) {
  const code = nameColorCode(replaceName);
  const text = resolveText(replaceName) ?? '';
  return (
    <>
      {code !== undefined && <Swatch code={code} />}
      <code className="break-all">{text}</code>
      {code !== undefined && <span>({findColorCode(code)?.name})</span>}
    </>
  );
}

/**
 * The Basic view's name colour: a colour code select over `replaceName: "ÿc<code>{name}"` (the game's own name in
 * that colour). A replaceName with other text is not this control's: it is disabled and points to Replace name.
 * When the rule sets none, the hint shows what its style gives.
 */
export function NameColorField({ id, replaceName, fromStyle, onChange }: NameColorFieldProps) {
  const code = nameColorCode(replaceName);
  const custom = replaceName !== undefined && code === undefined;
  let hint: React.ReactNode;
  if (custom) hint = 'This rule replaces the name with its own text: edit it under Replace name.';
  else
    hint = (
      <>
        {replaceName === undefined && fromStyle !== undefined && (
          <FromStyleHint styleName={fromStyle.styleName}>
            <StyleNameValue replaceName={fromStyle.replaceName} />
            <span>A colour here overrides it for this rule.</span>
          </FromStyleHint>
        )}
        <span className="block">
          Written as a whole new name (replaceName ÿc&lt;code&gt;{'{name}'}), so a later rule&apos;s replaceName overrides it.{' '}
          {fromStyle === undefined
            ? 'None: this rule writes no name; the item keeps an earlier rule’s name or the game’s quality colour.'
            : 'None: the style’s name applies.'}
        </span>
      </>
    );
  return (
    <Field id={id} label="Name colour" hint={hint}>
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
          <SelectItem value={NO_COLOR}>
            {fromStyle === undefined ? 'None (no name colour from this rule)' : 'None (the style’s name)'}
          </SelectItem>
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
