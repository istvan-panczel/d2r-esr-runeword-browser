/**
 * Columns for a bordered `divide-y` list of short rows (Enhance outcomes, cube rows, materials) on pages wider than the
 * Standard width: 2 columns from 1536 px, 3 from 2400 px, 4 from 2880 px (`page` container steps, see PageShell), split
 * by a column rule and never breaking a row. The Standard page is one column, as before. CSS columns keep the list
 * order reading down each column, like the single list.
 */
export const ROW_LIST_COLUMNS =
  '*:break-inside-avoid @8xl/page:columns-2 @8xl/page:gap-0 @8xl/page:[column-rule:1px_solid_var(--color-border)] @10xl/page:columns-3 @11xl/page:columns-4';
