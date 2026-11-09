/** The `scrollLeft` that centres an item in a sideways-scrolling strip, kept within the strip's scroll range. */
export function centeredScrollLeft({
  viewportWidth,
  contentWidth,
  itemLeft,
  itemWidth,
}: {
  readonly viewportWidth: number;
  readonly contentWidth: number;
  readonly itemLeft: number;
  readonly itemWidth: number;
}): number {
  const maxScroll = Math.max(0, contentWidth - viewportWidth);
  return Math.min(maxScroll, Math.max(0, itemLeft + itemWidth / 2 - viewportWidth / 2));
}
