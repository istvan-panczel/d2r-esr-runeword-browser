/** The search help of the stash pages (All items, Ancient Coupons): how words, item type words and phrases match. */
export const STASH_SEARCH_HELP = {
  examples: [
    { query: 'ru', description: 'any text containing "ru", e.g. "Ru Rune"' },
    { query: 'belt', description: 'belts (by item type), or "belt" as a word in a name or stat' },
    { query: 'ring fire', description: 'rings that also mention "fire"' },
    { query: '"faster cast rate"', description: 'exact phrase' },
  ],
  notes: (
    <>
      <div>
        <h4 className="mb-1 font-medium">Words</h4>
        <p className="text-sm text-muted-foreground">
          A word matches anywhere in the text, also inside a longer word: <code className="rounded bg-muted px-1">ru</code> finds
          &quot;Rune&quot;.
        </p>
      </div>
      <div>
        <h4 className="mb-1 font-medium">Item Types</h4>
        <p className="text-sm text-muted-foreground">
          Item type words (belt, helm, ring, amulet, charm, rune…) match the item&apos;s type, or a whole word of its name, socketed items
          or stats.
        </p>
      </div>
    </>
  ),
} as const;
