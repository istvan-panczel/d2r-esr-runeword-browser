/**
 * Walks every real ESR character save with the committed stash.json. Skipped without the saves: copy the .d2s and
 * .d2rl files from "Saved Games/Diablo II Resurrected/mods/Eastern_Sun_Resurrected" into test-fixtures/character/
 * (gitignored, never committed: they are personal saves).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import type { StashBundle } from '../../game-data/engine/schema.ts';
import { createCharacterData } from './characterData.ts';
import { d2rlMatchesSave, parseD2rl } from './d2rl.ts';
import { computeCharacterChecksum, parseCharacter } from './parseCharacter.ts';
import { assessSaveAge } from './saveAge.ts';
import type { CharacterFile, CharacterItem, WeaponSet } from './types.ts';

const FIXTURE_DIR = resolve(__dirname, '../../../../test-fixtures/character');
const BUNDLE = resolve(__dirname, '../../../../public/game-data/stash.json');

/** The ESR version each save was last written with, read from its .d2rl */
const VERSIONS: Record<string, string> = {
  SpinToWin: '3.3.02',
  Javazon: '3.3.02',
  ZealoProcadin: '3.3.02',
  Dudu: '3.2.24',
  PhysMagicBowazo: '3.2.24',
  Soso: '3.2.24',
  Wawa: '3.2.24',
  cheat: '3.2.24',
  Mefi: '3.2.18',
  Trapsin: '3.2.17',
  EleBowazon: '3.2.10',
};
const NAMES = Object.keys(VERSIONS);
const SAVES = [...NAMES.map((name) => `${name}.d2s`), 'swap/SpinToWin.d2s'];

const readBytes = (path: string) => new Uint8Array(readFileSync(resolve(FIXTURE_DIR, path)));

describe.skipIf(!existsSync(resolve(FIXTURE_DIR, 'SpinToWin.d2s')) || !existsSync(BUNDLE))('ESR character save fixtures', () => {
  const bundle = JSON.parse(readFileSync(BUNDLE, 'utf-8')) as StashBundle;
  const data = createCharacterData(bundle);
  const parsed = new Map<string, CharacterFile>(SAVES.map((save) => [save, parseCharacter(readBytes(save), data)]));
  const character = (save: string): CharacterFile => {
    const found = parsed.get(save);
    if (found === undefined) throw new Error(`no save ${save}`);
    return found;
  };
  const equippedItems = (save: string): CharacterItem[] => character(save).items.player.filter((item) => item.location.kind === 'equipped');
  const weaponIdentity = (set: WeaponSet) =>
    [set.rightHand, set.leftHand].map((item) =>
      item === null ? null : { code: item.code, uniqueId: item.uniqueId, runewordId: item.runewordId, sockets: item.sockets }
    );

  it.each(SAVES)('%s consumes the file exactly and has a valid checksum', (save) => {
    const bytes = readBytes(save);
    const file = character(save);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(12, true)).toBe(computeCharacterChecksum(bytes));
    expect(file.fileSize).toBe(bytes.length);
    expect(file.incomplete).toBeNull();
    expect(file.sections[0]?.start).toBe(0);
    expect(file.sections.at(-1)?.end).toBe(bytes.length);
    file.sections.forEach((section, i) => {
      if (i > 0) expect(section.start).toBe(file.sections[i - 1]?.end);
    });
    expect(file.skills).toHaveLength(35);
    // Every stored item has a real location
    for (const item of file.items.player) expect(item.location.kind).not.toBe('unknown');
    console.log(
      `${save}: ${file.className} L${String(file.level)} active ${String(file.activeWeapon)}, ${String(file.items.player.length)} items, merc ${String(file.items.merc.length)}`
    );
  });

  it('reads SpinToWin as a level 102 Barbarian with 11 equipped and 30 charm-inventory items', () => {
    const file = character('SpinToWin.d2s');
    expect(file.name).toBe('SpinToWin');
    expect(file.className).toBe('Barbarian');
    expect(file.level).toBe(102);
    expect(file.items.player.filter((item) => item.location.kind === 'equipped')).toHaveLength(11);
    expect(file.items.player.filter((item) => item.location.kind === 'charm')).toHaveLength(30);
    expect(file.items.player.filter((item) => item.storePage === 7)).toHaveLength(30);
    expect(file.items.corpses).toHaveLength(0);
    expect(file.items.golem).toBeNull();
    // hotkeys and hand skills are skills.txt rows
    expect(file.handSkills.left.skillId).toBe(574);
    expect(file.hotkeys[0]?.skillId).toBe(582);
    expect(file.skills[0]?.skillId).toBe(558);
    // socketed children sit under their parent
    expect(equippedItems('SpinToWin.d2s').some((item) => item.socketed.length > 0)).toBe(true);
    expect(
      equippedItems('SpinToWin.d2s')
        .flatMap((item) => item.socketed)
        .every((child) => child.location.kind === 'socketed')
    ).toBe(true);
  });

  it('gives the weapon sets normalised identically for a save with the swap active and one without', () => {
    const normal = character('SpinToWin.d2s');
    const swapped = character('swap/SpinToWin.d2s');
    expect(normal.activeWeapon).toBe(0);
    expect(swapped.activeWeapon).toBe(1);
    for (const index of [0, 1] as const) {
      expect(weaponIdentity(swapped.gear.weaponSets[index]), `set ${String(index + 1)}`).toEqual(
        weaponIdentity(normal.gear.weaponSets[index])
      );
    }
    // Thunder Star (unique row 215, 0fl) is set II; on the swap save the file keeps it in body 4, on the other in 11
    const thunderStar = (file: CharacterFile) => file.items.player.find((item) => item.code === '0fl' && item.uniqueId === 215);
    expect(thunderStar(swapped)?.location).toMatchObject({ kind: 'equipped', slot: 'rightHand', weaponSet: 2, rawBody: 4 });
    expect(thunderStar(normal)?.location).toMatchObject({ kind: 'equipped', slot: 'rightHand', weaponSet: 2, rawBody: 11 });
    // Set I holds the two 0fb swords
    expect(normal.gear.weaponSets[0].rightHand?.code).toBe('0fb');
    expect(normal.gear.weaponSets[0].leftHand?.code).toBe('0fb');
  });

  it('turns the quest item sentinel into no unique on the saves that carry one', () => {
    for (const save of ['PhysMagicBowazo.d2s', 'ZealoProcadin.d2s']) {
      const quest = character(save).items.player.filter((item) => item.code === 'hdm' || item.code === 'hst');
      expect(quest.length, save).toBeGreaterThan(0);
      expect(quest.map((item) => item.uniqueId)).toEqual(quest.map(() => null));
    }
  });

  it.each(NAMES)('%s: .d2rl version and hash match its save', async (name) => {
    const save = readBytes(`${name}.d2s`);
    const sidecar = parseD2rl(readBytes(`${name}.d2rl`));
    expect(sidecar.esrVersion).toBe(VERSIONS[name]);
    expect(await d2rlMatchesSave(sidecar, save)).toBe(true);
    expect(sidecar.d2sSize).toBe(save.length);
    // A sidecar never matches another save
    expect(await d2rlMatchesSave(sidecar, new Uint8Array([1, 2, 3]))).toBe(false);
  });

  it('flags the saves from before ESR 3.3.02 by date, and passes the current ones', () => {
    const bundleDate = '2026-11-08T08:37:34+02:00';
    const status = (name: string) =>
      assessSaveAge({ lastSavedAt: character(`${name}.d2s`).lastSavedAt, sidecarVersion: null, bundleVersion: '3.3.02', bundleDate })
        .status;
    for (const name of NAMES) {
      expect(status(name), name).toBe(VERSIONS[name] === '3.3.02' ? 'saved-after-release' : 'saved-before-release');
    }
  });
});
