/**
 * Small HTML-to-text helpers for the parsers of the official ESR pages (shared with the Node scripts, so no imports).
 * The parsed text is always rendered as React text, never as HTML; these only clean it up.
 */

const HTML_TAG = /<[^>]*>/g;

/**
 * Removes HTML tags, repeating until none is left: one pass over input like `<<b>i>` would leave a tag behind
 * (CodeQL js/incomplete-multi-character-sanitization). `replacement` stands in for each tag (e.g. a space).
 */
export function stripHtmlTags(html: string, replacement = ''): string {
  let previous: string;
  let current = html;
  do {
    previous = current;
    current = current.replace(HTML_TAG, replacement);
  } while (current !== previous);
  return current;
}

/**
 * Decodes the common HTML entities that stay encoded in innerHTML after splitting on `<br>`. `&amp;` goes last, so
 * an escaped entity such as `&amp;lt;` becomes the text `&lt;`, not `<` (no double unescaping).
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}
