/**
 * Hand-written facts per area (levels.txt Id): bosses, quest steps with their item codes (misc.txt / weapons.txt; the
 * page shows the ESR item name and icon), notes from the official Maps page, the official teleport list, special flags.
 * `name` must equal the areas.json name: a rename makes buildCampaignMap report a problem.
 *
 * Sources: 'official' = official ESR Maps page, 'vanilla' = unchanged Diablo II behaviour (not confirmed in ESR),
 * 'tables' = read from the txt files, 'owner' = confirmed in game. `verify` = still to confirm in game.
 */
import type { CuratedArea } from './types';

/** The official Maps page lists five levels with no teleport across the walls; the owner confirmed you can teleport there */
const TELEPORT_OK_NOTE = {
  text: 'You can teleport across the walls here (the official Maps page says you cannot)',
  source: 'owner',
} as const;
const PANDEMONIUM = 'Cube a Key of Terror, a Key of Hate and a Key of Destruction in Harrogath: one of three portals opens';

export const CURATED_AREAS: Readonly<Record<number, CuratedArea>> = {
  // --- Act I ---------------------------------------------------------------------------------------------------------
  4: {
    name: 'Stony Field',
    bosses: ['Rakanishu'],
    quests: [
      {
        quest: 'The Search for Cain',
        how: 'Touch the Cairn Stones in the order on the Key to the Cairn Stones',
        itemCode: 'bkd',
        source: 'owner',
      },
    ],
  },
  5: {
    name: 'Dark Wood',
    bosses: ['Treehead WoodFist'],
    quests: [
      { quest: 'The Search for Cain', how: 'Take the Scroll of Inifuss from the Tree of Inifuss', itemCode: 'bks', source: 'owner' },
    ],
  },
  8: {
    name: 'Den of Evil',
    bosses: ['Corpsefire'],
    quests: [{ quest: 'Den of Evil', how: 'Kill every monster in the cave', source: 'owner' }],
  },
  12: {
    name: "Blood Raven's Workshop Level 1 (Endgame Zone)",
    officialName: "Blood Raven's Workshop",
    notes: [{ text: 'Special area. Location: Act 1 Tamoe Highland', source: 'official' }],
  },
  17: {
    name: 'Burial Grounds',
    bosses: ['Blood Raven'],
    quests: [{ quest: "Sisters' Burial Grounds", how: 'Kill Blood Raven', source: 'owner' }],
  },
  25: {
    name: 'Tower Cellar Level 5',
    officialName: 'Forgotten Tower Level 5',
    bosses: ['The Countess'],
    quests: [{ quest: 'The Forgotten Tower', how: 'Kill the Countess', source: 'owner' }],
    notes: [TELEPORT_OK_NOTE],
  },
  28: {
    name: 'Barracks',
    bosses: ['The Smith'],
    quests: [{ quest: 'Tools of the Trade', how: 'The Smith guards the Horadric Malus', itemCode: 'hdm', source: 'owner' }],
  },
  31: {
    name: 'Jail Level 2',
    notes: [{ text: 'The old Jail Level 3: ESR removed Jail Level 2 (official page: "replaced 2 with 3")', source: 'official' }],
  },
  37: {
    name: 'Catacombs Level 3',
    officialName: 'Catacomb Level 4',
    bosses: ['Andariel'],
    quests: [{ quest: 'Sisters to the Slaughter', how: 'Kill Andariel', source: 'owner' }],
    notes: [
      { text: 'The old Catacombs Level 4: ESR removed Level 3 (official page: "replaced 3 with 4")', source: 'official' },
      TELEPORT_OK_NOTE,
    ],
  },
  38: {
    name: 'Tristram',
    bosses: ['Griswold'],
    quests: [{ quest: 'The Search for Cain', how: 'Free Deckard Cain from his cage', source: 'owner' }],
    entry: 'Red portal at the Cairn Stones in Stony Field',
  },
  39: {
    name: 'The Secret Cow Level',
    special: true,
    bosses: ['The Cow King'],
    notes: [
      { text: 'Special area: the best experience and drops after you beat the difficulty', source: 'official' },
      { text: 'Has a waypoint in ESR', source: 'tables' },
    ],
    entry: 'Cube a Club and a Tome of Town Portal in the Rogue Encampment: the Cow Portal opens',
  },

  // --- Act II --------------------------------------------------------------------------------------------------------
  40: {
    name: 'Lut Gholein',
    officialName: 'Lut Gohlein',
    notes: [{ text: "The official page's caption here: The Sewer South Entrance", source: 'official' }],
  },
  44: {
    name: 'Lost Farm (Endgame Zone)',
    officialName: 'Lost Farm (formerly Lost City)',
    notes: [
      { text: 'Special area. Location: Act 2 Lost City', source: 'official' },
      { text: 'You can get the Viper Amulet without visiting Lost Farm', source: 'official' },
    ],
  },
  49: {
    name: 'Sewers Level 2',
    bosses: ['Radament'],
    quests: [{ quest: "Radament's Lair", how: 'Radament drops the Book of Skill', itemCode: 'ass', source: 'owner' }],
  },
  51: {
    name: 'Underground Maze',
    notes: [{ text: 'Links Lut Gholein, Maggot Tunnels, Maggot Passage and Temple Passage Level 1', source: 'tables' }],
  },
  54: {
    name: 'Palace Cellar Level 3',
    quests: [{ quest: 'Arcane Sanctuary', how: 'Take the portal to the Arcane Sanctuary', source: 'owner' }],
  },
  55: {
    name: "Dark Magician's Chamber Level 1 (Endgame Zone)",
    officialName: "Dark Magician's Chamber",
    notes: [{ text: 'Special area. Location: Act 2 Rocky Waste', source: 'official' }],
  },
  60: {
    name: 'Halls of the Dead Level 2',
    officialName: 'Hall of the Dead Level 2',
    bosses: ['Bloodwitch the Wild'],
    notes: [TELEPORT_OK_NOTE],
  },
  61: {
    name: 'Claw Viper Temple Level 2',
    officialName: 'Unholy Altar',
    bosses: ['Fangskin'],
    quests: [
      {
        quest: 'The Horadric Staff',
        how: 'Take the Top of the Horadric Staff (official page: Viper Amulet) from the altar',
        itemCode: 'vip',
        source: 'official',
      },
      { quest: 'The Tainted Sun', how: 'Smash the altar to bring the sun back', source: 'owner' },
    ],
    notes: [{ text: 'Entered from Temple Passage Level 2, not from Claw Viper Temple Level 1', source: 'tables' }],
  },
  64: {
    name: 'Maggot Lair',
    bosses: ['Coldworm the Burrower'],
    quests: [
      {
        quest: 'The Horadric Staff',
        how: 'Take the Shaft of the Horadric Staff (official page: Staff of Kings) from the chest',
        itemCode: 'msf',
        source: 'official',
      },
    ],
  },
  65: {
    name: "Andariel's Dressing Room (Endgame Zone)",
    notes: [{ text: 'Special area. Location: Act 2 Lost City (now Lost Farm)', source: 'official' }],
  },
  66: {
    name: "Tal Rasha's Tomb",
    quests: [
      {
        quest: 'The Seven Tombs',
        how: 'Only one of the seven tombs is the true one: place the Horadric Staff in its Horadric Orifice',
        itemCode: 'hst',
        source: 'owner',
      },
    ],
  },
  73: {
    name: "Tal Rasha's Chamber",
    bosses: ['Duriel'],
    quests: [{ quest: 'The Seven Tombs', how: 'Kill Duriel', source: 'owner' }],
    entry: 'Portal from the Horadric Orifice in the true Tal Rasha’s Tomb',
  },
  74: {
    name: 'Arcane Sanctuary',
    bosses: ['The Summoner'],
    quests: [{ quest: 'The Summoner', how: "Kill the Summoner and read Horazon's Journal", source: 'owner' }],
    entry: 'Portal in Palace Cellar Level 3',
  },

  // --- Act III -------------------------------------------------------------------------------------------------------
  77: {
    name: 'Marsh of Pain (Endgame Zone)',
    officialName: 'Marsh of Pain (formerly Great Marsh)',
    notes: [{ text: 'Special area. Location: Act 3 Great Marsh', source: 'official' }],
  },
  78: {
    name: 'Flayer Jungle',
    officialName: 'Flayer Jungle (Gidbinn Village)',
    quests: [{ quest: 'Blade of the Old Religion', how: 'Take the Gidbinn from the altar', itemCode: 'g33', source: 'official' }],
    notes: [
      {
        text: "The tunnel from here into Sewers Level 1 (new in ESR) is one way: you can't come back to the Flayer Jungle through it",
        source: 'official',
        warning: true,
        verify: true,
      },
    ],
  },
  79: {
    name: 'Lower Kurast',
    notes: [{ text: 'Not on the official page, which goes from Flayer Jungle through Sewers Level 1 into Kurast', source: 'official' }],
  },
  83: {
    name: 'Travincal',
    bosses: ['High Council'],
    quests: [
      { quest: "Khalim's Will", how: "Kill the High Council: one of them drops Khalim's Flail", itemCode: 'qf1', source: 'owner' },
      {
        quest: "Khalim's Will",
        how: "Cube the Flail with Khalim's Eye, Brain and Heart into Khalim's Will and smash the Compelling Orb",
        itemCode: 'qf2',
        source: 'owner',
      },
    ],
  },
  85: {
    name: 'Spider Cavern',
    quests: [{ quest: "Khalim's Will", how: "Khalim's Eye is in a chest", itemCode: 'qey', source: 'owner' }],
  },
  86: {
    name: 'Bookstore Sarina Level 1 (Endgame Zone)',
    officialName: 'Bookstore Sarina (formerly Ruined Temple)',
    notes: [{ text: 'Special area. Location: Act 3 Kurast Bazaar', source: 'official' }],
  },
  87: {
    name: "Harpie's Nest Level 1 (Endgame Zone)",
    officialName: "Harpie's Nest",
    notes: [{ text: 'Special area. Location: Act 3 Kurast Causeway', source: 'official' }],
  },
  91: {
    name: 'Flayer Dungeon Level 2',
    quests: [{ quest: "Khalim's Will", how: "Khalim's Brain is in a chest", itemCode: 'qbr', source: 'official' }],
  },
  92: {
    name: 'Sewers Level 1',
    officialName: 'The Sewer Level 1',
    notes: [
      {
        text: 'Only the tunnel from the Flayer Jungle is one way: if you came in from Kurast (Kurast Bazaar, Upper Kurast), you can go back the way you came',
        source: 'owner',
      },
    ],
  },
  93: {
    name: 'Sewers Level 2',
    officialName: 'The Sewer Level 2',
    quests: [{ quest: "Khalim's Will", how: "Khalim's Heart is in a chest", itemCode: 'qhr', source: 'official' }],
  },
  94: {
    name: 'Bookstore Sarina Level 2 (Endgame Zone)',
    quests: [{ quest: "Lam Esen's Tome", how: 'The tome is on a bookshelf', itemCode: 'bbb', source: 'official' }],
    notes: [{ text: 'You can come back for the book after you beat Baal', source: 'official' }],
  },
  102: {
    name: 'Durance of Hate Level 3',
    bosses: ['Mephisto'],
    quests: [{ quest: 'The Guardian', how: "Kill Mephisto: he drops Mephisto's Soulstone", itemCode: 'mss', source: 'owner' }],
    notes: [TELEPORT_OK_NOTE],
  },

  // --- Act IV --------------------------------------------------------------------------------------------------------
  105: {
    name: 'Plains of Despair',
    bosses: ['Izual'],
    quests: [{ quest: 'The Fallen Angel', how: 'Kill Izual', source: 'owner' }],
  },
  107: {
    name: 'River of Flame',
    bosses: ['Hephasto the Armorer'],
    quests: [
      {
        quest: "Hell's Forge",
        how: "Hephasto drops the Hell Forge Hammer: smash Mephisto's Soulstone on the Hellforge",
        itemCode: 'hfh',
        source: 'owner',
      },
    ],
  },
  108: {
    name: 'The Chaos Sanctuary',
    officialName: 'Chaos Sanctuary',
    bosses: ['Diablo'],
    quests: [{ quest: "Terror's End", how: 'Open the five seals, then kill Diablo', source: 'owner' }],
    notes: [TELEPORT_OK_NOTE],
  },

  // --- Act V ---------------------------------------------------------------------------------------------------------
  110: {
    name: 'Bloody Foothills',
    bosses: ['Shenk the Overseer'],
    quests: [{ quest: 'Siege on Harrogath', how: 'Kill Shenk the Overseer', source: 'owner' }],
    notes: [{ text: 'No waypoint here (the official page shows one)', source: 'owner' }],
  },
  111: {
    name: 'Frigid Highlands',
    officialName: 'Frigid Highland',
    quests: [{ quest: 'Rescue on Mount Arreat', how: 'Free the captured barbarians', source: 'owner' }],
  },
  114: {
    name: 'Frozen River',
    quests: [{ quest: 'Prison of Ice', how: "Free Anya with Malah's Potion", itemCode: 'ice', source: 'official' }],
    notes: [{ text: 'A dead end: the way on is the red portal in Harrogath after you rescue Anya', source: 'tables' }],
  },
  113: {
    name: 'Nowhere',
    special: true,
    notes: [{ text: 'Special area. Location: Act 5 Dead End', source: 'official' }],
  },
  115: {
    name: 'Naraku Level 1 (Endgame Zone)',
    officialName: 'Naraku',
    bosses: ['Treant King'],
    notes: [
      { text: 'Special area. Location: Act 5 Ancients’ Way', source: 'official' },
      { text: 'Naraku and below are extremely difficult areas for super rich experts', source: 'official', warning: true },
    ],
  },
  116: {
    name: "Bill Roper's Memorial Ball Park",
    officialName: 'Bill Roper Memorial Ballpark',
    special: true,
    bosses: ['Reporb'],
    notes: [{ text: 'Special area. Location: Act 5 Naraku Level 2', source: 'official' }],
  },
  119: {
    name: "GFraizer's Dome",
    officialName: 'GFraizer Dome',
    special: true,
    bosses: ['Reziarfg'],
    notes: [{ text: 'Entrances in Naraku Level 1 and Naraku Level 2 (the game files link Level 1 only)', source: 'owner' }],
  },
  120: {
    name: 'Arreat Summit',
    bosses: ['Ancient Barbarians'],
    quests: [{ quest: 'Rite of Passage', how: 'Defeat the three Ancients', source: 'official' }],
  },
  121: {
    name: 'Dimensional Gate',
    bosses: ['Pindleskin'],
    notes: [
      {
        text: 'The red portal in Harrogath stays open and works both ways, also after you take this waypoint (the official page says it disappears)',
        source: 'owner',
      },
    ],
    entry: 'Red portal in Harrogath after you rescue Anya',
  },
  122: {
    name: 'The Dead End',
    officialName: 'Dead End',
    special: true,
    notes: [
      { text: 'Special area. Location: Act 5 Naraku Level 3', source: 'official' },
      { text: 'The downstairs are hidden, but there always exists a landmark', source: 'official', warning: true },
      { text: 'Hint: Sp***ling C***t', source: 'official', spoiler: true },
    ],
  },
  123: {
    name: "Nihlathak's Domain Level 1",
    special: true,
    notes: [{ text: 'Special area. Location: Act 5 Nowhere', source: 'official' }],
  },
  124: {
    name: "Nihlathak's Domain Level 2",
    special: true,
    bosses: ['Nihlathak'],
    notes: [{ text: "You don't need to kill Nihlathak to clear a difficulty", source: 'official' }],
  },
  125: {
    name: 'Moonshine Distillery (Endgame Zone)',
    notes: [{ text: 'Special area. Location: Act 5 Frigid Highland', source: 'official' }],
    entry: 'Red portal in the Frigid Highlands',
  },
  126: {
    name: 'Fake Note Factory (Endgame Zone)',
    notes: [{ text: 'Special area. Location: Act 5 Arreat Plateau', source: 'official' }],
    entry: 'Red portal on the Arreat Plateau',
  },
  127: {
    name: 'Poppy Farm (Endgame Zone)',
    notes: [{ text: 'Special area. Location: Act 5 Frozen Tundra', source: 'official' }],
    entry: 'Red portal in the Frozen Tundra',
  },
  129: {
    name: 'Worldstone Keep Level 2',
    notes: [{ text: 'Leads straight to the Throne of Destruction: ESR removed Worldstone Keep Level 3', source: 'official' }],
  },
  130: { name: 'Naraku Level 3', special: true },
  132: {
    name: 'The Worldstone Chamber',
    officialName: 'Worldstone Chamber',
    bosses: ['Baal'],
    quests: [{ quest: 'Eve of Destruction', how: 'Kill Baal', source: 'owner' }],
  },
  137: {
    name: 'Colossal Summit',
    special: true,
    notes: [
      {
        text: 'Added to Diablo II: Resurrected by Reign of the Warlock: five Colossal Ancient Statues transmuted in the Horadric Cube in Act V, Hell, open a red portal here (Madawc, Talic and Korlic)',
        source: 'vanilla',
      },
      {
        text: 'ESR has the Eternal Ancients (Talic, Madawc and Korlic the Eternal; the Kill Ledger counts them), but neither the game files nor the official docs say how to get here: there is no statue item and no cube recipe for it',
        source: 'tables',
        verify: true,
      },
    ],
    entryUnknown: true,
  },
  138: {
    name: "Nosliwyaj's Reign",
    special: true,
    bosses: ['Nosliwyaj'],
    notes: [{ text: 'Boss name from the string table', source: 'tables', verify: true }],
  },
  214: { name: 'Naraku Level 2', special: true },

  // --- Uber levels (drawn on the portals tab) ------------------------------------------------------------------------
  133: {
    name: "Matron's Den",
    home: 'portals',
    special: true,
    bosses: ['Lilith'],
    quests: [{ quest: 'Pandemonium', how: "Lilith drops Diablo's Horn", itemCode: 'dhn', source: 'owner' }],
    entry: PANDEMONIUM,
  },
  134: {
    name: 'Forgotten Sands',
    home: 'portals',
    special: true,
    bosses: ['Uber Duriel'],
    quests: [{ quest: 'Pandemonium', how: "Uber Duriel drops Baal's Eye", itemCode: 'bey', source: 'owner' }],
    entry: PANDEMONIUM,
  },
  135: {
    name: 'Furnace of Pain',
    home: 'portals',
    special: true,
    bosses: ['Uber Izual'],
    quests: [{ quest: 'Pandemonium', how: "Uber Izual drops Mephisto's Brain", itemCode: 'mbr', source: 'owner' }],
    entry: PANDEMONIUM,
  },
  136: {
    name: 'Tristram',
    officialName: 'Uber Tristram',
    home: 'portals',
    special: true,
    bosses: ['Uber Mephisto', 'Uber Diablo', 'Uber Baal'],
    entry: "Cube Diablo's Horn, Baal's Eye and Mephisto's Brain in Harrogath: the Pandemonium Finale Portal opens",
  },

  // --- Endgame maps --------------------------------------------------------------------------------------------------
  164: {
    name: 'Twisted Maze',
    notes: [
      { text: "The levels.txt row reuses Durance of Hate Level 2's waypoint slot: no waypoint expected", source: 'tables', verify: true },
    ],
  },
  213: { name: 'The Hidden Vault', notes: [{ text: 'The unique map (Goblin Realm)', source: 'tables' }] },
};
