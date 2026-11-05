import { Input } from '@/components/ui/input';
import type { LabelColor, MinimapIcon } from '../../engine/types';
import { BUNDLED_ICON_ASSETS, DEFAULT_ICON_NAME } from '../../utils/bundledAssets';
import { applyPatch } from '../../utils/patch';
import { CheckField, Field } from '../Field';
import { NumberInput } from '../NumberInput';
import { ColorControl } from './ColorControl';
import { SpritePreview } from './SpritePreview';

interface IconFieldProps {
  readonly idPrefix: string;
  readonly icon: MinimapIcon | undefined;
  readonly onChange: (icon: MinimapIcon | undefined) => void;
}

/** The `icon` action: on/off, file name, size, tint and a preview of the sprite. */
export function IconField({ idPrefix, icon, onChange }: IconFieldProps) {
  const enabledId = `${idPrefix}-icon`;
  return (
    <div className="flex flex-col gap-3">
      <CheckField
        id={enabledId}
        label="Minimap icon"
        hint="Drawn on the minimap where the item lies. HD graphics only."
        checked={icon !== undefined}
        onChange={(checked) => {
          // goldstar at 50 px; drawn at its own size it is 200 px wide on the minimap.
          onChange(checked ? { iconName: DEFAULT_ICON_NAME, iconSize: 50 } : undefined);
        }}
      />
      {icon && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={`${idPrefix}-icon-name`}
            label="Icon file"
            hint={<>A .sprite in the filter&apos;s icons folder; .sprite may be left off.</>}
          >
            <Input
              id={`${idPrefix}-icon-name`}
              className="font-mono"
              value={icon.iconName}
              list={`${idPrefix}-icon-names`}
              autoComplete="off"
              onChange={(event) => {
                onChange({ ...icon, iconName: event.target.value });
              }}
            />
            <datalist id={`${idPrefix}-icon-names`}>
              {BUNDLED_ICON_ASSETS.map((asset) => (
                <option key={asset.name} value={asset.name} label={`${asset.label}: ${asset.use}`} />
              ))}
            </datalist>
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
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Preview</span>
            {/* Keyed by the name: a local file picked for one name is not shown for another. */}
            <SpritePreview key={icon.iconName} idPrefix={idPrefix} iconName={icon.iconName} iconSize={icon.iconSize} color={icon.color} />
          </div>
        </div>
      )}
    </div>
  );
}
