import { useDispatch } from 'react-redux';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COLOR_CODES, DEFAULT_QUALITY_COLORS, colorCodeRgb, findColorCode } from '../../engine/colors';
import { QUALITIES, type QualityColors, type QualityName } from '../../engine/types';
import { setQualityColors } from '../../store/lootFilterSlice';

const GAME_DEFAULT = '__default';

function Swatch({ code }: { readonly code: string }) {
  const rgb = colorCodeRgb(code);
  if (rgb === undefined) return <span className="inline-block size-3 shrink-0 rounded-sm border border-dashed" aria-hidden />;
  return (
    <span className="inline-block size-3 shrink-0 rounded-sm border" style={{ backgroundColor: `rgb(${rgb.join(' ')})` }} aria-hidden />
  );
}

function describe(code: string): string {
  const entry = findColorCode(code);
  return entry === undefined ? code : `${code} ${entry.name}`;
}

interface QualityColorsEditorProps {
  readonly value: QualityColors | undefined;
}

/** One colour-code select per quality; "game default" removes the quality from `qualityColors`. */
export function QualityColorsEditor({ value }: QualityColorsEditorProps) {
  const dispatch = useDispatch();

  const handleChange = (quality: QualityName, selected: string) => {
    dispatch(setQualityColors({ [quality]: selected === GAME_DEFAULT ? undefined : selected }));
  };

  return (
    // Wide pages: the card spans two columns of the Settings grid, so the nine qualities fit in two rows.
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-5">
      {QUALITIES.map((quality) => {
        const current = value?.[quality];
        const known = current === undefined || COLOR_CODES.some((entry) => `ÿc${entry.code}` === current);
        const id = `loot-filter-quality-${quality}`;
        return (
          <div key={quality} className="flex flex-col gap-1.5">
            <Label htmlFor={id} className="capitalize">
              {quality}
            </Label>
            <Select
              value={current ?? GAME_DEFAULT}
              onValueChange={(selected) => {
                handleChange(quality, selected);
              }}
            >
              <SelectTrigger id={id} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={GAME_DEFAULT}>
                  <Swatch code={DEFAULT_QUALITY_COLORS[quality]} />
                  Game default ({describe(DEFAULT_QUALITY_COLORS[quality])})
                </SelectItem>
                {!known && (
                  <SelectItem value={current}>
                    <Swatch code={current} />
                    {current} (not a known code)
                  </SelectItem>
                )}
                {COLOR_CODES.map((entry) => (
                  <SelectItem key={entry.code} value={`ÿc${entry.code}`}>
                    <Swatch code={entry.code} />
                    <span className="font-mono">ÿc{entry.code}</span> {entry.name}
                    {entry.usedFor !== '' && <span className="text-muted-foreground">· {entry.usedFor}</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
