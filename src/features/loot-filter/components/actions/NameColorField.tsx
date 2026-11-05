import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLOR_CODES, colorCodeRgb } from '../../engine/colors';
import type { FilterText } from '../../engine/types';
import { nameColorCode, nameColorText } from '../../utils/ruleView';
import { Field } from '../Field';

const BY_QUALITY = '__quality';

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
  readonly onChange: (replaceName: string | undefined) => void;
}

/**
 * The Basic view's name colour: a colour code select over `replaceName: "ÿc<code>{name}"` (the game's own name in
 * that colour). A replaceName with other text is not this control's: it is disabled and points to Replace name.
 */
export function NameColorField({ id, replaceName, onChange }: NameColorFieldProps) {
  const code = nameColorCode(replaceName);
  const custom = replaceName !== undefined && code === undefined;
  return (
    <Field
      id={id}
      label="Name colour"
      hint={
        custom
          ? 'This rule replaces the name with its own text: edit it under Replace name.'
          : 'Colours the item name (written as replaceName ÿc<code>{name}). By quality: the game’s colour.'
      }
    >
      <Select
        value={custom ? '' : (code ?? BY_QUALITY)}
        disabled={custom}
        onValueChange={(value) => {
          onChange(value === BY_QUALITY ? undefined : nameColorText(value));
        }}
      >
        <SelectTrigger id={id} className="w-full sm:w-72">
          <SelectValue placeholder="Custom name" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BY_QUALITY}>By quality (the game&apos;s colour)</SelectItem>
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
