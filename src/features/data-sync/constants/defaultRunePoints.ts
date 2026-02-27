/**
 * Default rune point values used as fallback when points are missing from parsed HTML.
 * Points double within each tier: 1, 2, 4, 8, 16, 32, 64.
 */

// ESR runes: 7 runes per tier (T1-T6) + 5 runes in T7 = 47 entries
export const DEFAULT_ESR_RUNE_POINTS: Record<string, number> = {
  // T1 WHITE
  'I Rune': 1,
  'U Rune': 2,
  'Shi Rune': 4,
  'Ka Rune': 8,
  'N Rune': 16,
  'Ku Rune': 32,
  'Yo Rune': 64,
  // T2 RED
  'Ki Rune': 1,
  'Ri Rune': 2,
  'Mi Rune': 4,
  'Ya Rune': 8,
  'A Rune': 16,
  'Tsu Rune': 32,
  'Chi Rune': 64,
  // T3 YELLOW
  'Sa Rune': 1,
  'Yu Rune': 2,
  'Ke Rune': 4,
  'E Rune': 8,
  'Ko Rune': 16,
  'Ra Rune': 32,
  'O Rune': 64,
  // T4 ORANGE
  'Ho Rune': 1,
  'Me Rune': 2,
  'Ru Rune': 4,
  'Ta Rune': 8,
  'To Rune': 16,
  'Wa Rune': 32,
  'Ha Rune': 64,
  // T5 GREEN
  'Na Rune': 1,
  'Ni Rune': 2,
  'Se Rune': 4,
  'Fu Rune': 8,
  'Ma Rune': 16,
  'Hi Rune': 32,
  'Mo Rune': 64,
  // T6 GOLD
  'No Rune': 1,
  'Te Rune': 2,
  'Ro Rune': 4,
  'So Rune': 8,
  'Mu Rune': 16,
  'Ne Rune': 32,
  'Re Rune': 64,
  // T7 PURPLE (5 runes only)
  'Su Rune': 1,
  'He Rune': 2,
  'Nu Rune': 4,
  'Wo Rune': 8,
  'Null Rune': 16,
};

// LoD runes: 11 per tier, points double within each tier (1 to 1024)
// Tier boundaries: LOW (El-Amn), MID (Sol-Um), HIGH (Mal-Zod)
export const DEFAULT_LOD_RUNE_POINTS: Record<string, number> = {
  // LOW (El-Amn, order 1-11)
  'El Rune': 1,
  'Eld Rune': 2,
  'Tir Rune': 4,
  'Nef Rune': 8,
  'Eth Rune': 16,
  'Ith Rune': 32,
  'Tal Rune': 64,
  'Ral Rune': 128,
  'Ort Rune': 256,
  'Thul Rune': 512,
  'Amn Rune': 1024,
  // MID (Sol-Um, order 12-22)
  'Sol Rune': 1,
  'Shael Rune': 2,
  'Dol Rune': 4,
  'Hel Rune': 8,
  'Io Rune': 16,
  'Lum Rune': 32,
  'Ko Rune': 64,
  'Fal Rune': 128,
  'Lem Rune': 256,
  'Pul Rune': 512,
  'Um Rune': 1024,
  // HIGH (Mal-Zod, order 23-33)
  'Mal Rune': 1,
  'Ist Rune': 2,
  'Gul Rune': 4,
  'Vex Rune': 8,
  'Ohm Rune': 16,
  'Lo Rune': 32,
  'Sur Rune': 64,
  'Ber Rune': 128,
  'Jah Rune': 256,
  'Cham Rune': 512,
  'Zod Rune': 1024,
};
