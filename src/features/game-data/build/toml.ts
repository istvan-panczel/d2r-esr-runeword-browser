/**
 * A small TOML reader for ESR's D2RLoader plugin configs (`d2rloader/config/celestialrayone.*.toml`). It covers what
 * those files use: `[section]` headers (dashes allowed), `key = value` with booleans, integers, floats, basic and literal
 * strings and (nested, multi-line) arrays, and `#` comments. Arrays of tables (`[[x]]`) get an index suffix
 * (`x[0]`, `x[1]` …) so their keys stay apart. Inline tables, multi-line strings and dates are not supported: such a
 * value is kept as its raw text.
 *
 * Every key keeps the comment lines right above it (`comment`), since the plugin author documents each value there
 * (the modifiers bundle compares them with the value, e.g. crushing-blow.toml `unique = 25` under "-> 12.5 %").
 */

export type TomlValue = boolean | number | string | TomlValue[];

export interface TomlEntry {
  /** `section.key` (`key` for keys before the first section) */
  path: string;
  value: TomlValue;
  /** The comment lines directly above the key (no blank line between), without the leading `#` */
  comment: string[];
  /** 1-based line of the key */
  line: number;
}

export type TomlDocument = ReadonlyMap<string, TomlEntry>;

/** Removes a trailing `# comment` outside quotes. */
function stripComment(line: string): string {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote !== null) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '#') return line.slice(0, i);
  }
  return line;
}

/** Bracket depth of a value text outside quotes (> 0: the array continues on the next line). */
function bracketDepth(text: string): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote !== null) {
      if (ch === '\\' && quote === '"') i++;
      else if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '[') depth++;
    else if (ch === ']') depth--;
  }
  return depth;
}

class ValueParser {
  private pos = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  parse(): TomlValue {
    const value = this.value();
    this.skipSpace();
    if (this.pos !== this.text.length) throw new Error(`unexpected "${this.text.slice(this.pos)}"`);
    return value;
  }

  private skipSpace(): void {
    while (this.pos < this.text.length && /[\s,]/.test(this.text[this.pos])) this.pos++;
  }

  private value(): TomlValue {
    this.skipSpace();
    const ch = this.text[this.pos];
    if (ch === '[') return this.array();
    if (ch === '"') return this.basicString();
    if (ch === "'") return this.literalString();
    const match = /^[^\s,\]]+/.exec(this.text.slice(this.pos));
    if (match === null) throw new Error(`no value at "${this.text.slice(this.pos)}"`);
    this.pos += match[0].length;
    const raw = match[0];
    if (raw === 'true') return true;
    if (raw === 'false') return false;
    const number = Number(raw.replace(/_/g, ''));
    if (raw !== '' && !Number.isNaN(number) && /^[+-]?(\d|inf|nan)/.test(raw)) return number;
    throw new Error(`unsupported value "${raw}"`);
  }

  private array(): TomlValue[] {
    this.pos++;
    const items: TomlValue[] = [];
    for (;;) {
      this.skipSpace();
      if (this.pos >= this.text.length) throw new Error('unterminated array');
      if (this.text[this.pos] === ']') {
        this.pos++;
        return items;
      }
      items.push(this.value());
    }
  }

  private basicString(): string {
    let out = '';
    for (this.pos++; this.pos < this.text.length; this.pos++) {
      const ch = this.text[this.pos];
      if (ch === '"') {
        this.pos++;
        return out;
      }
      if (ch === '\\') {
        const next = this.text[++this.pos];
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      } else out += ch;
    }
    throw new Error('unterminated string');
  }

  private literalString(): string {
    const end = this.text.indexOf("'", this.pos + 1);
    if (end < 0) throw new Error('unterminated string');
    const out = this.text.slice(this.pos + 1, end);
    this.pos = end + 1;
    return out;
  }
}

/** Parses a TOML text; a value it cannot read is kept as its raw text and reported in `errors`. */
export function parseToml(text: string): { entries: Map<string, TomlEntry>; errors: string[] } {
  const entries = new Map<string, TomlEntry>();
  const errors: string[] = [];
  const tableCounts = new Map<string, number>();
  let section = '';
  let comment: string[] = [];
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      comment = [];
      continue;
    }
    if (trimmed.startsWith('#')) {
      comment.push(trimmed.replace(/^#\s?/, ''));
      continue;
    }
    const body = stripComment(trimmed).trim();
    const arrayTable = /^\[\[\s*([^\]]+?)\s*\]\]$/.exec(body);
    const table = /^\[\s*([^\]]+?)\s*\]$/.exec(body);
    if (arrayTable !== null) {
      const name = arrayTable[1];
      const index = tableCounts.get(name) ?? 0;
      tableCounts.set(name, index + 1);
      section = `${name}[${String(index)}]`;
      comment = [];
      continue;
    }
    if (table !== null) {
      section = table[1];
      comment = [];
      continue;
    }
    const eq = body.indexOf('=');
    if (eq < 0) {
      errors.push(`line ${String(i + 1)}: not a key = value line`);
      comment = [];
      continue;
    }
    const key = body
      .slice(0, eq)
      .trim()
      .replace(/^["']|["']$/g, '');
    let valueText = body.slice(eq + 1).trim();
    const line = i + 1;
    while (bracketDepth(valueText) > 0 && i + 1 < lines.length) valueText += ` ${stripComment(lines[++i]).trim()}`;
    let value: TomlValue;
    try {
      value = new ValueParser(valueText).parse();
    } catch (error) {
      errors.push(`line ${String(line)}: ${error instanceof Error ? error.message : String(error)}`);
      value = valueText;
    }
    const path = section === '' ? key : `${section}.${key}`;
    entries.set(path, { path, value, comment, line });
    comment = [];
  }
  return { entries, errors };
}
