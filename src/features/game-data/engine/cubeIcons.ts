/**
 * Item icons for the Cube Recipes page. cube.json `icons` maps the text of a cube cell (an ingredient or a result,
 * without its count) to what it names, written by build/bundleCube.ts; the page reads a cell's icon through
 * `cubeCellIcon`. Shared by the build (which keys) and the page (which looks up), so both split a text the same way.
 *
 * Tokens: `i:<item code>` (a base, quest item or misc item), `t:<item type code>` (a type ingredient: the art its items
 * share, else a representative item's, else none), `u:<unique name>`, `s:<set item name>` (display names).
 *
 * No imports with runtime code: the build scripts load this file under Node.
 */

/** cube.json `icons` value */
export type CubeIconToken = `${'i' | 't' | 'u' | 's'}:${string}`;

/** What a cube cell's icon is looked up by (structurally a subset of the icon component's ItemIconRef) */
export type CubeIconRef =
  { readonly kind: 'item' | 'type'; readonly code: string } | { readonly kind: 'unique' | 'set'; readonly name: string };

const COUNT_PREFIX = /^\d+× /;
/** Separator of the options a merged row joins ("Normal Weapon / Superior Weapon"); cubeText.ts `joinOptions` */
const OPTION_SEPARATOR = ' / ';
/** Separator of several outputs of one row ("Ring + Ring"); cubeFamilies.ts `rowOutput` */
const OUTPUT_SEPARATOR = ' + ';

/** The text without a leading count ("3× Heart" → "Heart") */
export function withoutCount(text: string): string {
  return text.replace(COUNT_PREFIX, '');
}

/**
 * The text without a trailing parenthetical, nested parentheses included ("Assassin's Choker (Unique)" → "Assassin's
 * Choker", "Amulet (Crafted, +(5 to 10) to Life)" → "Amulet"); the text itself when it has none.
 */
export function withoutTrailingNote(text: string): string {
  if (!text.endsWith(')')) return text;
  let depth = 0;
  for (let i = text.length - 1; i >= 0; i--) {
    const char = text[i];
    if (char === ')') depth++;
    else if (char === '(') {
      depth--;
      if (depth === 0) return i > 0 && text[i - 1] === ' ' ? text.slice(0, i - 1) : text;
    }
  }
  return text;
}

/**
 * The options a cell text names, each without its count: "3× Greater Healing Potion / 9× Healing Potion" → two, the
 * "… (7 variants)" tail of a long list left out. Null for a text with several outputs ("A + B"), which gets no icon.
 */
export function cubeCellOptions(text: string): string[] | null {
  if (text.includes(OUTPUT_SEPARATOR)) return null;
  const options = text
    .split(OPTION_SEPARATOR)
    .filter((option) => !option.startsWith('…'))
    .map(withoutCount);
  return options.length === 0 ? null : options;
}

/** The keys a cell text is looked up by: per option the text, then the text without its trailing note */
export function cubeCellKeys(text: string): string[] {
  return (cubeCellOptions(text) ?? []).flatMap((option) => {
    const bare = withoutTrailingNote(option);
    return bare === option ? [option] : [option, bare];
  });
}

/**
 * The token of a cell text: every option must resolve (by its text, else without its trailing note) to the same
 * token, so "Normal Weapon (elite tier) / Superior Weapon (elite tier)" gets the Weapon type's, while "Bul-Kathos'
 * Wedding Band / Nature's Peace" gets none rather than the first item's icon.
 */
export function cubeCellToken(text: string, icons: Readonly<Record<string, string>> | undefined): string | null {
  if (icons === undefined) return null;
  const options = cubeCellOptions(text);
  if (options === null) return null;
  let token: string | null = null;
  for (const option of options) {
    const found = Object.hasOwn(icons, option) ? icons[option] : undefined;
    const bare = withoutTrailingNote(option);
    const own = found ?? (Object.hasOwn(icons, bare) ? icons[bare] : undefined);
    if (own === undefined || (token !== null && own !== token)) return null;
    token = own;
  }
  return token;
}

/** A token as an icon reference; null for a malformed one */
export function cubeIconRef(token: string): CubeIconRef | null {
  const value = token.slice(2);
  if (value === '' || token[1] !== ':') return null;
  switch (token[0]) {
    case 'i':
      return { kind: 'item', code: value };
    case 't':
      return { kind: 'type', code: value };
    case 'u':
      return { kind: 'unique', name: value };
    case 's':
      return { kind: 'set', name: value };
    default:
      return null;
  }
}

/** The icon reference of a cube cell text; null when it names nothing with an icon */
export function cubeCellIcon(text: string, icons: Readonly<Record<string, string>> | undefined): CubeIconRef | null {
  const token = cubeCellToken(text, icons);
  return token === null ? null : cubeIconRef(token);
}
