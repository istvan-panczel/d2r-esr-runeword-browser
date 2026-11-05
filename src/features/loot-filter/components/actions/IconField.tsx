import type { ReactNode } from 'react';
import type { LabelColor, MinimapIcon } from '../../engine/types';
import { DEFAULT_ICON } from '../../utils/bundledAssets';
import { applyPatch } from '../../utils/patch';
import { CheckField, Field } from '../Field';
import { NumberInput } from '../NumberInput';
import { ColorControl } from './ColorControl';
import { IconPicker } from './IconPicker';
import { SpritePreview } from './SpritePreview';

interface IconFieldProps {
  readonly idPrefix: string;
  /** The icon the field shows: the rule's own, else its style's. */
  readonly icon: MinimapIcon | undefined;
  readonly onChange: (icon: MinimapIcon | undefined) => void;
  /** After the Minimap icon label (the "advanced" tag, the style mark). */
  readonly badge?: ReactNode;
  /** The rule's style sets an icon: the box stays ticked (a rule cannot remove a style's icon, only change it). */
  readonly fromStyle?: boolean;
}

/** The `icon` action: on/off, the icon picker, size, tint and a preview of the sprite. */
export function IconField({ idPrefix, icon, onChange, badge, fromStyle = false }: IconFieldProps) {
  const enabledId = `${idPrefix}-icon`;
  return (
    <div className="flex flex-col gap-3">
      <CheckField
        id={enabledId}
        label="Minimap icon"
        hint={
          fromStyle
            ? 'Drawn on the minimap where the item lies. HD graphics only. The style gives it: change it here, or pick another style to drop it.'
            : 'Drawn on the minimap where the item lies. HD graphics only.'
        }
        checked={icon !== undefined}
        disabled={fromStyle}
        badge={badge}
        onChange={(checked) => {
          onChange(checked ? DEFAULT_ICON : undefined);
        }}
      />
      {icon && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${idPrefix}-icon-name`}
            label="Icon"
            className="sm:col-span-2"
            hint={<>A .sprite in the filter&apos;s icons folder; the bundled ones go into the .zip download.</>}
          >
            <IconPicker
              id={`${idPrefix}-icon-name`}
              iconName={icon.iconName}
              color={icon.color}
              onPick={(iconName) => {
                onChange({ ...icon, iconName });
              }}
            />
          </Field>
          <Field
            id={`${idPrefix}-icon-size`}
            label="Size"
            hint={<>4 to 256: the longer side in minimap pixels; blank = the file&apos;s own size.</>}
          >
            <NumberInput
              id={`${idPrefix}-icon-size`}
              className="w-28"
              integer
              min={4}
              max={256}
              placeholder="file size"
              value={icon.iconSize}
              onCommit={(iconSize) => {
                onChange(applyPatch(icon, { iconSize }));
              }}
            />
          </Field>
          <Field id={`${idPrefix}-icon-color`} label="Tint" hint={<>Multiplies the icon&apos;s colours; alpha fades it.</>}>
            <ColorControl
              id={`${idPrefix}-icon-color`}
              label="icon tint"
              value={icon.color}
              withAlpha
              noneLabel="none (the file's colours)"
              onChange={(color: LabelColor | undefined) => {
                onChange(applyPatch(icon, { color }));
              }}
            />
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium">Preview</span>
            {/* Keyed by the name: a local file picked for one name is not shown for another. */}
            <SpritePreview key={icon.iconName} idPrefix={idPrefix} iconName={icon.iconName} iconSize={icon.iconSize} color={icon.color} />
          </div>
        </div>
      )}
    </div>
  );
}
