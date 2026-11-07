import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { EsrRune, LodRune } from '@/core/db/models';
import { buildSocketableLookup } from '@/core/utils/socketableLookup';
import { parseRunewordsHtml } from '@/features/data-sync/parsers/runewordsParser';
import type { IconsBundle } from '@/features/game-data/engine/schema';
import { buildItemIconIndex, findItemIcon } from '@/features/game-data/hooks/useItemIcons';
import { buildSocketSlots, hasJewelSlots, runeIconRef, type SocketSlot } from './socketSlots';

const RUNEWORDS = resolve(__dirname, '../../../../test-fixtures/runewords.htm');
const ICONS = resolve(__dirname, '../../../../public/game-data/icons.json');

const jewel = (optional: boolean): SocketSlot => ({ kind: 'jewel', optional });

describe('buildSocketSlots', () => {
  it('lists runes and gems in recipe order', () => {
    const slots = buildSocketSlots({
      sockets: 3,
      runes: ['El Rune', 'Ko Rune'],
      ingredients: ['El Rune', 'Perfect Topaz', 'Ko Rune'],
    });
    expect(slots).toEqual([
      { kind: 'rune', name: 'El Rune' },
      { kind: 'gem', name: 'Perfect Topaz' },
      { kind: 'rune', name: 'Ko Rune' },
    ]);
  });

  it('falls back to the runes of old cached rows without ingredients', () => {
    expect(buildSocketSlots({ sockets: 2, runes: ['El Rune', 'Eld Rune'] })).toEqual([
      { kind: 'rune', name: 'El Rune' },
      { kind: 'rune', name: 'Eld Rune' },
    ]);
    expect(buildSocketSlots({ sockets: 2, runes: ['El Rune', 'Eld Rune'], ingredients: [] })).toHaveLength(2);
  });

  it('puts the required jewel slots first, up to the socket count', () => {
    const slots = buildSocketSlots({ sockets: 5, runes: ['El Rune', 'Eld Rune', 'Tir Rune'] });
    expect(slots).toEqual([
      jewel(false),
      jewel(false),
      { kind: 'rune', name: 'El Rune' },
      { kind: 'rune', name: 'Eld Rune' },
      { kind: 'rune', name: 'Tir Rune' },
    ]);
  });

  it('adds optional jewel slots up to socketsMax, before the runes', () => {
    const slots = buildSocketSlots({ sockets: 3, socketsMax: 6, runes: ['El Rune', 'Eld Rune', 'Tir Rune'] });
    expect(slots).toHaveLength(6);
    expect(slots.slice(0, 3)).toEqual([jewel(true), jewel(true), jewel(true)]);
    expect(slots[3]).toEqual({ kind: 'rune', name: 'El Rune' });
  });

  it('puts required jewels before optional ones and never goes negative', () => {
    expect(buildSocketSlots({ sockets: 3, socketsMax: 5, runes: ['El Rune', 'Eld Rune'] })).toEqual([
      jewel(false),
      jewel(true),
      jewel(true),
      { kind: 'rune', name: 'El Rune' },
      { kind: 'rune', name: 'Eld Rune' },
    ]);
    // Malformed counts (fewer sockets than ingredients) add no jewel slots
    expect(buildSocketSlots({ sockets: 1, socketsMax: 2, runes: ['El Rune', 'Eld Rune'] })).toHaveLength(2);
  });

  it('tells whether a recipe takes jewels', () => {
    expect(hasJewelSlots({ sockets: 2, runes: ['El Rune', 'Eld Rune'] })).toBe(false);
    expect(hasJewelSlots({ sockets: 3, runes: ['El Rune', 'Eld Rune'] })).toBe(true);
    expect(hasJewelSlots({ sockets: 2, socketsMax: 3, runes: ['El Rune', 'Eld Rune'] })).toBe(true);
  });

  describe.skipIf(!existsSync(RUNEWORDS))('with the runewords.htm fixture', () => {
    const runewords = parseRunewordsHtml(readFileSync(RUNEWORDS, 'utf-8'));

    it('gives every runeword as many slots as its (maximum) socket count', () => {
      for (const runeword of runewords) {
        expect(buildSocketSlots(runeword), `${runeword.name} #${String(runeword.variant)}`).toHaveLength(
          runeword.socketsMax ?? runeword.sockets
        );
      }
    });

    it('splits Moonlight into optional jewels (ranged row) and required + optional jewels (per-required-count rows)', () => {
      const moonlight = runewords.filter((runeword) => runeword.name === 'Moonlight');
      const ranged = moonlight.find((runeword) => runeword.sockets === 3);
      const fourSockets = moonlight.find((runeword) => runeword.sockets === 4);
      const sixSockets = moonlight.find((runeword) => runeword.sockets === 6);
      // ESR 3.3: "(3-6 Socket)" "(0-3) Jewels"; "(4-6 Socket)" "(0-2) Jewels" + one "Jewel" line; "(6 Socket)" three
      expect(ranged?.jewelInfo).toBe('(0-3) Jewels');
      expect(fourSockets?.jewelInfo).toBe('(1-3) Jewels');
      expect(sixSockets?.jewelInfo).toBe('(3) Jewels');
      if (ranged === undefined || fourSockets === undefined || sixSockets === undefined) return;
      expect(buildSocketSlots(ranged).filter((slot) => slot.kind === 'jewel')).toEqual([jewel(true), jewel(true), jewel(true)]);
      expect(buildSocketSlots(fourSockets).filter((slot) => slot.kind === 'jewel')).toEqual([jewel(false), jewel(true), jewel(true)]);
      expect(buildSocketSlots(sixSockets).filter((slot) => slot.kind === 'jewel')).toEqual([jewel(false), jewel(false), jewel(false)]);
    });

    it('matches the jewel counts of the jewelInfo text', () => {
      for (const runeword of runewords) {
        if (runeword.jewelInfo === undefined) continue;
        const match = /\((?:(\d+)-)?(\d+)\) Jewels?/.exec(runeword.jewelInfo);
        expect(match, runeword.jewelInfo).not.toBeNull();
        if (match === null) continue;
        const jewels = buildSocketSlots(runeword).filter((slot) => slot.kind === 'jewel');
        const optional = jewels.filter((slot) => slot.optional).length;
        const min = match[1] === undefined ? Number(match[2]) : Number(match[1]);
        expect(jewels.length - optional, `${runeword.name} #${String(runeword.variant)} required`).toBe(min);
        expect(jewels.length, `${runeword.name} #${String(runeword.variant)} total`).toBe(Number(match[2]));
      }
    });
  });
});

describe('runeIconRef', () => {
  const rune = (name: string) => ({ name }) as EsrRune & LodRune;
  const lookup = buildSocketableLookup([rune('Ko Rune'), rune('El Rune')], [rune('Ko Rune'), rune('Ber Rune')], [], []);
  const icons = buildItemIconIndex(JSON.parse(readFileSync(ICONS, 'utf-8')) as IconsBundle);

  it('picks the LoD Ko art in a LoD runeword and the ESR Ko art otherwise', () => {
    expect(runeIconRef(lookup, 'Ko Rune', true)).toEqual({ kind: 'misc', name: 'Ko Rune', code: 'r68' });
    expect(runeIconRef(lookup, 'Ko Rune', false)).toEqual({ kind: 'misc', name: 'Ko Rune', code: 'r19' });
    const lod = findItemIcon(icons, runeIconRef(lookup, 'Ko Rune', true));
    const esr = findItemIcon(icons, runeIconRef(lookup, 'Ko Rune', false));
    expect(lod).toBeDefined();
    expect(esr).toBeDefined();
    expect(lod?.file).not.toBe(esr?.file);
  });

  it('follows the runeword before the lookup has loaded', () => {
    expect(runeIconRef(undefined, 'Ko Rune', true)).toEqual(runeIconRef(lookup, 'Ko Rune', true));
    expect(runeIconRef(null, 'Ko Rune', false)).toEqual(runeIconRef(lookup, 'Ko Rune', false));
  });

  it('finds the icons of runes without a shared name', () => {
    expect(runeIconRef(lookup, 'Ber Rune', false)).toEqual({ kind: 'misc', name: 'Ber Rune' });
    expect(findItemIcon(icons, runeIconRef(lookup, 'Ber Rune', false))).toBeDefined();
    expect(findItemIcon(icons, runeIconRef(lookup, 'El Rune', true))).toBeDefined();
  });
});
