import { useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { decodeSprite, type DecodedSprite } from '../../engine/sprite';
import type { LabelColor } from '../../engine/types';
import { errorMessage, useBundledSprite } from '../../hooks/useBundledSprite';
import { findBundledIcon } from '../../utils/bundledAssets';
import { spriteDrawSize } from '../../utils/spriteSize';
import { SpriteCanvas } from '../SpriteCanvas';

interface SpritePreviewProps {
  readonly idPrefix: string;
  readonly iconName: string;
  readonly iconSize: number | undefined;
  readonly color: LabelColor | undefined;
}

type LocalSprite =
  | { readonly name: string; readonly sprite: DecodedSprite; readonly error?: undefined }
  | { readonly name: string; readonly sprite?: undefined; readonly error: string };

/** The icon at its minimap size with its pixel sizes under it. */
function SpriteCanvasWithSize({
  sprite,
  iconSize,
  color,
}: {
  readonly sprite: DecodedSprite;
  readonly iconSize?: number;
  readonly color?: LabelColor;
}) {
  const { width, height } = spriteDrawSize(sprite, iconSize);
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex min-h-12 min-w-12 items-center justify-center rounded-md bg-neutral-950 p-2">
        <SpriteCanvas sprite={sprite} color={color} width={width} height={height} aria-label="Minimap icon preview" role="img" />
      </div>
      <p className="text-xs text-muted-foreground">
        {String(width)}×{String(height)} px · file {String(sprite.width)}×{String(sprite.height)}
        {sprite.frames > 1 ? ` · ${String(sprite.frames)} frames, the first is drawn` : ''}
      </p>
    </div>
  );
}

/** Draws a bundled icon (`BUNDLED_ICONS`) or a local `.sprite` the user picks, tinted and at the chosen size. */
export function SpritePreview({ idPrefix, iconName, iconSize, color }: SpritePreviewProps) {
  const bundledName = findBundledIcon(iconName);
  const bundled = useBundledSprite(bundledName);
  const [local, setLocal] = useState<LocalSprite | null>(null);
  // The file picked last: a slower decode of an earlier pick must not replace its result.
  const latestFile = useRef<File | null>(null);

  if (bundledName !== undefined) {
    if (bundled.status === 'ready') return <SpriteCanvasWithSize sprite={bundled.sprite} iconSize={iconSize} color={color} />;
    if (bundled.status === 'error')
      return (
        <p className="text-xs text-destructive">
          Could not draw {bundledName}: {bundled.message}
        </p>
      );
    return <p className="text-xs text-muted-foreground">Loading {bundledName}.sprite…</p>;
  }

  const handleFile = (file: File | undefined) => {
    latestFile.current = file ?? null;
    if (!file) {
      setLocal(null);
      return;
    }
    file.arrayBuffer().then(
      (bytes) => {
        if (latestFile.current !== file) return;
        try {
          setLocal({ name: file.name, sprite: decodeSprite(bytes) });
        } catch (error) {
          setLocal({ name: file.name, error: errorMessage(error) });
        }
      },
      (error: unknown) => {
        if (latestFile.current !== file) return;
        setLocal({ name: file.name, error: errorMessage(error) });
      }
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {iconName.trim() === '' ? 'No icon name yet.' : `"${iconName}" is not bundled here.`} Pick the .sprite file to preview it.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor={`${idPrefix}-sprite-file`} className="sr-only">
          Preview a local .sprite file
        </Label>
        <Input
          id={`${idPrefix}-sprite-file`}
          type="file"
          accept=".sprite"
          className="h-8 w-auto max-w-full text-xs"
          onChange={(event) => {
            handleFile(event.target.files?.[0]);
          }}
        />
      </div>
      {local?.error !== undefined && (
        <p className="text-xs text-destructive">
          {local.name}: {local.error}
        </p>
      )}
      {local?.sprite !== undefined && <SpriteCanvasWithSize sprite={local.sprite} iconSize={iconSize} color={color} />}
    </div>
  );
}
