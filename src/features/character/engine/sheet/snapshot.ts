/** The compact snapshot of a computed sheet (CharacterStatsSnapshot), for storing on a shared build */
import type { CharacterSheet, CharacterStatsSnapshot } from './types';

export interface SnapshotMeta {
  /** The save's last-saved time (Unix seconds) */
  savedAt: number;
  esrVersion?: string;
}

export function toStatsSnapshot(sheet: CharacterSheet, meta: SnapshotMeta): CharacterStatsSnapshot {
  const { attributes: a, resists: r, speed, offense, defenseChances: d } = sheet;
  // The game's screen shows attack rating per skill: the left button's, else the right's
  const { hands } = sheet.attackRating;
  const hand = hands.find((entry) => entry.hand === 'left') ?? hands.find((entry) => entry.hand === 'right');
  const snapshot: CharacterStatsSnapshot = {
    v: 1,
    difficulty: sheet.difficulty,
    savedAt: meta.savedAt,
    ...(meta.esrVersion === undefined ? {} : { esrVersion: meta.esrVersion }),
    lvl: sheet.level,
    str: a.strength.value,
    dex: a.dexterity.value,
    vit: a.vitality.value,
    ene: a.energy.value,
    life: sheet.life.value,
    mana: sheet.mana.value,
    def: sheet.defense.value,
    fr: r.fire.value,
    cr: r.cold.value,
    lr: r.lightning.value,
    pr: r.poison.value,
    mr: r.magic.value,
    phr: r.physical.value,
    frm: r.fire.cap,
    crm: r.cold.cap,
    lrm: r.lightning.cap,
    prm: r.poison.cap,
    mrm: r.magic.cap,
    dr: sheet.damageReduction.value,
    mdr: sheet.magicDamageReduction.value,
    ias: speed.attack.value,
    frw: speed.run.value,
    fhr: speed.hitRecovery.value,
    fbr: speed.block.value,
    fcr: speed.cast.value,
    sk: sheet.skills.all.value,
    ar: hand?.mainHand ?? sheet.attackRating.base.value,
    ...(hand === undefined ? {} : { ars: hand.name }),
    arp: sheet.attackRating.percent.value,
    ds: offense.deadlyStrike.value,
    cb: offense.crushingBlow.value,
    ll: sheet.leech.life.value,
    ml: sheet.leech.mana.value,
    mf: sheet.find.magic.value,
    gf: sheet.find.gold.value,
    dod: d.dodge.value,
    avo: d.avoid.value,
    eva: d.evade.value,
  };
  if (sheet.block !== null) snapshot.blk = sheet.block.value;
  if (sheet.buffs.length > 0) snapshot.buf = 1;
  if (sheet.weaponSet === 2) snapshot.ws = 2;
  return snapshot;
}
