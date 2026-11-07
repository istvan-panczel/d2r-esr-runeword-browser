/**
 * Hand-written facts about the endgame map bosses, keyed by monstats Id (areas.json `mapBosses`). Only what the game
 * files cannot give: how each fight plays, how to hurt the invincible bosses, the players-8 (uber) variants, and the
 * rewards the official Endgame Maps page lists, kept to show where the files differ. The rewards themselves come from
 * the files (areas.json `mapBosses[].rewards`).
 *
 * Written in our own words from docs/endgame_maps.htm (source 'endgame'). A fact also visible in the txt tables (a
 * monprop property, a skill on hit, a cube recipe, a kill flag) is tagged 'tables'. The integrity test checks that
 * every map boss of the bundle has an entry here and every entry is a map boss.
 */
import type { CampaignNote } from '../engine/types';

/** What the official Endgame Maps page lists as a boss's rewards (percent chances, "on average") */
export interface OfficialBossRewards {
  readonly orb?: number;
  readonly map?: { readonly tier: number; readonly chance: number };
  /** `set`: the page says a whole Pandemonium Key Set */
  readonly key?: { readonly chance: number; readonly set?: true };
  /** Named drops, as the page names them */
  readonly items?: readonly string[];
  /** Worldstone Shards when terrorized: 'one' (T1–T4: "always a shard"), 'none' (T5: "engine limitation") */
  readonly terror: 'one' | 'none';
}

export interface MapBossFacts {
  /** A few words on how the fight plays, each with its source */
  readonly fight: readonly CampaignNote[];
  /** How to make an invincible boss take damage */
  readonly damage?: CampaignNote;
  /** The players-8 (uber) variant: what changes, what it gives */
  readonly uber?: readonly CampaignNote[];
  readonly page: OfficialBossRewards;
}

const PIERCE: CampaignNote = { text: 'pierces your elemental resistances: overcap them', source: 'tables' };

const T1_PAGE: OfficialBossRewards = { orb: 5, map: { tier: 2, chance: 25 }, key: { chance: 25 }, terror: 'one' };
const T2_PAGE: OfficialBossRewards = { orb: 10, map: { tier: 3, chance: 25 }, key: { chance: 35 }, terror: 'one' };
const T3_PAGE: OfficialBossRewards = { orb: 15, map: { tier: 4, chance: 25 }, key: { chance: 50 }, terror: 'one' };
const T4_PAGE: OfficialBossRewards = { orb: 20, map: { tier: 5, chance: 25 }, key: { chance: 100 }, terror: 'one' };
const EYE_PAGE = (item: string): OfficialBossRewards => ({
  orb: 25,
  map: { tier: 5, chance: 25 },
  key: { chance: 50, set: true },
  items: [item],
  terror: 'none',
});
const ANCIENT_PAGE: OfficialBossRewards = { orb: 16.67, map: { tier: 5, chance: 17 }, key: { chance: 100 }, terror: 'none' };
const T5_FINAL_PAGE = (items: readonly string[] = []): OfficialBossRewards => ({
  orb: 50,
  map: { tier: 5, chance: 50 },
  key: { chance: 100, set: true },
  items,
  terror: 'none',
});

const ANCIENTS_DAMAGE: CampaignNote = {
  text: 'Immune until you carry two buffs at once: Heaven’s Light (touch the light orbs that hitting Korlic can call down) and the Eternal Pendulum’s (destroy a pendulum Talic summons).',
  source: 'endgame',
};

export const MAP_BOSS_FACTS: Readonly<Record<string, MapBossFacts>> = {
  // --- Tier 1 ------------------------------------------------------------------------------------------------------
  lucionwhisper: {
    fight: [
      {
        text: 'fire on the ground that burns for a long time; a ground curse that petrifies you and cuts your fire resistance',
        source: 'endgame',
      },
      { text: 'teleports away when hit', source: 'tables' },
    ],
    page: T1_PAGE,
  },
  diablohellhound: {
    fight: [
      { text: 'frenzies, faster with every attack', source: 'endgame' },
      {
        text: 'its attacks can fire Meteor, Frozen Orb, Bone Spirit or a curse that slows you and cuts your resistances',
        source: 'tables',
      },
    ],
    page: T1_PAGE,
  },
  ancientfallenangel: {
    fight: [
      {
        text: 'a slow, expanding physical and magic nova: get a wall between you and it; lightning-ball storms; brief attack-speed rage when hit',
        source: 'endgame',
      },
    ],
    page: T1_PAGE,
  },

  // --- Tier 2 ------------------------------------------------------------------------------------------------------
  terrorintheshadows: {
    fight: [
      {
        text: 'leaps onto you; throws poisonous spiderlings; spits a web ball every few seconds that slows you and cuts your poison resistance',
        source: 'endgame',
      },
    ],
    page: T2_PAGE,
  },
  avatarofthenight: {
    fight: [
      {
        text: 'pounces with a madness debuff (less physical and cold resistance, but faster you); bouncing javelins; ice bolts that stick to walls, then home in',
        source: 'endgame',
      },
      { text: 'crushing blow', source: 'tables' },
    ],
    page: T2_PAGE,
  },

  // --- Tier 3 ------------------------------------------------------------------------------------------------------
  heraldofdoom: {
    fight: [
      {
        text: 'meteor rain; a ring of lightning that turns into homing bolts (run); ice bolts that stick, then home in; a meteor spiral if you stand close',
        source: 'endgame',
      },
      PIERCE,
    ],
    page: T3_PAGE,
  },
  glacialbehemoth: {
    fight: [
      {
        text: 'an ice avalanche up close that leaves freezing fire behind; when hit, a petrifying curse (cold resistance, speed) and a charge',
        source: 'endgame',
      },
    ],
    page: T3_PAGE,
  },
  thetaskmaster: {
    fight: [
      {
        text: 'keeps summoning slaves that are immune until you break the immunity; enrages them, or turns them into suicide runners whose death blast and homing skull hit hard',
        source: 'endgame',
      },
    ],
    page: T3_PAGE,
  },

  // --- Tier 4 ------------------------------------------------------------------------------------------------------
  baaldisfiguredharbinger: {
    fight: [
      {
        text: 'homing cold novas; lightning-ball storms; beasts every 30 seconds that heal his side when they die (kill them away from him); a meteor spiral up close',
        source: 'endgame',
      },
      PIERCE,
    ],
    page: T4_PAGE,
  },
  arbiterofsouls: {
    fight: [
      {
        text: 'a bone spirit that can hit more than once; homing bone-spear volleys; a rare soul storm; when hit, a curse that slows you and cuts your magic resistance',
        source: 'endgame',
      },
    ],
    page: T4_PAGE,
  },

  // --- Tier 5: Eye of the Storm -------------------------------------------------------------------------------------
  mephistotheinvincible: {
    fight: [
      { text: 'poison bombs; homing charged bolts; ice orbs that keep seeking you (run); converging cold waves', source: 'endgame' },
      PIERCE,
    ],
    damage: {
      text: 'Immune until you pick up one of the light orbs that sometimes appear when he is hit: you and your summons can then hurt him for a short while.',
      source: 'endgame',
    },
    page: EYE_PAGE("Mephisto's Demonic Horn"),
  },
  diablotheinvincible: {
    fight: [
      {
        text: 'meteor lines; a huge, slow fire nova announced by a sound (run when you hear it); homing fireballs; a lightning stream every few seconds',
        source: 'endgame',
      },
      PIERCE,
    ],
    damage: {
      text: 'Immune until the angels that hitting him sometimes calls (at most every 10 seconds) are killed by him: they empower the players and minions near them, who can then hurt him for a short while.',
      source: 'endgame',
    },
    page: EYE_PAGE("Diablo's Demonic Horn"),
  },
  baaltheinvincible: {
    fight: [
      { text: 'chain lightning; a cold wave with echoes; a ring of meteors closing in on you every few seconds', source: 'endgame' },
      PIERCE,
    ],
    damage: {
      text: 'Immune until you destroy one of the towers he raises every 13 seconds or so: it empowers the players and minions near it.',
      source: 'endgame',
    },
    page: EYE_PAGE("Baal's Demonic Horn"),
  },

  // --- Tier 5: Icecrown Citadel -------------------------------------------------------------------------------------
  talictheeternal: {
    fight: [{ text: 'axe novas; summons Eternal Pendulums whose sands home in and stun', source: 'endgame' }],
    damage: ANCIENTS_DAMAGE,
    page: ANCIENT_PAGE,
  },
  madawctheeternal: {
    fight: [{ text: 'homing magic axes, an axe frenzy when enraged, a rare nova of axes that stick in walls', source: 'endgame' }],
    damage: ANCIENTS_DAMAGE,
    page: ANCIENT_PAGE,
  },
  korlictheeternal: {
    fight: [
      { text: 'a rain of rocks; axes that converge on you', source: 'endgame' },
      { text: 'charges when hit', source: 'tables' },
    ],
    damage: ANCIENTS_DAMAGE,
    page: ANCIENT_PAGE,
  },
  thelichking: {
    fight: [
      {
        text: 'converging cold spikes; a cold wave that leaves exploding orbs; a pounce with Eternal Winter (cuts cold and physical resistance; sound cue); ghouls and an immune abomination every 20 seconds or so; shadow traps when hit',
        source: 'endgame',
      },
    ],
    damage: {
      text: 'Immune until you carry two buffs at once: Light’s Hope (kill the valkyries his pounce brings) and Heaven’s Light (the light an abomination sometimes calls when hit).',
      source: 'endgame',
    },
    uber: [
      {
        text: 'Three times the ghouls and abominations, ghouls that grow stronger with every hit, six valkyries with double damage.',
        source: 'endgame',
      },
      {
        text: 'Kill him on players 8, then within 60 seconds cube your Ascendancy Stone with a Null Rune: +1 to all skills, once per stone.',
        source: 'tables',
      },
    ],
    page: T5_FINAL_PAGE(),
  },

  // --- Tier 5: Sanctum of the Dead and the Reliquary of False Light -------------------------------------------------
  rathma: {
    fight: [
      {
        text: 'bone spears and poison in turn; a bone spirit that speeds up; every 20 seconds or so a bone maze that detonates (get out); withering effigies; Kor’nac fights at his side and grows stronger over time (he drops nothing)',
        source: 'endgame',
      },
    ],
    damage: {
      text: 'Immune (Kor’nac too) until you carry two buffs at once: the effigies’ (kill them before they crumble) and a Burning Soul (left by the dead he raises after the maze).',
      source: 'endgame',
    },
    uber: [
      {
        text: 'Rathma enrages at a quarter of his life (shockwaves, faster casting, meteors); the raised dead charge much harder; Kor’nac ramps up twice as fast.',
        source: 'endgame',
      },
      {
        text: 'Kill Rathma and Kor’nac on players 8 within 60 seconds of each other, then cube Rathma’s Eternal Skull by itself before that minute runs out: +5% magic resist, +5% to maximum poison resist and +10–20 to Raise Kor’nac, once per skull.',
        source: 'tables',
      },
    ],
    page: T5_FINAL_PAGE(["Rathma's Eternal Skull"]),
  },
  lucion: {
    fight: [
      {
        text: 'a delayed firestorm and a meteor line in turn; a pounce with a converging fire nova that also calls high priests; fanatics that make you take more damage; cleansing flames around him',
        source: 'endgame',
      },
    ],
    damage: {
      text: 'Immune until you carry two buffs at once: the one high priests give when they die, and a few seconds inside his cleansing flames.',
      source: 'endgame',
    },
    uber: [
      {
        text: 'An aura that adds damage and speed to him and his allies every 20 seconds, with no cap; stronger priest buffs; twice the fanatics.',
        source: 'endgame',
      },
      { text: 'Killed on players 8, he also drops Lucion’s Essence, a stronger socketing consumable.', source: 'tables' },
    ],
    page: T5_FINAL_PAGE(["Lucion's Fiery Relic"]),
  },
};
