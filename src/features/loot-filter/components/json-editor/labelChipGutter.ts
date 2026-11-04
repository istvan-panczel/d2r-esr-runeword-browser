/**
 * A gutter with one tiny chip per rule/style that sets a label colour, on the line where its object starts, drawn like
 * the in-game ground label. The chips are recomputed from the whole text a moment after the last edit; between
 * recomputes (and while the text does not parse) the previous chips stay, mapped through the edits.
 */
import { Annotation, RangeSet, StateEffect, StateField, type EditorState, type Extension, type Range, type Text } from '@codemirror/state';
import { EditorView, GutterMarker, ViewPlugin, gutter, type ViewUpdate } from '@codemirror/view';
import type { LabelChip } from '../../utils/labelChips';

/** The chip source: the chips for a text, or undefined when it does not parse. */
export type ComputeLabelChips = (text: string) => readonly LabelChip[] | undefined;

/**
 * Marks a transaction that replaced the text from outside the editor (Revert, edits in the other tabs): the editor does
 * not report it through onChange, and the chips are recomputed without waiting for the debounce.
 */
export const externalChange = Annotation.define<boolean>();

/** Replaces the chips; offsets are in the document the effect is applied to. */
export const setLabelChips = StateEffect.define<readonly LabelChip[]>();

export interface PlacedChip {
  /** The chip's offset, mapped through the edits since it was computed. */
  readonly pos: number;
  readonly chip: LabelChip;
}

interface LabelChipsValue {
  readonly chips: readonly PlacedChip[];
  readonly markers: RangeSet<GutterMarker>;
}

type Rgb = readonly [number, number, number];

/**
 * The chip's opaque base, under its (often translucent) label background, so a chip looks the same in both editor
 * themes: about rgba(0, 0, 0, 0.85) over white, as in-game labels sit on a dark scene. Also the chip without background.
 */
const CHIP_BASE: Rgb = [38, 38, 38];
const LABEL_WHITE: Rgb = [240, 240, 240];
const NEAR_BLACK: Rgb = [20, 20, 20];

const css = ([r, g, b]: Rgb) => `rgb(${String(r)}, ${String(g)}, ${String(b)})`;

/** `rgb(r, g, b)` or `rgba(r, g, b, a)` (the form `labelRgba` writes) as RGB and alpha 0–1; undefined otherwise. */
export function parseCssRgba(color: string): readonly [number, number, number, number] | undefined {
  const match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color.trim());
  if (match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3]), match[4] ? Number(match[4]) : 1];
}

/** WCAG relative luminance. */
function luminance(rgb: Rgb): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The "Aa" colour for a chip without a ÿc text colour: the label white, or near-black when that reads better on the
 * background composited over the chip base (light label backgrounds).
 */
export function chipFallbackText(background: string | null): string {
  const rgba = background === null ? undefined : parseCssRgba(background);
  if (rgba === undefined) return css(LABEL_WHITE);
  const [r, g, b, alpha] = rgba;
  const mix = (channel: number, base: number) => Math.round(channel * alpha + base * (1 - alpha));
  const shown: Rgb = [mix(r, CHIP_BASE[0]), mix(g, CHIP_BASE[1]), mix(b, CHIP_BASE[2])];
  return css(contrast(shown, NEAR_BLACK) > contrast(shown, LABEL_WHITE) ? NEAR_BLACK : LABEL_WHITE);
}
/** The chip is tiny: thicker label borders would swallow it. */
const CHIP_MAX_BORDER = 2;

function sameChip(a: LabelChip, b: LabelChip): boolean {
  return (
    a.textColor === b.textColor &&
    a.background === b.background &&
    a.title === b.title &&
    a.border?.color === b.border?.color &&
    a.border?.width === b.border?.width
  );
}

class LabelChipMarker extends GutterMarker {
  readonly chip: LabelChip;

  constructor(chip: LabelChip) {
    super();
    this.chip = chip;
  }

  override eq(other: GutterMarker): boolean {
    return other instanceof LabelChipMarker && sameChip(other.chip, this.chip);
  }

  override toDOM(): Node {
    const { chip } = this;
    const element = document.createElement('span');
    element.className = 'cm-label-chip';
    element.textContent = 'Aa';
    element.title = chip.title;
    element.setAttribute('aria-hidden', 'true');
    element.style.backgroundColor = css(CHIP_BASE);
    if (chip.background !== null) element.style.backgroundImage = `linear-gradient(${chip.background}, ${chip.background})`;
    element.style.color = chip.textColor ?? chipFallbackText(chip.background);
    if (chip.border !== null) {
      const width = Math.min(Math.max(chip.border.width, 1), CHIP_MAX_BORDER);
      element.style.border = `${String(width)}px solid ${chip.border.color}`;
    }
    return element;
  }
}

/** Markers at the start of each chip's line; the first chip wins when several start on one line. */
function buildMarkers(chips: readonly PlacedChip[], doc: Text): RangeSet<GutterMarker> {
  const ranges: Range<GutterMarker>[] = [];
  const seenLines = new Set<number>();
  for (const { pos, chip } of [...chips].sort((a, b) => a.pos - b.pos)) {
    const line = doc.lineAt(pos);
    if (seenLines.has(line.number)) continue;
    seenLines.add(line.number);
    ranges.push(new LabelChipMarker(chip).range(line.from));
  }
  return RangeSet.of(ranges);
}

function place(chips: readonly LabelChip[], doc: Text): readonly PlacedChip[] {
  return chips.map((chip) => ({ pos: Math.min(Math.max(chip.offset, 0), doc.length), chip }));
}

/** The chips and their gutter markers. */
export const labelChipsField = StateField.define<LabelChipsValue>({
  create: () => ({ chips: [], markers: RangeSet.of<GutterMarker>([]) }),
  update(value, tr) {
    let chips = value.chips;
    let changed = false;
    if (tr.docChanged && chips.length > 0) {
      chips = chips.map(({ pos, chip }) => ({ pos: tr.changes.mapPos(pos), chip }));
      changed = true;
    }
    for (const effect of tr.effects) {
      if (effect.is(setLabelChips)) {
        chips = place(effect.value, tr.newDoc);
        changed = true;
      }
    }
    return changed ? { chips, markers: buildMarkers(chips, tr.newDoc) } : value;
  },
});

/** The current chip positions with their chips, in document order (for tests and callers). */
export function labelChipPositions(state: EditorState): readonly PlacedChip[] {
  return [...state.field(labelChipsField).chips].sort((a, b) => a.pos - b.pos);
}

function chipUpdater(compute: ComputeLabelChips, delay: number) {
  return ViewPlugin.fromClass(
    class {
      private readonly view: EditorView;
      private timer: ReturnType<typeof setTimeout> | undefined;

      constructor(view: EditorView) {
        this.view = view;
        // Dispatching during construction is not allowed: compute right after.
        this.schedule(0);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged) return;
        const external = update.transactions.some((tr) => tr.annotation(externalChange) === true);
        this.schedule(external ? 0 : delay);
      }

      destroy() {
        clearTimeout(this.timer);
      }

      private schedule(wait: number) {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.timer = undefined;
          const chips = compute(this.view.state.doc.toString());
          // Mid-edit text that does not parse: keep the previous chips (already mapped through the edits).
          if (chips !== undefined) this.view.dispatch({ effects: setLabelChips.of(chips) });
        }, wait);
      }
    }
  );
}

const chipTheme = EditorView.baseTheme({
  // A fixed width so the text does not shift when the first chip appears.
  '.cm-label-chip-gutter': { width: '28px' },
  '.cm-label-chip-gutter .cm-gutterElement': {
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    // Centres the chip on the first visual line (1lh here is the editor's line height; the chip's own is 1).
    paddingTop: 'max(0px, calc((1lh - 13px) / 2))',
  },
  '.cm-label-chip': {
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '13px',
    borderRadius: '2px',
    fontSize: '9px',
    fontWeight: '700',
    lineHeight: '1',
    fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    cursor: 'default',
    userSelect: 'none',
  },
});

export interface LabelChipGutterOptions {
  /** The chip source, normally `computeLabelChips` from utils/labelChips (injected so tests can pass their own). */
  readonly compute: ComputeLabelChips;
  /** Milliseconds after the last edit; default 500. */
  readonly delay?: number;
}

/** The label chip gutter: state field, debounced recompute, gutter and its styles. */
export function labelChipGutter({ compute, delay = 500 }: LabelChipGutterOptions): Extension {
  return [
    labelChipsField,
    chipUpdater(compute, delay),
    gutter({ class: 'cm-label-chip-gutter', markers: (view) => view.state.field(labelChipsField).markers }),
    chipTheme,
  ];
}
