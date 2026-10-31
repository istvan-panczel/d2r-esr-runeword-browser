/**
 * Expands one property (`{code, param, min, max}` from an affix or runeword) into stat entries via properties.txt
 * `func1-7` / `stat1-7` / `val1-7`. Property funcs (vanilla semantics, verified against ESR data):
 *
 *  1/2/8/13  stat = min–max            3  same value as the previous slot      5/6  min / max damage = min–max
 *  7         enhanced min + max damage 10 skill tab (param, else val: 0–23)    11  event skill (min = chance, max = level)
 *  12        random skill (param = level, min–max = skill id range)           14  sockets
 *  15 / 16   stat = min / stat = max   17 stat = param (per-level stats, lengths)
 *  19        charges (min = charges, max = level)                           20  indestructible       21  class skills (val = class)
 *  22 / 24   stat with param layer (skill, montype, monster, …) = min–max    23  ethereal
 *  18 (by time), 25, 36 and anything else → fallback text + warning.
 */
import { formatValue, sprintf } from './sprintf.ts';
import type { SkillLookup } from './skills.ts';
import type { PropertyDef } from './tables.ts';

export interface ModInput {
  code: string;
  param: string | null;
  min: number;
  max: number;
}

/**
 * One stat produced by a property. `min`/`max` is the value range, except for event skills (min = chance,
 * max = level) and charges (min = charges, max = level). `text` entries are pre-rendered (sockets, random skill,
 * fallbacks); their sort priority comes from `stat` when it exists in itemstatcost.
 */
export interface StatEntry {
  stat: string;
  param: string;
  min: number;
  max: number;
  text?: string;
}

export interface ExpandContext {
  properties: ReadonlyMap<string, PropertyDef>;
  strings: ReadonlyMap<string, string>;
  skills: SkillLookup;
}

export interface ExpandResult {
  entries: StatEntry[];
  warnings: string[];
}

export function fallbackText(mod: ModInput): string {
  const param = mod.param === null || mod.param === '' ? '' : ` ${mod.param}`;
  return `${mod.code}${param} ${formatValue({ min: mod.min, max: mod.max })}`;
}

function randomSkillText(mod: ModInput, ctx: ExpandContext): string {
  const cls = ctx.skills.skill(String(mod.min))?.cls ?? null;
  const className = cls === null ? 'Class' : (ctx.skills.classText(cls)?.name ?? 'Class');
  const format = ctx.strings.get('ChronicleItemModifierClassSkillRandom') ?? '%+d to a random %s Skill %s';
  return sprintf(format, [Number(mod.param ?? 0), className, '']).trim();
}

export function expandProperty(mod: ModInput, ctx: ExpandContext): ExpandResult {
  const def = ctx.properties.get(mod.code);
  if (def === undefined)
    return { entries: [{ stat: '', param: '', min: 0, max: 0, text: fallbackText(mod) }], warnings: [`unknown property "${mod.code}"`] };

  const param = mod.param ?? '';
  const entries: StatEntry[] = [];
  const warnings: string[] = [];
  let previous = { min: mod.min, max: mod.max };
  const push = (stat: string, min: number, max: number, entryParam = param) => {
    entries.push({ stat, param: entryParam, min, max });
    previous = { min, max };
  };

  for (const slot of def.slots) {
    switch (slot.func) {
      case 1:
      case 2:
      case 8:
      case 13:
      case 22:
      case 24:
        push(slot.stat, mod.min, mod.max);
        break;
      case 3:
        push(slot.stat, previous.min, previous.max);
        break;
      case 5:
        push('mindamage', mod.min, mod.max);
        break;
      case 6:
        push('maxdamage', mod.min, mod.max);
        break;
      case 7:
        push('item_maxdamage_percent', mod.min, mod.max);
        push('item_mindamage_percent', mod.min, mod.max);
        break;
      case 10:
        // ESR `war-tab-rand` has no param and names its tabs (21-23) in val1-3
        push(slot.stat, mod.min, mod.max, param === '' ? String(slot.val) : param);
        break;
      case 11:
      case 19:
        push(slot.stat, mod.min, mod.max);
        break;
      case 12:
        entries.push({ stat: slot.stat, param, min: mod.min, max: mod.max, text: randomSkillText(mod, ctx) });
        break;
      case 14: {
        const format = ctx.strings.get('Socketable') ?? 'Socketed (%d)';
        entries.push({
          stat: slot.stat,
          param,
          min: mod.min,
          max: mod.max,
          text: sprintf(format, [mod.min === mod.max ? mod.min : `${String(mod.min)} to ${String(mod.max)}`]),
        });
        break;
      }
      case 15:
        push(slot.stat, mod.min, mod.min);
        break;
      case 16:
        push(slot.stat, mod.max, mod.max);
        break;
      case 17: {
        const value = Number(param);
        push(slot.stat, value, value, '');
        break;
      }
      case 20:
        push(slot.stat === '' ? 'item_indesctructible' : slot.stat, 1, 1);
        break;
      case 21:
        push(slot.stat, mod.min, mod.max, String(slot.val));
        break;
      case 23:
        entries.push({ stat: '', param, min: 1, max: 1, text: ctx.strings.get('strethereal') ?? 'Ethereal' });
        break;
      default:
        entries.push({ stat: slot.stat, param, min: mod.min, max: mod.max, text: fallbackText(mod) });
        warnings.push(`property "${mod.code}" uses unsupported func ${String(slot.func)}`);
        return { entries, warnings };
    }
  }
  return { entries, warnings };
}
