import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DEFAULT_LABEL_BACKGROUND_ALPHA, type LabelBorder, type LabelColor, type RuleActions } from '../../engine/types';
import type { ShallowPatch } from '../../utils/patch';
import { Field } from '../Field';
import { NumberInput } from '../NumberInput';
import { ColorControl } from './ColorControl';
import { ColorValue, FromStyleHint } from './FromStyleHint';
import { Section } from './Section';

interface LabelSectionProps {
  /** Prefix of the controls' ids. */
  readonly idPrefix: string;
  readonly actions: RuleActions;
  readonly onChange: (patch: ShallowPatch<RuleActions>) => void;
  /** What the rule's style gives for the keys the rule leaves empty (rule editor only). */
  readonly fromStyle?: {
    readonly styleName: string;
    readonly labelBackground?: LabelColor;
    readonly labelBorder?: LabelBorder;
  };
}

/** The ground label's background colour and border (colour and width); a style's values show under empty controls. */
export function LabelSection({ idPrefix, actions, onChange, fromStyle }: LabelSectionProps) {
  const backgroundId = `${idPrefix}-label-background`;
  const borderId = `${idPrefix}-label-border`;
  const widthId = `${idPrefix}-label-border-width`;
  const border = actions.labelBorder;

  return (
    <Section title="Label">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id={backgroundId}
          label="Background"
          hint={
            <>
              {fromStyle?.labelBackground !== undefined && (
                <FromStyleHint styleName={fromStyle.styleName}>
                  <ColorValue color={fromStyle.labelBackground} />
                </FromStyleHint>
              )}
              <span className="block">Fills the ground label; alpha defaults to {String(DEFAULT_LABEL_BACKGROUND_ALPHA)}.</span>
            </>
          }
        >
          <ColorControl
            id={backgroundId}
            label="label background"
            value={actions.labelBackground}
            withAlpha
            defaultAlpha={DEFAULT_LABEL_BACKGROUND_ALPHA}
            initialColor={[0, 0, 0]}
            onChange={(labelBackground) => {
              onChange({ labelBackground });
            }}
          />
        </Field>
        <Field
          id={borderId}
          label="Border"
          hint={
            <>
              {fromStyle?.labelBorder !== undefined && (
                <FromStyleHint styleName={fromStyle.styleName}>
                  <ColorValue color={fromStyle.labelBorder.color} defaultAlpha={255} />
                  <span>width {String(fromStyle.labelBorder.width)}</span>
                </FromStyleHint>
              )}
              <span className="block">Outlines the ground label.</span>
            </>
          }
        >
          {border === undefined ? (
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
                  value={border.color}
                  withAlpha
                  clearable={false}
                  onChange={(color) => {
                    if (color) onChange({ labelBorder: { ...border, color } });
                  }}
                />
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
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor={widthId} className="text-xs font-normal text-muted-foreground">
                  Width
                </Label>
                <NumberInput
                  id={widthId}
                  className="w-20"
                  min={0}
                  value={border.width}
                  onCommit={(width) => {
                    onChange({ labelBorder: { ...border, width: width ?? 0 } });
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
