/** Name helpers shared by the engine and the canvas. Pure. */

const ENDGAME_ZONE = / \(Endgame Zone\)$/;
const LEVEL_SUFFIX = / Level (\d+)$/;

/** The areas.json name without ESR's " (Endgame Zone)" suffix */
export function displayName(name: string): string {
  return name.replace(ENDGAME_ZONE, '');
}

export function hasEndgameZoneSuffix(name: string): boolean {
  return ENDGAME_ZONE.test(name);
}

/** "Tower Cellar Level 3" → "Tower Cellar"; a name without a level suffix is returned as is */
export function baseName(name: string): string {
  return displayName(name).replace(LEVEL_SUFFIX, '');
}

/** Short label of one dot of a stack: "L3" for "<base> Level 3", else "" (the full name is in the aria-label) */
export function memberLabel(name: string, base: string): string {
  const shown = displayName(name);
  const match = LEVEL_SUFFIX.exec(shown);
  return match !== null && shown.replace(LEVEL_SUFFIX, '') === base ? `L${match[1]}` : '';
}

/** Greedy word wrap to lines of at most `maxChars` characters (a longer single word gets its own line) */
export function wrapLabel(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter((w) => w !== '')) {
    if (line === '') line = word;
    else if (line.length + 1 + word.length <= maxChars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}
