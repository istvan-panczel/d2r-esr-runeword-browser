import { cn } from '@/lib/utils';
import { colorCodeRgb, labelRgba } from '../engine/colors';
import { splitColorRuns } from '../engine/text';
import { DEFAULT_LABEL_BACKGROUND_ALPHA, type LabelBorder, type LabelColor } from '../engine/types';

interface LabelPreviewProps {
  /** The label text with raw `ÿc` colour codes and `\n` line breaks (placeholders already expanded or left as written). */
  readonly text: string;
  readonly background?: LabelColor | null;
  readonly border?: LabelBorder | null;
  /** The colour code character the game would use before the first `ÿc` (default `=`: plain item labels). */
  readonly defaultColor?: string;
  /** Extra classes for the dark "ground" backdrop around the label. */
  readonly className?: string;
}

function textColor(code: string | null, defaultColor: string): string {
  const rgb = colorCodeRgb(code ?? defaultColor) ?? [255, 255, 255];
  return `rgb(${String(rgb[0])}, ${String(rgb[1])}, ${String(rgb[2])})`;
}

/**
 * Draws a ground label the way the game would: coloured text runs on an optional filled, bordered box,
 * over a dark backdrop. Pure presentation; the caller resolves texts and placeholders.
 */
export function LabelPreview({ text, background, border, defaultColor = '=', className }: LabelPreviewProps) {
  const segments = splitColorRuns(text);
  const style = {
    backgroundColor: background ? labelRgba(background, DEFAULT_LABEL_BACKGROUND_ALPHA) : undefined,
    borderColor: border ? labelRgba(border.color, 255) : undefined,
    borderWidth: border ? `${String(Math.max(0, border.width))}px` : undefined,
    borderStyle: border ? 'solid' : undefined,
  };
  return (
    <div className={cn('flex items-center justify-center rounded-md bg-neutral-950 px-4 py-3', className)}>
      <span
        className="inline-block whitespace-pre-wrap px-1.5 py-0.5 text-center font-semibold leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]"
        style={style}
      >
        {segments.length === 0 ? <span className="text-neutral-500">(empty label)</span> : null}
        {/* Segments have no identity of their own and the list is rebuilt on every text change, so the index is the key. */}
        {segments.map((segment, index) =>
          segment.kind === 'break' ? (
            // eslint-disable-next-line react-x/no-array-index-key -- see above
            <br key={index} />
          ) : (
            // eslint-disable-next-line react-x/no-array-index-key -- see above
            <span key={index} style={{ color: textColor(segment.color, defaultColor) }}>
              {segment.text}
            </span>
          )
        )}
      </span>
    </div>
  );
}
