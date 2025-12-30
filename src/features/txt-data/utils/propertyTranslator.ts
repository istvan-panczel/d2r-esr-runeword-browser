import type { TxtPropertyDef, TxtProperty } from '@/core/db';

/**
 * Fallback tooltips for properties missing from properties.txt
 * These properties have empty *Tooltip columns in the source data
 */
const FALLBACK_TOOLTIPS: ReadonlyMap<string, string> = new Map([
  ['strpercent', '+#% Bonus to Strength'],
  ['dexpercent', '+#% Bonus to Dexterity'],
  ['vitpercent', '+#% Bonus to Vitality'],
  ['enepercent', '+#% Bonus to Energy'],
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

  constructor(properties: readonly TxtPropertyDef[]) {
    this.propertyMap = new Map(properties.map((p) => [p.code, p]));
  }

  /**
   * Translate a single property to human-readable text
   */
  translate(prop: TxtProperty): TranslatedProperty {
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
   * Format tooltip text with property values
   */
  private formatTooltip(tooltip: string, prop: TxtProperty): string {
    let text = tooltip;

    // Replace # placeholder with value
    if (prop.min === prop.max) {
      text = text.replace('#', String(prop.min));
    } else if (prop.min !== 0 || prop.max !== 0) {
      text = text.replace('#', `${String(prop.min)}-${String(prop.max)}`);
    }

    // Handle parameter substitution (skill names, etc.)
    if (prop.param) {
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
 */
export function createPropertyTranslator(properties: readonly TxtPropertyDef[]): PropertyTranslator {
  return new PropertyTranslator(properties);
}
