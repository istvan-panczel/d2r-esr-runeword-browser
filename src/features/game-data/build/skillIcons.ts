/**
 * Skill icons from the HD skill icon sheets (hd/global/ui/spells/): pure helpers for scripts/generate-skill-icons.ts.
 *
 * - A sheet is one `.sprite` image whose cels sit side by side: `frames` (header i32 at 20) cels of `width / frames`
 *   pixels (132 × 130 in ESR). skilldesc.txt `IconCel` indexes them; even cels are the icon, the odd cel after it is
 *   the pressed variant.
 * - Class skills use `<class>/<xx>skillicon.sprite` (`xx` = first two letters of the class code: am, as, ba, dr, ne,
 *   pa, so, wa). Skills without a class use the shared `submenu/skillicon.sprite` (Attack, Kick, Throw, Unsummon and
 *   ESR's red-framed item skill icons).
 * - Icon keys (skilldetails.json `icon`): `<xx>-<cel>` / `gen-<cel>`; file `icons/skills/<key>.webp`.
 */

export const ESR_HD_SKILL_SPRITES_DIR = 'Eastern_Sun_Resurrected.mpq/data/hd/global/ui/spells';
/** Sheet of the skills without a class (icon key prefix `gen`) */
export const GENERIC_SKILL_SHEET = 'submenu/skillicon.sprite';
export const GENERIC_ICON_PREFIX = 'gen';

export interface SkillIconKey {
  readonly prefix: string;
  readonly cel: number;
}

export function parseSkillIconKey(key: string): SkillIconKey | null {
  const match = /^([a-z]{2}|gen)-(\d+)$/.exec(key);
  if (match === null) return null;
  return { prefix: match[1], cel: Number(match[2]) };
}

/**
 * Sheet path (relative to the spells folder) per icon prefix, from a listing of that folder: `<dir>/<xx>skillicon.sprite`
 * for every class sheet found, plus the generic sheet. `.lowend` and the `skillicon2` / `skillicon3` sheets are not
 * used (skilldesc has no sheet column; every ESR class IconCel fits the first sheet).
 */
export function skillSheets(files: readonly string[]): Map<string, string> {
  const sheets = new Map<string, string>();
  for (const file of [...files].sort()) {
    const match = /^[^/]+\/([a-z]{2})skillicon\.sprite$/.exec(file);
    if (match?.[1] !== undefined && !sheets.has(match[1])) sheets.set(match[1], file);
  }
  if (files.includes(GENERIC_SKILL_SHEET)) sheets.set(GENERIC_ICON_PREFIX, GENERIC_SKILL_SHEET);
  return sheets;
}

/** One cel of a horizontal sheet as RGBA, or null when the cel is outside the sheet. */
export function cropCel(
  sheet: { readonly width: number; readonly height: number; readonly frames: number; readonly rgba: Uint8Array | Uint8ClampedArray },
  cel: number
): { width: number; height: number; rgba: Uint8Array } | null {
  if (!Number.isInteger(cel) || cel < 0 || cel >= sheet.frames || sheet.width % sheet.frames !== 0) return null;
  const width = sheet.width / sheet.frames;
  const out = new Uint8Array(width * sheet.height * 4);
  for (let y = 0; y < sheet.height; y++) {
    const start = (y * sheet.width + cel * width) * 4;
    out.set(sheet.rgba.subarray(start, start + width * 4), y * width * 4);
  }
  return { width, height: sheet.height, rgba: out };
}

/** A specialisation perk icon key (specializations.json `icon`): `<tree slug>-<perk number from 1>` */
export interface PerkIconKey {
  /** The sheet file name (`alchemist.sprite`) */
  sheet: string;
  /** The cel (perk number − 1: the sheet holds one cel per perk in row order) */
  cel: number;
}

export function parsePerkIconKey(key: string): PerkIconKey | null {
  const match = /^([a-z][a-z-]*)-(\d+)$/.exec(key);
  if (match === null || Number(match[2]) < 1) return null;
  return { sheet: `${match[1]}.sprite`, cel: Number(match[2]) - 1 };
}
