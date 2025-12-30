import type { TxtPropertyDef, TxtProperty, TxtSkill, CharClassCode } from '@/core/db';
import { getSkillTabInfo } from './skillTabs';

/**
 * Character class code to display name mapping
 */
const CHAR_CLASS_NAMES: ReadonlyMap<CharClassCode, string> = new Map([
  ['ama', 'Amazon'],
  ['sor', 'Sorceress'],
  ['nec', 'Necromancer'],
  ['pal', 'Paladin'],
  ['bar', 'Barbarian'],
  ['dru', 'Druid'],
  ['ass', 'Assassin'],
  ['', ''],
]);

/**
 * Fallback tooltips for properties missing from properties.txt
 * These properties have empty *Tooltip columns in the source data
 */
const FALLBACK_TOOLTIPS: ReadonlyMap<string, string> = new Map([
  ['strpercent', '+#% Bonus to Strength'],
  ['dexpercent', '+#% Bonus to Dexterity'],
  ['vitpercent', '+#% Bonus to Vitality'],
  ['enepercent', '+#% Bonus to Energy'],
  // ESR summon damage properties
  ['extra-summ', '+#% to Summon Damage'],
  ['extra-summ-total', '+#% Total Multiplier to Summon Damage Stat'],
  // Life/mana on hit properties
  ['life-on-striking', '+# Life on Striking'],
  ['mana-on-striking', '+# Mana on Striking'],
  // Element skill bonuses (coldskill, lightningskill, etc. have no tooltip in properties.txt)
  ['coldskill', '+# to Cold Skills'],
  ['lightningskill', '+# to Lightning Skills'],
  ['poisonskill', '+# to Poison Skills'],
  ['magicskill', '+# to Magic Skills'],
  // Life/mana steal - override properties.txt to add + prefix
  ['manasteal', '+#% Mana stolen per hit'],
  ['lifesteal', '+#% Life stolen per hit'],
  // Maximum resistances (res-all-max has no tooltip in properties.txt)
  ['res-all-max', '+#% to All Maximum Resistances'],
]);

/**
 * Property codes that need special translation logic
 */
const SPECIAL_PROPERTY_CODES = new Set(['skilltab', 'red-dmg%', 'dmg-pois', 'oskill', 'skill', 'manasteal', 'lifesteal', 'skill-rand']);

/**
 * Per-level property codes (Based on Character Level)
 * These use the formula: displayValue = max / param
 */
const PER_LEVEL_PROPERTY_PATTERN = /\/lvl$/;

/**
 * Known skill IDs to display names (ESR mod specific)
 * These are skills that appear as oskill bonuses on items
 */
const SKILL_ID_MAP: ReadonlyMap<string, string> = new Map([
  ['765', 'Bonus Crossbow Damage'],
  // Add more skill IDs as needed
]);

/**
 * Translated property with human-readable text
 */
export interface TranslatedProperty {
  readonly text: string;
  readonly rawCode: string;
  readonly param: string;
  readonly min: number;
  readonly max: number;
}

/**
 * Translates property codes to human-readable text
 */
export class PropertyTranslator {
  private readonly propertyMap: Map<string, TxtPropertyDef>;
  private readonly skillClassMap: Map<string, CharClassCode>;

  constructor(properties: readonly TxtPropertyDef[], skills?: readonly TxtSkill[]) {
    this.propertyMap = new Map(properties.map((p) => [p.code, p]));
    this.skillClassMap = new Map(skills?.filter((s) => s.charClass).map((s) => [s.skill, s.charClass]) ?? []);
  }

  /**
   * Translate a single property to human-readable text
   */
  translate(prop: TxtProperty): TranslatedProperty {
    // Check for special property handlers first
    if (SPECIAL_PROPERTY_CODES.has(prop.code)) {
      const specialText = this.translateSpecialProperty(prop);
      if (specialText) {
        return {
          text: specialText,
          rawCode: prop.code,
          param: prop.param,
          min: prop.min,
          max: prop.max,
        };
      }
    }

    const definition = this.propertyMap.get(prop.code);
    const fallbackTooltip = FALLBACK_TOOLTIPS.get(prop.code);

    // Use definition tooltip, fallback tooltip, or raw format
    const tooltip = definition?.tooltip ?? fallbackTooltip;

    if (!tooltip) {
      // Return raw format if no translation found
      return {
        text: this.formatRawProperty(prop),
        rawCode: prop.code,
        param: prop.param,
        min: prop.min,
        max: prop.max,
      };
    }

    const text = this.formatTooltip(tooltip, prop);

    return {
      text,
      rawCode: prop.code,
      param: prop.param,
      min: prop.min,
      max: prop.max,
    };
  }

  /**
   * Translate multiple properties
   */
  translateAll(props: readonly TxtProperty[]): TranslatedProperty[] {
    return props.map((p) => this.translate(p));
  }

  /**
   * Translate properties that need special handling
   */
  private translateSpecialProperty(prop: TxtProperty): string | null {
    switch (prop.code) {
      case 'skilltab':
        return this.translateSkillTab(prop);
      case 'red-dmg%':
        return this.translatePhysicalResist(prop);
      case 'dmg-pois':
        return this.translatePoisonDamage(prop);
      case 'oskill':
        return this.translateOSkill(prop);
      case 'skill':
        return this.translateSkill(prop);
      case 'manasteal':
        return this.translateManaSteal(prop);
      case 'lifesteal':
        return this.translateLifeSteal(prop);
      case 'skill-rand':
        return this.translateSkillRand(prop);
      default:
        return null;
    }
  }

  /**
   * Translate skilltab property with skill tab names
   * param contains the skill tab ID (0-20)
   */
  private translateSkillTab(prop: TxtProperty): string {
    const tabId = parseInt(prop.param, 10);
    const tabInfo = getSkillTabInfo(tabId);
    const valueStr = this.formatValueRange(prop.min, prop.max);

    if (tabInfo) {
      return `+${valueStr} to ${tabInfo.name} (${tabInfo.className} Only)`;
    }

    // Fallback for unknown tab IDs
    return `+${valueStr} to ${prop.param} Skills`;
  }

  /**
   * Translate red-dmg% as Physical Resist (ESR mod specific)
   */
  private translatePhysicalResist(prop: TxtProperty): string {
    const valueStr = this.formatValueRange(prop.min, prop.max);
    return `Physical Resist: ${valueStr}%`;
  }

  /**
   * Translate poison damage with duration
   * Format: dmg-pois with param=frames, min=minDmg, max=maxDmg
   *
   * D2R poison damage formula:
   * - Raw values are stored as "damage per 256 frames"
   * - displayedDamage = rawValue * durationFrames / 256
   * - Duration in seconds = frames / 25
   */
  private translatePoisonDamage(prop: TxtProperty): string {
    const frames = prop.param ? parseInt(prop.param, 10) : 0;
    const durationSeconds = frames / 25;
    // Format duration: show up to 2 decimal places, remove trailing zeros
    const durationStr = durationSeconds.toFixed(2).replace(/\.?0+$/, '');

    // Apply poison damage formula: rawValue * frames / 256
    const displayMin = Math.round((prop.min * frames) / 256);
    const displayMax = Math.round((prop.max * frames) / 256);

    if (displayMin === displayMax) {
      return `Adds ${String(displayMin)} Poison Damage Over ${durationStr} Seconds`;
    }
    return `Adds ${String(displayMin)}-${String(displayMax)} Poison Damage Over ${durationStr} Seconds`;
  }

  /**
   * Translate oskill (non-class skill) with skill name lookup
   * param contains the skill ID or name
   */
  private translateOSkill(prop: TxtProperty): string {
    const valueStr = this.formatValueRange(prop.min, prop.max);
    // Try to resolve skill ID to name
    const skillName = SKILL_ID_MAP.get(prop.param) ?? prop.param;
    return `+${valueStr} to ${skillName}`;
  }

  /**
   * Translate skill property with class name lookup
   * Format: skill with param=skillName, min/max=skill level
   * Output: "+X to SkillName (ClassName Only)"
   */
  private translateSkill(prop: TxtProperty): string {
    const valueStr = this.formatValueRange(prop.min, prop.max);
    const skillName = prop.param;

    // Look up the class for this skill
    const charClassCode = this.skillClassMap.get(skillName);
    const className = charClassCode ? CHAR_CLASS_NAMES.get(charClassCode) : undefined;

    if (className) {
      return `+${valueStr} to ${skillName} (${className} Only)`;
    }

    // Fallback: no class info available, just show skill name
    return `+${valueStr} to ${skillName}`;
  }

  /**
   * Translate mana steal with + prefix
   */
  private translateManaSteal(prop: TxtProperty): string {
    const valueStr = this.formatValueRange(prop.min, prop.max);
    return `+${valueStr}% Mana stolen per hit`;
  }

  /**
   * Translate life steal with + prefix
   */
  private translateLifeSteal(prop: TxtProperty): string {
    const valueStr = this.formatValueRange(prop.min, prop.max);
    return `+${valueStr}% Life stolen per hit`;
  }

  /**
   * Translate skill-rand (random class skill bonus)
   * Format: skill-rand with param=skill level, min/max=skill ID range
   * Output: "+X to Random Class Skill (Specific Class Only)"
   */
  private translateSkillRand(prop: TxtProperty): string {
    const skillLevel = prop.param ? parseInt(prop.param, 10) : 0;
    return `+${String(skillLevel)} to Random Class Skill (Specific Class Only)`;
  }

  /**
   * Format a value range as either single value or (min to max)
   */
  private formatValueRange(min: number, max: number): string {
    if (min === max) {
      return String(min);
    }
    return `(${String(min)} to ${String(max)})`;
  }

  /**
   * Format tooltip text with property values
   */
  private formatTooltip(tooltip: string, prop: TxtProperty): string {
    let text = tooltip;

    // Check if this is a per-level property (Based on Character Level)
    const isPerLevel = PER_LEVEL_PROPERTY_PATTERN.test(prop.code);

    // Count # placeholders in tooltip
    const hashCount = (text.match(/#/g) ?? []).length;

    if (isPerLevel) {
      // Per-level properties: the param value is divided by 8 (default divisor)
      // Example: dmg-fire/lvl with param=16 → 16/8 = 2 → "+2 to Maximum Fire Damage (Based on Character Level)"
      // Some properties use max/param format, others use param/8 format
      // We detect based on whether param looks like a divisor (small number) or a value (larger number)
      let perLevelValue: number;

      if (prop.param) {
        const paramValue = parseInt(prop.param, 10);
        if (prop.max === 0 || prop.max === prop.min) {
          // param is the value to divide by 8 (e.g., dmg-fire/lvl with param=16 → 16/8=2)
          perLevelValue = paramValue / 8;
        } else {
          // max/param format (e.g., thorns/lvl with max=200, param=40 → 200/40=5)
          perLevelValue = prop.max / paramValue;
        }
      } else {
        // No param, use max/8
        perLevelValue = prop.max / 8;
      }

      // Format as integer if whole number, otherwise show decimal
      const displayValue = Number.isInteger(perLevelValue) ? String(perLevelValue) : perLevelValue.toFixed(2).replace(/\.?0+$/, '');
      text = text.replace('#', displayValue);
    } else if (hashCount >= 2) {
      // Two # placeholders: first = min (e.g., chance %), second = max (e.g., skill level)
      // Example: "#% Chance to Cast Level # [Skill]" → "33% Chance to Cast Level 1 [Skill]"
      text = text.replace('#', String(prop.min));
      text = text.replace('#', String(prop.max));
    } else if (hashCount === 1) {
      // Single # placeholder: use range format if min !== max
      if (prop.min === prop.max) {
        text = text.replace('#', String(prop.min));
      } else if (prop.min !== 0 || prop.max !== 0) {
        text = text.replace('#', `(${String(prop.min)} to ${String(prop.max)})`);
      }
    }

    // Fix +- formatting (when template has + and value is negative)
    // Handles: +- → -, + - → -, +(- → (- (for negative ranges like +(-200 to -100))
    text = text.replace(/\+-/g, '-');
    text = text.replace(/\+ -/g, '-');
    text = text.replace(/\+\(-/g, '(-');

    // Handle parameter substitution (skill names, etc.)
    // Skip for per-level properties as param is the divisor, not a skill name
    if (prop.param && !isPerLevel) {
      // Replace bracketed placeholders or append parameter
      if (text.includes('[')) {
        text = text.replace(/\[.*?\]/, prop.param);
      } else if (!text.includes(prop.param)) {
        // Append parameter for skill-related properties
        text = `${text} (${prop.param})`;
      }
    }

    return text;
  }

  /**
   * Format a raw property when no translation is available
   */
  private formatRawProperty(prop: TxtProperty): string {
    let text = prop.code;

    if (prop.param) {
      text += ` ${prop.param}`;
    }

    if (prop.min === prop.max && prop.min !== 0) {
      text += `: ${String(prop.min)}`;
    } else if (prop.min !== 0 || prop.max !== 0) {
      text += `: ${String(prop.min)}-${String(prop.max)}`;
    }

    return text;
  }

  /**
   * Check if a property code is known
   */
  hasProperty(code: string): boolean {
    return this.propertyMap.has(code);
  }

  /**
   * Get raw property definition
   */
  getDefinition(code: string): TxtPropertyDef | undefined {
    return this.propertyMap.get(code);
  }
}

/**
 * Create a property translator from property definitions
 * @param properties Property definitions from properties.txt
 * @param skills Optional skill definitions from skills.txt (for class name lookup)
 */
export function createPropertyTranslator(properties: readonly TxtPropertyDef[], skills?: readonly TxtSkill[]): PropertyTranslator {
  return new PropertyTranslator(properties, skills);
}
