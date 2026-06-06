/**
 * Parse search text into terms, supporting quoted phrases for exact matching.
 * - Quoted phrases like "life stolen per hit" are kept as single terms
 * - Unquoted words are split by whitespace
 * - All terms are lowercased
 *
 * Examples:
 * - "life resist" → ["life", "resist"]
 * - '"life stolen per hit"' → ["life stolen per hit"]
 * - 'defense "life stolen" resist' → ["defense", "life stolen", "resist"]
 */
export function parseSearchTerms(searchText: string): string[] {
  const terms: string[] = [];
  const text = searchText.toLowerCase();

  // Regex to match quoted phrases or individual words
  // - "([^"]+)" matches content inside quotes (captured in group 1)
  // - (\S+) matches non-whitespace sequences (captured in group 2)
  const regex = /"([^"]+)"|(\S+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // match[1] is quoted content (without quotes), match[2] is unquoted word
    // One of them will always be defined based on the regex alternation
    const rawTerm = match[1] || match[2];
    const term = rawTerm.trim();
    if (term) {
      terms.push(term);
    }
  }

  return terms;
}
