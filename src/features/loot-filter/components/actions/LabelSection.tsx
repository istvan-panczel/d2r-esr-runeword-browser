import type { ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DEFAULT_LABEL_BACKGROUND_ALPHA, type LabelBorder, type LabelColor, type RuleActions } from '../../engine/types';
import type { ShallowPatch } from '../../utils/patch';
import { Field } from '../Field';
import { NumberInput } from '../NumberInput';
import { ColorControl } from './ColorControl';
import { Section } from './Section';

/** One of the two label keys as the section shows it. */
interface LabelValue<T> {
  /** The rule's own value, else its style's. */
  readonly value: T | undefined;
  /** After the label (the "advanced" tag, the style mark). */
  readonly badge?: ReactNode;
  /** The rule's style sets it: no clear / remove (a rule cannot remove a style's value, only change it). */
  readonly fromStyle?: boolean;
}

interface LabelSectionProps {
  /** Prefix of the controls' ids. */
  readonly idPrefix: string;
  readonly background: LabelValue<LabelColor>;
  readonly border: LabelValue<LabelBorder>;
  readonly onChange: (patch: ShallowPatch<RuleActions>) => void;
}

/** The ground label's background colour and border (colour and width). */
export function LabelSection({ idPrefix, background, border, onChange }: LabelSectionProps) {
  const backgroundId = `${idPrefix}-label-background`;
  const borderId = `${idPrefix}-label-border`;
  const widthId = `${idPrefix}-label-border-width`;
  const shownBorder = border.value;

  return (
    <Section title="Label">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={backgroundId}
          label="Background"
          badge={background.badge}
          hint={`Fills the ground label; alpha defaults to ${String(DEFAULT_LABEL_BACKGROUND_ALPHA)}.`}
        >
          <ColorControl
            id={backgroundId}
            label="label background"
            value={background.value}
            withAlpha
            clearable={background.fromStyle !== true}
            defaultAlpha={DEFAULT_LABEL_BACKGROUND_ALPHA}
            initialColor={[0, 0, 0]}
            onChange={(labelBackground) => {
              onChange({ labelBackground });
            }}
          />
        </Field>
        <Field id={borderId} label="Border" badge={border.badge} hint="Outlines the ground label.">
          {shownBorder === undefined ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">none</span>
              <Button
                id={borderId}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onChange({ labelBorder: { color: [255, 255, 255], width: 1 } });
                }}
              >
                <Plus />
                Add border
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2">
                <ColorControl
                  id={borderId}
                  label="border colour"
                  value={shownBorder.color}
                  withAlpha
                  clearable={false}
                  onChange={(color) => {
                    if (color) onChange({ labelBorder: { ...shownBorder, color } });
                  }}
                />
                {border.fromStyle !== true && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove the border"
                    onClick={() => {
                      onChange({ labelBorder: undefined });
                    }}
                  >
                    <X />
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={widthId} className="text-xs font-normal text-muted-foreground">
                  Width
                </Label>
                <NumberInput
                  id={widthId}
                  className="w-20"
                  min={0}
                  value={shownBorder.width}
                  onCommit={(width) => {
                    onChange({ labelBorder: { ...shownBorder, width: width ?? 0 } });
                  }}
                />
              </div>
            </div>
          )}
        </Field>
      </div>
    </Section>
  );
}
