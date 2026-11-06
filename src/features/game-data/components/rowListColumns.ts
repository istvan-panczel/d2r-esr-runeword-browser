/**
 * Columns for a bordered `divide-y` list of short rows (Enhance outcomes, cube rows, materials) on pages wider than the
 * Standard width: 2 columns from 1536 px, 3 from 2400 px, 4 from 2880 px (`page` container steps, see PageShell), split
 * by a column rule and never breaking a row. The Standard page is one column, as before. CSS columns keep the list
 * order reading down each column, like the single list.
 */
export const ROW_LIST_COLUMNS =
  '*:break-inside-avoid @8xl/page:columns-2 @8xl/page:gap-0 @8xl/page:[column-rule:1px_solid_var(--color-border)] @10xl/page:columns-3 @11xl/page:columns-4';

/**
 * The card surface of a row list or of a group of them (Materials groups, cube families, Enhance outcomes): the page's
 * card look, so lists do not sit on the bare page background. Rows inside use `divide-y` without their own border.
 */
export const LIST_CARD_CLASS = 'rounded-xl border bg-card shadow-sm';

/** The header row of a list card: title, count and links, divided from the rows */
export const LIST_CARD_HEADER_CLASS = 'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b px-4 py-3';

/** A sub-block label inside a list card ("Gem", "Rune", a cube recipe shape): a thin muted band above its rows */
export const LIST_CARD_SUBHEAD_CLASS = 'border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground';
