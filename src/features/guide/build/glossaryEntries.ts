/**
 * Resolves the parsed _glossary.yml entries against the game data: `{fact:<key>[:<field>]}` values in definitions
 * (modifiers.json facts, so a number from the game files is never typed by hand) and the `link:` key (a guide link
 * target such as `page:/modifiers?kind=deadly-strike`, resolved and validated like a note's link; app links only).
 */
import type { ModifierFact } from '../../game-data/engine/schema.ts';
import type { GlossaryEntry } from '../engine/schema.ts';
import type { BuildError, GuideContext } from './context.ts';
import { resolveLink } from './links.ts';

const DIFFICULTY_INDEX: Readonly<Record<string, number>> = { normal: 0, nightmare: 1, hell: 2 };

const FACT_PLACEHOLDER = /\{fact:([^}:]+)(?::([^}]+))?\}/g;

/** A number as the glossary prints it: a typographic minus for negative values */
export function formatFactNumber(value: number): string {
  return value < 0 ? `−${String(-value)}` : String(value);
}

/**
 * One fact value: a plain number, `normal|nightmare|hell` of a per-difficulty fact, or a field of a per-target /
 * per-setting fact.
 */
export function factNumber(fact: ModifierFact, field: string | null): number | BuildError {
  const { value } = fact;
  if (typeof value === 'number') return field === null ? value : { error: `fact "${fact.key}" has no fields (got ":${field}")` };
  if (Array.isArray(value)) {
    const index = field === null ? undefined : DIFFICULTY_INDEX[field];
    const picked: unknown = index === undefined ? undefined : value[index];
    if (typeof picked === 'number') return picked;
    return { error: `fact "${fact.key}" is per difficulty; add :normal, :nightmare or :hell` };
  }
  if (typeof value === 'object') {
    const picked = field === null ? undefined : value[field];
    if (picked !== undefined) return picked;
    return { error: `fact "${fact.key}" needs one of :${Object.keys(value).join(', :')}` };
  }
  return { error: `fact "${fact.key}" is not a number` };
}

function resolveDefinition(definition: string, facts: GuideContext['modifierFacts'], where: string, errors: string[]): string {
  return definition.replace(FACT_PLACEHOLDER, (placeholder, key: string, field: string | undefined) => {
    const fact = facts.get(key);
    const value =
      fact === undefined
        ? { error: `unknown fact "${key}" (a fact key of public/game-data/modifiers.json)` }
        : factNumber(fact, field ?? null);
    if (typeof value === 'number') return formatFactNumber(value);
    errors.push(`${where}: ${placeholder}: ${value.error}`);
    return placeholder;
  });
}

export function resolveGlossaryEntries(
  entries: readonly GlossaryEntry[],
  ctx: GuideContext,
  where: string,
  errors: string[]
): GlossaryEntry[] {
  return entries.map((entry) => {
    const at = `${where}: "${entry.term}"`;
    const { link: target, ...rest } = { ...entry, definition: resolveDefinition(entry.definition, ctx.modifierFacts, at, errors) };
    if (target === undefined) return rest;
    const link = resolveLink(target, ctx);
    if ('error' in link) errors.push(`${at}: link: ${link.error}`);
    else if (link.kind !== 'app') errors.push(`${at}: link: "${target}" must point at an app page (page:/modifiers?kind=…)`);
    else return { ...rest, link: link.href };
    return rest;
  });
}
