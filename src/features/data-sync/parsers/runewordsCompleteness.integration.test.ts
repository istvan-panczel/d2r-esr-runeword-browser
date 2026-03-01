/**
 * Comprehensive integration test — the source of truth for runeword data parsing.
 *
 * This test verifies EVERY runeword parsed by our pipeline matches the original HTML
 * source, and that all calculated fields (reqLevel, sortKey, tierPointTotals) are correct.
 *
 * It replicates the full data sync pipeline from dataSyncSaga:
 * 1. Parse rune data from gems.htm (ESR, LoD, Kanji)
 * 2. Build lookup maps (runePoints, runeReqLevel, runePriority)
 * 3. Parse runewords from runewords.htm WITH all lookups
 * 4. Verify every field against raw HTML extraction
 *
 * This test should catch:
 * - Parsing regressions from code changes
 * - Data changes from ESR version updates
 * - HTML entity encoding issues
 * - Column mapping correctness (weapon/helm/armor)
 * - Calculated field correctness (reqLevel, sortKey, tierPointTotals)
 * - Display expansion logic (expandRunewordsByColumn)
 * - Item category mapping completeness
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseRunewordsHtml, type RunePointsLookup, type RuneReqLevelLookup, type RunePriorityLookup } from './runewordsParser';
import { parseEsrRunesHtml } from './esrRunesParser';
import { parseLodRunesHtml } from './lodRunesParser';
import { parseKanjiRunesHtml } from './kanjiRunesParser';
import { extractValue, detectValueType } from './shared/parserUtils';
import { DEFAULT_ESR_RUNE_POINTS, DEFAULT_LOD_RUNE_POINTS } from '../constants/defaultRunePoints';
import { getRelevantCategories, getItemCategory } from '@/features/runewords/utils/itemCategoryMapping';
import { expandRunewordsByColumn } from '@/features/runewords/utils/filteringHelpers';
import type { EsrRune, LodRune, KanjiRune, Runeword } from '@/core/db/models';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const runewordsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/runewords.htm'), 'utf-8');
const gemsHtml = readFileSync(resolve(__dirname, '../../../../test-fixtures/gems.htm'), 'utf-8');

// ─── Parse rune data (same as dataSyncSaga) ──────────────────────────────────

const esrRunes = parseEsrRunesHtml(gemsHtml);
const lodRunes = parseLodRunesHtml(gemsHtml);
const kanjiRunes = parseKanjiRunesHtml(gemsHtml);

// ─── Build lookup maps (replicating dataSyncSaga exactly) ────────────────────

function buildRunePointsLookup(esr: readonly EsrRune[], lod: readonly LodRune[]): RunePointsLookup {
  const lookup: RunePointsLookup = new Map();
  for (const rune of esr) {
    const info =
      rune.points !== undefined
        ? { points: rune.points, tier: rune.tier, category: 'esrRunes' as const }
        : rune.name in DEFAULT_ESR_RUNE_POINTS
          ? { points: DEFAULT_ESR_RUNE_POINTS[rune.name], tier: rune.tier, category: 'esrRunes' as const }
          : null;
    if (info) {
      lookup.set(rune.name, info);
      lookup.set(`esrRunes:${rune.name}`, info);
    }
  }
  for (const rune of lod) {
    const info =
      rune.points !== undefined
        ? { points: rune.points, tier: rune.tier, category: 'lodRunes' as const }
        : rune.name in DEFAULT_LOD_RUNE_POINTS
          ? { points: DEFAULT_LOD_RUNE_POINTS[rune.name], tier: rune.tier, category: 'lodRunes' as const }
          : null;
    if (info) {
      lookup.set(rune.name, info);
      lookup.set(`lodRunes:${rune.name}`, info);
    }
  }
  return lookup;
}

function buildRuneReqLevelLookup(esr: readonly EsrRune[], lod: readonly LodRune[], kanji: readonly KanjiRune[]): RuneReqLevelLookup {
  const lookup: RuneReqLevelLookup = new Map();
  for (const rune of esr) lookup.set(rune.name, rune.reqLevel);
  for (const rune of lod) lookup.set(rune.name, rune.reqLevel);
  for (const rune of kanji) lookup.set(rune.name, rune.reqLevel);
  return lookup;
}

function buildRunePriorityLookup(esr: readonly EsrRune[], lod: readonly LodRune[], kanji: readonly KanjiRune[]): RunePriorityLookup {
  const lookup: RunePriorityLookup = new Map();
  for (const rune of esr) {
    lookup.set(rune.name, rune.tier * 100);
    lookup.set(`esrRunes:${rune.name}`, rune.tier * 100);
  }
  for (const rune of kanji) {
    lookup.set(rune.name, 800);
    lookup.set(`kanjiRunes:${rune.name}`, 800);
  }
  for (const rune of lod) {
    lookup.set(rune.name, 900 + rune.order);
    lookup.set(`lodRunes:${rune.name}`, 900 + rune.order);
  }
  return lookup;
}

const runePointsLookup = buildRunePointsLookup(esrRunes, lodRunes);
const runeReqLevelLookup = buildRuneReqLevelLookup(esrRunes, lodRunes, kanjiRunes);
const runePriorityLookup = buildRunePriorityLookup(esrRunes, lodRunes, kanjiRunes);

// ─── Parse runewords WITH all lookups (full pipeline) ────────────────────────

const parsedRunewords = parseRunewordsHtml(runewordsHtml, runePointsLookup, runeReqLevelLookup, runePriorityLookup);

// ─── Independent raw extraction helpers ──────────────────────────────────────
// These intentionally re-implement extraction logic to verify the parser.

function norm(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function rawExtractName(cell: Element): string {
  const b = cell.querySelector('font[color="#908858"] b, FONT[color="#908858"] b');
  return b?.textContent?.trim() ?? '';
}

function rawExtractSockets(cell: Element): number {
  const text = cell.textContent ?? '';
  const m = /\((\d+)\s*Socket\)/i.exec(text);
  return m ? parseInt(m[1], 10) : 0;
}

function rawExtractRunes(cell: Element): string[] {
  const fontTags = cell.querySelectorAll('FONT[color], font[color]');
  const runes: string[] = [];
  for (const tag of fontTags) {
    if (tag.querySelector('FONT, font')) continue;
    const innerHTML = tag.innerHTML;
    if (innerHTML.includes('<br>') || innerHTML.includes('<BR>')) {
      const parts = innerHTML.split(/<br\s*\/?>/i);
      for (const part of parts) {
        const text = part
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.endsWith(' Rune')) runes.push(text);
      }
    } else {
      const text = tag.textContent?.replace(/\s+/g, ' ').trim() ?? '';
      if (text.endsWith(' Rune')) runes.push(text);
    }
  }
  return runes;
}

function rawExtractAllowedItems(cell: Element): { allowedItems: string[]; excludedItems: string[] } {
  const html = cell.innerHTML;
  const items = html
    .split(/<br\s*\/?>/i)
    .map((s) =>
      s
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter((s) => s.length > 0);
  const exIdx = items.findIndex((s) => s === 'Excluded:');
  if (exIdx === -1) return { allowedItems: items, excludedItems: [] };
  return { allowedItems: items.slice(0, exIdx), excludedItems: items.slice(exIdx + 1) };
}

function rawExtractCellAffixes(cell: Element): string[] {
  const html = cell.innerHTML;
  if (!html.trim()) return [];
  const parts = html.split(/<br\s*\/?>\s*<br\s*\/?>/i);
  const runewordPart = parts[0] ?? '';
  return runewordPart
    .split(/<br\s*\/?>/i)
    .map((line) => line.replace(/<[^>]*>/g, ''))
    .map((line) => decodeEntities(line))
    .map((line) => norm(line))
    .filter((line) => line.length > 0);
}

function rawExtractAffixes(cells: NodeListOf<Element>): string[] {
  for (const cell of [cells[3], cells[4], cells[5]]) {
    const lines = rawExtractCellAffixes(cell);
    if (lines.length > 0) return lines;
  }
  return [];
}

// ─── Parse raw HTML DOM ──────────────────────────────────────────────────────

const domParser = new DOMParser();
const doc = domParser.parseFromString(runewordsHtml, 'text/html');
const rows = doc.querySelectorAll('tr.recipeRow');

// ─── Build rune name sets for classification ────────────────────────────────

const esrRuneNames = new Set(esrRunes.map((r) => r.name));
const lodRuneNames = new Set(lodRunes.map((r) => r.name));
const kanjiRuneNames = new Set(kanjiRunes.map((r) => r.name));
const allRuneNames = new Set([...esrRuneNames, ...lodRuneNames, ...kanjiRuneNames]);

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Per-runeword completeness (every field vs HTML source)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Per-runeword completeness check (every runeword vs HTML source)', () => {
  it('should have the same count of parsed runewords as HTML rows', () => {
    expect(parsedRunewords.length).toBe(rows.length);
  });

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');
    const rawName = rawExtractName(cells[0]);
    const rawSockets = rawExtractSockets(cells[0]);
    const rawRunes = rawExtractRunes(cells[1]);
    const rawItems = rawExtractAllowedItems(cells[2]);
    const rawAffixLines = rawExtractAffixes(cells);

    describe(`[${String(i + 1)}] ${rawName || `(row ${String(i)})`}`, () => {
      it('name', () => {
        expect(parsedRunewords[i].name).toBe(rawName);
      });

      it('sockets', () => {
        expect(parsedRunewords[i].sockets).toBe(rawSockets);
      });

      it('runes', () => {
        expect(parsedRunewords[i].runes).toEqual(rawRunes);
      });

      it('allowed items', () => {
        expect([...parsedRunewords[i].allowedItems]).toEqual(rawItems.allowedItems);
      });

      it('excluded items', () => {
        expect([...parsedRunewords[i].excludedItems]).toEqual(rawItems.excludedItems);
      });

      it('affixes (runeword bonuses, first non-empty column)', () => {
        expect(parsedRunewords[i].affixes.map((a) => a.rawText)).toEqual(rawAffixLines);
      });

      it('per-column affixes match HTML columns', () => {
        const rawWeapon = rawExtractCellAffixes(cells[3]);
        const rawHelm = rawExtractCellAffixes(cells[4]);
        const rawArmor = rawExtractCellAffixes(cells[5]);
        expect(parsedRunewords[i].columnAffixes.weaponsGloves.map((a) => a.rawText)).toEqual(rawWeapon);
        expect(parsedRunewords[i].columnAffixes.helmsBoots.map((a) => a.rawText)).toEqual(rawHelm);
        expect(parsedRunewords[i].columnAffixes.armorShieldsBelts.map((a) => a.rawText)).toEqual(rawArmor);
      });

      it('rune count <= socket count', () => {
        // Mixed gem+rune recipes (e.g. Richesdotcom) have fewer runes than sockets
        expect(parsedRunewords[i].runes.length).toBeLessThanOrEqual(parsedRunewords[i].sockets);
        expect(parsedRunewords[i].runes.length).toBeGreaterThan(0);
      });
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Calculated fields (reqLevel, sortKey, tierPointTotals)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Calculated fields (reqLevel, sortKey, tierPointTotals)', () => {
  describe('reqLevel', () => {
    it('every runeword should have a non-negative reqLevel', () => {
      for (const rw of parsedRunewords) {
        expect(rw.reqLevel, `${rw.name} v${String(rw.variant)}`).toBeGreaterThanOrEqual(0);
      }
    });

    it('reqLevel should equal the max reqLevel among its runes', () => {
      for (const rw of parsedRunewords) {
        const runeReqLevels = rw.runes.map((r) => runeReqLevelLookup.get(r) ?? 0);
        const expectedReqLevel = runeReqLevels.length > 0 ? Math.max(...runeReqLevels) : 0;
        expect(rw.reqLevel, `${rw.name} v${String(rw.variant)}: reqLevel`).toBe(expectedReqLevel);
      }
    });

    it('all runes used in runewords should exist in our rune lookup', () => {
      const missingRunes = new Set<string>();
      for (const rw of parsedRunewords) {
        for (const rune of rw.runes) {
          if (!runeReqLevelLookup.has(rune)) {
            missingRunes.add(rune);
          }
        }
      }
      expect(missingRunes.size, `Runes used in runewords but missing from gems.htm: ${[...missingRunes].join(', ')}`).toBe(0);
    });
  });

  describe('sortKey', () => {
    it('ESR/Kanji runewords should have sortKey < 10000', () => {
      const esrRunewords = parsedRunewords.filter((rw) => rw.sortKey < 10000);
      for (const rw of esrRunewords) {
        expect(rw.sortKey, `${rw.name} v${String(rw.variant)}`).toBe(rw.reqLevel);
      }
    });

    it('LoD runewords should have sortKey >= 10000', () => {
      const lodRunewords = parsedRunewords.filter((rw) => rw.sortKey >= 10000);
      for (const rw of lodRunewords) {
        expect(rw.sortKey, `${rw.name} v${String(rw.variant)}`).toBe(10000 + rw.reqLevel);
      }
    });

    it('LoD runewords should contain at least one LoD-exclusive rune', () => {
      const lodRunewords = parsedRunewords.filter((rw) => rw.sortKey >= 10000);
      for (const rw of lodRunewords) {
        const hasLodExclusive = rw.runes.some((rune) => lodRuneNames.has(rune) && !esrRuneNames.has(rune) && !kanjiRuneNames.has(rune));
        expect(hasLodExclusive, `${rw.name} v${String(rw.variant)}: marked LoD but no LoD-exclusive rune`).toBe(true);
      }
    });

    it('ESR/Kanji runewords should NOT contain any LoD-exclusive rune', () => {
      const esrRunewords = parsedRunewords.filter((rw) => rw.sortKey < 10000);
      for (const rw of esrRunewords) {
        const lodExclusiveRunes = rw.runes.filter((rune) => lodRuneNames.has(rune) && !esrRuneNames.has(rune) && !kanjiRuneNames.has(rune));
        expect(
          lodExclusiveRunes.length,
          `${rw.name} v${String(rw.variant)}: ESR runeword has LoD-exclusive runes: ${lodExclusiveRunes.join(', ')}`
        ).toBe(0);
      }
    });

    it('should have both ESR and LoD runewords', () => {
      const esrCount = parsedRunewords.filter((rw) => rw.sortKey < 10000).length;
      const lodCount = parsedRunewords.filter((rw) => rw.sortKey >= 10000).length;
      expect(esrCount).toBeGreaterThan(0);
      expect(lodCount).toBeGreaterThan(0);
    });
  });

  describe('tierPointTotals', () => {
    it('every runeword should have tierPointTotals array', () => {
      for (const rw of parsedRunewords) {
        expect(Array.isArray(rw.tierPointTotals), `${rw.name} v${String(rw.variant)}`).toBe(true);
      }
    });

    it('tierPointTotals should only contain valid categories and tiers', () => {
      for (const rw of parsedRunewords) {
        for (const entry of rw.tierPointTotals) {
          expect(['esrRunes', 'lodRunes']).toContain(entry.category);
          expect(entry.tier).toBeGreaterThanOrEqual(1);
          expect(entry.totalPoints).toBeGreaterThan(0);
        }
      }
    });

    it('tierPointTotals should be sorted by category then tier', () => {
      for (const rw of parsedRunewords) {
        for (let j = 1; j < rw.tierPointTotals.length; j++) {
          const prev = rw.tierPointTotals[j - 1];
          const curr = rw.tierPointTotals[j];
          const cmp = prev.category.localeCompare(curr.category);
          if (cmp === 0) {
            expect(prev.tier, `${rw.name}: tier order within category`).toBeLessThan(curr.tier);
          } else {
            expect(cmp, `${rw.name}: category order`).toBeLessThan(0);
          }
        }
      }
    });

    it('tierPointTotals should match independently calculated values', () => {
      for (const rw of parsedRunewords) {
        // Independently recalculate
        const isLod = rw.sortKey >= 10000;
        const preferredCategory = isLod ? 'lodRunes' : 'esrRunes';
        const expectedTotals = new Map<string, { tier: number; category: string; totalPoints: number }>();

        for (const runeName of rw.runes) {
          const info = runePointsLookup.get(`${preferredCategory}:${runeName}`) ?? runePointsLookup.get(runeName);
          if (!info) continue;
          const key = `${info.category}:${String(info.tier)}`;
          const existing = expectedTotals.get(key);
          if (existing) {
            existing.totalPoints += info.points;
          } else {
            expectedTotals.set(key, { tier: info.tier, category: info.category, totalPoints: info.points });
          }
        }

        const sorted = Array.from(expectedTotals.values()).sort((a, b) => {
          if (a.category !== b.category) return a.category.localeCompare(b.category);
          return a.tier - b.tier;
        });

        expect(rw.tierPointTotals, `${rw.name} v${String(rw.variant)}: tierPointTotals`).toEqual(sorted);
      }
    });

    it('Kanji runes should not contribute to tierPointTotals (no points system)', () => {
      for (const rw of parsedRunewords) {
        const hasKanjiRune = rw.runes.some((r) => kanjiRuneNames.has(r) && !esrRuneNames.has(r) && !lodRuneNames.has(r));
        if (hasKanjiRune) {
          // Kanji-only runes should not appear in tierPointTotals
          for (const entry of rw.tierPointTotals) {
            expect(entry.category, `${rw.name}: Kanji runes shouldn't have tier points`).not.toBe('kanjiRunes');
          }
        }
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Affix structure validation (ALL columns, not just legacy)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Affix structure correctness (all columns)', () => {
  /** Collect all affixes with source info for iteration */
  function getAllAffixesWithSource(): Array<{ rw: Runeword; affix: Runeword['affixes'][0]; source: string }> {
    const results: Array<{ rw: Runeword; affix: Runeword['affixes'][0]; source: string }> = [];
    for (const rw of parsedRunewords) {
      for (const affix of rw.columnAffixes.weaponsGloves) {
        results.push({ rw, affix, source: 'weaponsGloves' });
      }
      for (const affix of rw.columnAffixes.helmsBoots) {
        results.push({ rw, affix, source: 'helmsBoots' });
      }
      for (const affix of rw.columnAffixes.armorShieldsBelts) {
        results.push({ rw, affix, source: 'armorShieldsBelts' });
      }
    }
    return results;
  }

  const allAffixes = getAllAffixesWithSource();

  it('every affix should have correct pattern (numbers replaced with #)', () => {
    for (const { rw, affix, source } of allAffixes) {
      const expectedPattern = affix.rawText.replace(/[+-]?\d+/g, '#');
      expect(affix.pattern, `${rw.name} [${source}]: "${affix.rawText}"`).toBe(expectedPattern);
    }
  });

  it('every affix should have correct value', () => {
    for (const { rw, affix, source } of allAffixes) {
      const expectedValue = extractValue(affix.rawText);
      expect(affix.value, `${rw.name} [${source}]: "${affix.rawText}"`).toEqual(expectedValue);
    }
  });

  it('every affix should have correct valueType', () => {
    for (const { rw, affix, source } of allAffixes) {
      const expectedType = detectValueType(affix.rawText);
      expect(affix.valueType, `${rw.name} [${source}]: "${affix.rawText}"`).toBe(expectedType);
    }
  });

  it('no affix should have whitespace issues', () => {
    for (const { rw, affix, source } of allAffixes) {
      expect(affix.rawText, `${rw.name} [${source}]: newline in rawText`).not.toMatch(/\n/);
      expect(affix.rawText, `${rw.name} [${source}]: double space in rawText`).not.toMatch(/\s{2,}/);
      expect(affix.rawText, `${rw.name} [${source}]: untrimmed rawText`).toBe(affix.rawText.trim());
    }
  });

  it('no affix should contain HTML tags', () => {
    for (const { rw, affix, source } of allAffixes) {
      expect(affix.rawText, `${rw.name} [${source}]: HTML tag in rawText`).not.toMatch(/<[^>]*>/);
    }
  });

  it('no affix should contain HTML entities (all columns)', () => {
    for (const { rw, affix, source } of allAffixes) {
      expect(affix.rawText, `${rw.name} [${source}]: "${affix.rawText}"`).not.toMatch(/&amp;|&lt;|&gt;|&quot;/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: HTML entity decoding
// ═══════════════════════════════════════════════════════════════════════════════

describe('HTML entity decoding', () => {
  it('should decode &amp; to & in "Pierce Flesh & Bone" affixes', () => {
    const affectedNames = ['Sincerity', 'Maniac', 'Discipline', 'White', 'Moonlight', 'Terminate', 'Passion'];
    for (const name of affectedNames) {
      const rw = parsedRunewords.find((r) => r.name === name);
      expect(rw, `${name} not found`).toBeDefined();

      // Check all columns, not just legacy affixes
      const allColumnAffixes = [
        ...rw!.columnAffixes.weaponsGloves,
        ...rw!.columnAffixes.helmsBoots,
        ...rw!.columnAffixes.armorShieldsBelts,
      ];
      const fleshBoneAffix = allColumnAffixes.find((a) => a.rawText.includes('Pierce Flesh'));
      expect(fleshBoneAffix, `${name} should have Pierce Flesh & Bone affix in column data`).toBeDefined();
      expect(fleshBoneAffix!.rawText).toContain('Pierce Flesh & Bone');
      expect(fleshBoneAffix!.rawText).not.toContain('&amp;');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Column differences and display expansion
// ═══════════════════════════════════════════════════════════════════════════════

describe('Column differences and display expansion', () => {
  /** Dynamically detect runewords with different bonuses across non-empty columns */
  function findRunewordsWithColumnDifferences(): Runeword[] {
    return parsedRunewords.filter((rw) => {
      const { weaponsGloves, helmsBoots, armorShieldsBelts } = rw.columnAffixes;
      const nonEmpty = [weaponsGloves, helmsBoots, armorShieldsBelts].filter((col) => col.length > 0);
      if (nonEmpty.length <= 1) return false;

      const first = nonEmpty[0].map((a) => a.rawText);
      return nonEmpty.some((col) => {
        const texts = col.map((a) => a.rawText);
        return texts.length !== first.length || texts.some((t, j) => t !== first[j]);
      });
    });
  }

  const rwsWithDiffs = findRunewordsWithColumnDifferences();

  it('should detect runewords with column-specific bonuses', () => {
    expect(rwsWithDiffs.length).toBeGreaterThanOrEqual(9);
  });

  it('known runewords should be in the column differences list', () => {
    const knownNames = ['Machine', 'Lightning', 'Gluttony', 'Venom', 'Plague', 'Breath of the Dying', 'Obsession', 'Might of the Earth'];
    for (const name of knownNames) {
      expect(
        rwsWithDiffs.some((rw) => rw.name === name),
        `Expected ${name} to have column differences`
      ).toBe(true);
    }
  });

  it('Machine should have different weapon vs charm bonuses', () => {
    const machine = parsedRunewords.find((rw) => rw.name === 'Machine');
    expect(machine).toBeDefined();
    const { weaponsGloves, helmsBoots } = machine!.columnAffixes;
    expect(weaponsGloves.length).toBeGreaterThan(0);
    expect(helmsBoots.length).toBeGreaterThan(0);
    expect(weaponsGloves.map((a) => a.rawText)).not.toEqual(helmsBoots.map((a) => a.rawText));
  });

  describe('expandRunewordsByColumn with real parsed data', () => {
    const expanded = expandRunewordsByColumn(parsedRunewords);

    it('should produce more entries than input (splitting column-different runewords)', () => {
      expect(expanded.length).toBeGreaterThan(parsedRunewords.length);
    });

    it('split entries should have single-category allowedItems', () => {
      // Find runewords that were split (name appears more than in the original)
      const originalCounts = new Map<string, number>();
      for (const rw of parsedRunewords) {
        originalCounts.set(rw.name, (originalCounts.get(rw.name) ?? 0) + 1);
      }
      const expandedCounts = new Map<string, number>();
      for (const rw of expanded) {
        expandedCounts.set(rw.name, (expandedCounts.get(rw.name) ?? 0) + 1);
      }

      for (const [name, expandedCount] of expandedCounts) {
        const originalCount = originalCounts.get(name) ?? 0;
        if (expandedCount > originalCount) {
          // This runeword was split — each entry should map to at most 1 category
          const splitEntries = expanded.filter((rw) => rw.name === name);
          for (const entry of splitEntries) {
            const categories = getRelevantCategories(entry.allowedItems);
            expect(categories.length, `${name}: split entry should have exactly 1 category`).toBe(1);
          }
        }
      }
    });

    it('non-split runewords should be unchanged', () => {
      // Runewords without column differences should remain identical
      const nonDiffNames = new Set(
        parsedRunewords
          .filter((rw) => !rwsWithDiffs.some((d) => d.name === rw.name && d.variant === rw.variant))
          .map((rw) => `${rw.name}:${String(rw.variant)}`)
      );
      for (const rw of expanded) {
        const key = `${rw.name}:${String(rw.variant)}`;
        if (nonDiffNames.has(key)) {
          const original = parsedRunewords.find((o) => o.name === rw.name && o.variant === rw.variant);
          expect([...rw.allowedItems], `${key}: allowedItems`).toEqual([...original!.allowedItems]);
          expect(
            rw.affixes.map((a) => a.rawText),
            `${key}: affixes`
          ).toEqual(original!.affixes.map((a) => a.rawText));
        }
      }
    });

    it('Machine should expand into exactly 2 entries (Weapon, Charm)', () => {
      const machineEntries = expanded.filter((rw) => rw.name === 'Machine');
      expect(machineEntries.length).toBe(2);

      // One should have weapon items, the other charm
      const categories = machineEntries.map((rw) => getRelevantCategories(rw.allowedItems));
      expect(categories).toContainEqual(['weaponsGloves']);
      expect(categories).toContainEqual(['helmsBoots']);

      // Each should have different affixes
      const affixTexts = machineEntries.map((rw) => rw.affixes.map((a) => a.rawText));
      expect(affixTexts[0]).not.toEqual(affixTexts[1]);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Variant numbering
// ═══════════════════════════════════════════════════════════════════════════════

describe('Variant numbering correctness', () => {
  it('should assign sequential variant numbers starting from 1 for each name', () => {
    const byName = new Map<string, number[]>();
    for (const rw of parsedRunewords) {
      const existing = byName.get(rw.name) ?? [];
      existing.push(rw.variant);
      byName.set(rw.name, existing);
    }
    for (const [name, variants] of byName) {
      const expected = Array.from({ length: variants.length }, (_, j) => j + 1);
      expect(variants, `${name} has wrong variant numbers`).toEqual(expected);
    }
  });

  it('should have unique [name, variant] combinations', () => {
    const keys = new Set<string>();
    for (const rw of parsedRunewords) {
      const key = `${rw.name}:${String(rw.variant)}`;
      expect(keys.has(key), `Duplicate key: ${key}`).toBe(false);
      keys.add(key);
    }
  });

  it('multi-variant runewords should exist (at least one name with 2+ variants)', () => {
    const byName = new Map<string, number>();
    for (const rw of parsedRunewords) {
      byName.set(rw.name, (byName.get(rw.name) ?? 0) + 1);
    }
    const multiVariant = [...byName.entries()].filter(([, count]) => count > 1);
    expect(multiVariant.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Item category mapping completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('Item category mapping completeness', () => {
  it('every item type used in runewords should map to a known category', () => {
    const unmappedItems = new Set<string>();
    for (const rw of parsedRunewords) {
      for (const item of rw.allowedItems) {
        if (getItemCategory(item) === null) {
          unmappedItems.add(item);
        }
      }
    }
    expect(unmappedItems.size, `Item types not mapped to any category: ${[...unmappedItems].join(', ')}`).toBe(0);
  });

  it('every excluded item type should also map to a known category', () => {
    const unmappedItems = new Set<string>();
    for (const rw of parsedRunewords) {
      for (const item of rw.excludedItems) {
        if (getItemCategory(item) === null) {
          unmappedItems.add(item);
        }
      }
    }
    expect(unmappedItems.size, `Excluded item types not mapped to any category: ${[...unmappedItems].join(', ')}`).toBe(0);
  });

  it('every runeword should have at least one relevant bonus category', () => {
    for (const rw of parsedRunewords) {
      const categories = getRelevantCategories(rw.allowedItems);
      expect(categories.length, `${rw.name} v${String(rw.variant)}: no relevant categories`).toBeGreaterThan(0);
    }
  });

  it('every runeword should have non-empty affixes in at least one relevant column', () => {
    for (const rw of parsedRunewords) {
      const categories = getRelevantCategories(rw.allowedItems);
      const hasAffixes = categories.some((cat) => rw.columnAffixes[cat].length > 0);
      expect(hasAffixes, `${rw.name} v${String(rw.variant)}: no affixes in any relevant column`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Rune data cross-validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Rune data cross-validation', () => {
  it('all rune names used in runewords should exist in the parsed rune data', () => {
    const missingRunes = new Set<string>();
    for (const rw of parsedRunewords) {
      for (const rune of rw.runes) {
        if (!allRuneNames.has(rune)) {
          missingRunes.add(rune);
        }
      }
    }
    expect(missingRunes.size, `Runes in runewords but not in gems.htm: ${[...missingRunes].join(', ')}`).toBe(0);
  });

  it('shared runes (ESR + LoD) should have category-prefixed keys in lookups', () => {
    const sharedRunes = [...esrRuneNames].filter((name) => lodRuneNames.has(name));
    for (const runeName of sharedRunes) {
      expect(runePointsLookup.has(`esrRunes:${runeName}`), `${runeName}: missing esrRunes prefixed key`).toBe(true);
      expect(runePointsLookup.has(`lodRunes:${runeName}`), `${runeName}: missing lodRunes prefixed key`).toBe(true);
      expect(runePriorityLookup.has(`esrRunes:${runeName}`), `${runeName}: missing esrRunes priority key`).toBe(true);
      expect(runePriorityLookup.has(`lodRunes:${runeName}`), `${runeName}: missing lodRunes priority key`).toBe(true);
    }
  });

  it('ESR runes should have points info in runePointsLookup', () => {
    for (const rune of esrRunes) {
      const info = runePointsLookup.get(`esrRunes:${rune.name}`);
      expect(info, `${rune.name}: missing from runePointsLookup`).toBeDefined();
      expect(info!.category).toBe('esrRunes');
      expect(info!.tier).toBe(rune.tier);
      expect(info!.points).toBeGreaterThan(0);
    }
  });

  it('LoD runes should have points info in runePointsLookup', () => {
    for (const rune of lodRunes) {
      const info = runePointsLookup.get(`lodRunes:${rune.name}`);
      expect(info, `${rune.name}: missing from runePointsLookup`).toBeDefined();
      expect(info!.category).toBe('lodRunes');
      expect(info!.tier).toBe(rune.tier);
      expect(info!.points).toBeGreaterThan(0);
    }
  });

  it('runePriorityLookup should have correct priority ranges', () => {
    for (const rune of esrRunes) {
      const priority = runePriorityLookup.get(`esrRunes:${rune.name}`);
      expect(priority, `${rune.name}: missing ESR priority`).toBeDefined();
      expect(priority!).toBe(rune.tier * 100);
      expect(priority!).toBeGreaterThanOrEqual(100);
      expect(priority!).toBeLessThanOrEqual(700);
    }
    for (const rune of kanjiRunes) {
      const priority = runePriorityLookup.get(`kanjiRunes:${rune.name}`);
      expect(priority, `${rune.name}: missing Kanji priority`).toBeDefined();
      expect(priority!).toBe(800);
    }
    for (const rune of lodRunes) {
      const priority = runePriorityLookup.get(`lodRunes:${rune.name}`);
      expect(priority, `${rune.name}: missing LoD priority`).toBeDefined();
      expect(priority!).toBe(900 + rune.order);
      expect(priority!).toBeGreaterThanOrEqual(901);
      expect(priority!).toBeLessThanOrEqual(933);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Data quality invariants and edge cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data quality invariants', () => {
  it('every runeword should have a non-empty name', () => {
    for (const rw of parsedRunewords) {
      expect(rw.name.length).toBeGreaterThan(0);
    }
  });

  it('socket count should always be between 1 and 6', () => {
    for (const rw of parsedRunewords) {
      expect(rw.sockets).toBeGreaterThanOrEqual(1);
      expect(rw.sockets).toBeLessThanOrEqual(6);
    }
  });

  it('all rune names should end with " Rune"', () => {
    for (const rw of parsedRunewords) {
      for (const rune of rw.runes) {
        expect(rune.endsWith(' Rune'), `${rw.name}: rune "${rune}" doesn't end with " Rune"`).toBe(true);
      }
    }
  });

  it('every runeword should have at least one affix', () => {
    const noAffixes = parsedRunewords.filter((rw) => rw.affixes.length === 0);
    expect(noAffixes.length, `Runewords with no affixes: ${noAffixes.map((rw) => `${rw.name} v${String(rw.variant)}`).join(', ')}`).toBe(0);
  });

  it('every runeword should have at least one allowed item type', () => {
    const noItems = parsedRunewords.filter((rw) => rw.allowedItems.length === 0);
    expect(noItems.length, `Runewords with no allowed items: ${noItems.map((rw) => `${rw.name} v${String(rw.variant)}`).join(', ')}`).toBe(
      0
    );
  });

  it('no allowed/excluded item should contain HTML tags', () => {
    for (const rw of parsedRunewords) {
      for (const item of [...rw.allowedItems, ...rw.excludedItems]) {
        expect(item).not.toMatch(/<[^>]*>/);
      }
    }
  });

  it('columnAffixes should always have all 3 categories', () => {
    for (const rw of parsedRunewords) {
      expect(Array.isArray(rw.columnAffixes.weaponsGloves)).toBe(true);
      expect(Array.isArray(rw.columnAffixes.helmsBoots)).toBe(true);
      expect(Array.isArray(rw.columnAffixes.armorShieldsBelts)).toBe(true);
    }
  });

  it('Richesdotcom should have fewer runes than sockets (mixed gem+rune recipe)', () => {
    const richesdotcom = parsedRunewords.find((rw) => rw.name === 'Richesdotcom');
    expect(richesdotcom).toBeDefined();
    expect(richesdotcom!.runes.length).toBe(1); // Only "Ru Rune"
    expect(richesdotcom!.sockets).toBe(3); // 3 sockets (2 gems + 1 rune)
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Snapshot counts (detect ESR version changes)
// ═══════════════════════════════════════════════════════════════════════════════

describe('Data snapshot counts (detect ESR version changes)', () => {
  it('should report counts for tracking ESR updates', () => {
    // These are informational — when an ESR update adds/removes runewords,
    // update these counts to document the change.
    const totalRunewords = parsedRunewords.length;
    const esrRunewordCount = parsedRunewords.filter((rw) => rw.sortKey < 10000).length;
    const lodRunewordCount = parsedRunewords.filter((rw) => rw.sortKey >= 10000).length;
    const uniqueNames = new Set(parsedRunewords.map((rw) => rw.name)).size;
    const withColumnDiffs = parsedRunewords.filter((rw) => {
      const { weaponsGloves, helmsBoots, armorShieldsBelts } = rw.columnAffixes;
      const nonEmpty = [weaponsGloves, helmsBoots, armorShieldsBelts].filter((col) => col.length > 0);
      if (nonEmpty.length <= 1) return false;
      const first = nonEmpty[0].map((a) => a.rawText);
      return nonEmpty.some((col) => {
        const texts = col.map((a) => a.rawText);
        return texts.length !== first.length || texts.some((t, j) => t !== first[j]);
      });
    }).length;
    const withExcludedItems = parsedRunewords.filter((rw) => rw.excludedItems.length > 0).length;
    const charmRunewords = parsedRunewords.filter((rw) => rw.allowedItems.some((item) => item.toLowerCase().includes('charm'))).length;

    // If any of these change, it likely means an ESR update modified the runewords data.
    // Update the expected values and verify the changes are correct.
    expect(totalRunewords, 'total runewords').toBeGreaterThanOrEqual(300);
    expect(esrRunewordCount, 'ESR runewords').toBeGreaterThan(0);
    expect(lodRunewordCount, 'LoD runewords').toBeGreaterThan(0);
    expect(uniqueNames, 'unique runeword names').toBeGreaterThanOrEqual(200);
    expect(withColumnDiffs, 'runewords with column differences').toBeGreaterThanOrEqual(9);
    expect(withExcludedItems, 'runewords with excluded items').toBeGreaterThan(0);
    expect(charmRunewords, 'charm runewords').toBeGreaterThanOrEqual(30);

    // Log counts for debugging when an ESR update changes things
    console.log('[Test] Data snapshot:', {
      totalRunewords,
      esrRunewords: esrRunewordCount,
      lodRunewords: lodRunewordCount,
      uniqueNames,
      withColumnDiffs,
      withExcludedItems,
      charmRunewords,
      esrRunesParsed: esrRunes.length,
      lodRunesParsed: lodRunes.length,
      kanjiRunesParsed: kanjiRunes.length,
    });
  });
});
