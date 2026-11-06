/**
 * Tokenizer and parser for the game's calc language (skills.txt / skilldesc.txt / missiles.txt formula cells).
 *
 * Grammar, loosest to tightest (conventional precedence, every binary operator left-associative):
 *   ternary     = comparison [ '?' ternary ':' ternary ]
 *   comparison  = additive { ('<' | '>' | '<=' | '>=' | '==' | '!=') additive }
 *   additive    = product { ('+' | '-') product }
 *   product     = power { ('*' | '/') power }
 *   power       = unary { '^' unary }
 *   unary       = '-' unary | primary
 *   primary     = integer | '(' ternary ')' | name '(' args ')' | name
 *   args        = arg { ',' arg },  arg = link | ternary,  link = "'" text "'" { '.' name }
 *
 * Double quotes are skipped like whitespace (the game does the same). There is no unary plus, `&&` or `||`. A minus
 * right after `?`, `:` or `,` is marked ambiguous: the game's compiler only reads `-` as a negation when no value
 * precedes it, and those three tokens do not reset that state, so it may read a subtraction there (ESR: Circle of Blades
 * `…?1:-dm34`). The evaluator refuses ambiguous nodes rather than guess.
 *
 * Parsing never throws: a broken formula becomes a `{ kind: 'error' }` node. Results are cached per text.
 */

export type CalcBinaryOp = '+' | '-' | '*' | '/' | '^' | '<' | '>' | '<=' | '>=' | '==' | '!=';

export interface CalcLink {
  /** Text between the quotes: a skill, stat or missile name */
  name: string;
  /** The `.field` parts after the quotes (`blvl`, `accr`, `lvl` + `edmn`) */
  fields: string[];
}

export type CalcNode =
  | { kind: 'num'; value: number }
  | { kind: 'code'; code: string }
  | { kind: 'neg'; arg: CalcNode; ambiguous?: true }
  | { kind: 'bin'; op: CalcBinaryOp; left: CalcNode; right: CalcNode }
  | { kind: 'ternary'; cond: CalcNode; then: CalcNode; else: CalcNode }
  | { kind: 'call'; name: string; args: CalcNode[] }
  | { kind: 'link'; link: CalcLink }
  | { kind: 'error'; message: string };

type Token =
  { type: 'num'; value: number } | { type: 'name'; value: string } | { type: 'link'; link: CalcLink } | { type: 'op'; value: string };

class CalcSyntaxError extends Error {}

const OPERATORS = ['<=', '>=', '==', '!=', '+', '-', '*', '/', '^', '<', '>', '?', ':', ',', '(', ')'];

function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  while (pos < text.length) {
    const char = text[pos] ?? '';
    if (/\s/.test(char) || char === '"') {
      pos++;
      continue;
    }
    if (/[0-9]/.test(char)) {
      const match = /^[0-9]+/.exec(text.slice(pos))?.[0] ?? '';
      tokens.push({ type: 'num', value: Number(match) });
      pos += match.length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(text.slice(pos))?.[0] ?? '';
      tokens.push({ type: 'name', value: match });
      pos += match.length;
      continue;
    }
    if (char === "'") {
      const end = text.indexOf("'", pos + 1);
      if (end === -1) throw new CalcSyntaxError(`unclosed quote at ${String(pos)}`);
      const name = text.slice(pos + 1, end);
      pos = end + 1;
      const fields: string[] = [];
      while (text[pos] === '.') {
        const field = /^[A-Za-z0-9_]+/.exec(text.slice(pos + 1))?.[0];
        if (field === undefined) throw new CalcSyntaxError(`empty field after '${name}'`);
        fields.push(field);
        pos += 1 + field.length;
      }
      if (fields.length === 0) throw new CalcSyntaxError(`'${name}' without a field`);
      tokens.push({ type: 'link', link: { name, fields } });
      continue;
    }
    const op = OPERATORS.find((candidate) => text.startsWith(candidate, pos));
    if (op === undefined) throw new CalcSyntaxError(`unexpected "${char}" at ${String(pos)}`);
    tokens.push({ type: 'op', value: op });
    pos += op.length;
  }
  return tokens;
}

function parseTokens(tokens: readonly Token[]): CalcNode {
  let pos = 0;
  const peek = (): Token | undefined => tokens[pos];
  const isOpToken = (value: string, token: Token | undefined) => token?.type === 'op' && token.value === value;
  const isOp = (value: string) => isOpToken(value, peek());
  const expect = (value: string) => {
    if (!isOp(value)) throw new CalcSyntaxError(`expected "${value}" at token ${String(pos)}`);
    pos++;
  };
  const binary = (ops: readonly string[], next: () => CalcNode) => (): CalcNode => {
    let left = next();
    for (let token = peek(); token?.type === 'op' && ops.includes(token.value); token = peek()) {
      pos++;
      left = { kind: 'bin', op: token.value as CalcBinaryOp, left, right: next() };
    }
    return left;
  };

  const primary = (): CalcNode => {
    if (pos >= tokens.length) throw new CalcSyntaxError('unexpected end');
    const token = tokens[pos++];
    if (token.type === 'num') return { kind: 'num', value: token.value };
    if (token.type === 'link') throw new CalcSyntaxError(`'${token.link.name}' outside a function call`);
    if (token.type === 'op') {
      if (token.value !== '(') throw new CalcSyntaxError(`unexpected "${token.value}"`);
      const inner = ternary();
      expect(')');
      return inner;
    }
    if (!isOp('(')) return { kind: 'code', code: token.value };
    pos++;
    const args: CalcNode[] = [];
    if (!isOp(')')) {
      for (;;) {
        const next = peek();
        if (next?.type === 'link') {
          pos++;
          args.push({ kind: 'link', link: next.link });
        } else args.push(ternary());
        if (!isOp(',')) break;
        pos++;
      }
    }
    expect(')');
    return { kind: 'call', name: token.value, args };
  };
  const unary = (): CalcNode => {
    if (isOp('-')) {
      const before: Token | undefined = pos > 0 ? tokens[pos - 1] : undefined;
      pos++;
      const arg = unary();
      return ['?', ':', ','].some((op) => isOpToken(op, before)) ? { kind: 'neg', arg, ambiguous: true } : { kind: 'neg', arg };
    }
    return primary();
  };
  const power = binary(['^'], unary);
  const product = binary(['*', '/'], power);
  const additive = binary(['+', '-'], product);
  const comparison = binary(['<=', '>=', '==', '!=', '<', '>'], additive);
  const ternary = (): CalcNode => {
    const cond = comparison();
    if (!isOp('?')) return cond;
    pos++;
    const then = ternary();
    expect(':');
    return { kind: 'ternary', cond, then, else: ternary() };
  };

  const node = ternary();
  if (pos !== tokens.length) throw new CalcSyntaxError(`unexpected token ${String(pos)}`);
  return node;
}

const cache = new Map<string, CalcNode>();

/** Parses a formula cell (cached by text). An empty cell parses as the number 0. */
export function parseCalc(text: string): CalcNode {
  let node = cache.get(text);
  if (node === undefined) {
    try {
      const tokens = tokenize(text);
      node = tokens.length === 0 ? { kind: 'num', value: 0 } : parseTokens(tokens);
    } catch (error) {
      node = { kind: 'error', message: error instanceof Error ? error.message : String(error) };
    }
    cache.set(text, node);
  }
  return node;
}
