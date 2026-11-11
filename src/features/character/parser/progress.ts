/**
 * Where the character is and what it has done: the header's difficulty / act bytes and a small decoder of the `Woo!`
 * quest section. Pure readers over the save bytes; parseCharacter.ts calls them after the section walk has checked the
 * boundaries, so they never throw.
 *
 * - Header 0x98, 0x99, 0x9A: one byte per difficulty (Normal, Nightmare, Hell). The one with bit 7 set is the difficulty
 *   the character is in; its low bits are the act (0-4). VERIFIED on the three 2026-11-11 ground-truth saves (the
 *   in-game screen named the difficulty and the act) and consistent with the progression byte on all 13 saves.
 * - Header 0x15, the progression byte: 5 per completed difficulty, + 1 per act completed in the current one (expansion
 *   titles: 5 Slayer, 10 Champion, 15 Patriarch / Matriarch). Consistent with the quest words below on every save;
 *   INFERRED (D2 format docs), no in-game check beyond that.
 * - `Woo!` section: 4 bytes magic, u32 version (6), u16 size (298), then 48 u16 quest words per difficulty. Word 37 is
 *   Prison of Ice; its bit 7 is set once Anya's Scroll of Resistance was read (INFERRED bit; the +10 resists per
 *   difficulty it gives match the in-game totals of all three ground-truth saves). Word 40 is Eve of Destruction; bit 0
 *   = completed (INFERRED from the standard D2 layout; on every save it agrees with the progression byte and the
 *   difficulty the character is in).
 */

export type DifficultyIndex = 0 | 1 | 2;

export interface CharacterProgress {
  /** The difficulty the character is in (header 0x98–0x9A, the byte with bit 7 set); 0 when none has it */
  difficulty: DifficultyIndex;
  /** Act 1–5 in that difficulty (the byte's low bits + 1) */
  act: number;
  /** Header 0x15: 5 per completed difficulty + acts completed in the current one (INFERRED meaning) */
  progression: number;
  /** The three raw bytes at 0x98 */
  raw: [number, number, number];
}

export interface QuestDifficulty {
  /** The 48 raw quest words of the difficulty */
  words: number[];
  /** Eve of Destruction completed: word 40 bit 0 (INFERRED word layout) */
  completed: boolean;
  /** Anya's Scroll of Resistance read: word 37 bit 7 (INFERRED bit, totals VERIFIED) */
  resistScroll: boolean;
}

export interface CharacterQuests {
  /** Normal, Nightmare, Hell */
  difficulties: [QuestDifficulty, QuestDifficulty, QuestDifficulty];
}

export const DIFFICULTY_OFFSET = 0x98;
const QUEST_HEADER = 10;
const QUEST_WORDS = 48;
export const QUEST_WORD = { prisonOfIce: 37, eveOfDestruction: 40 } as const;
export const RESIST_SCROLL_BIT = 0x80;

export function readProgress(bytes: Uint8Array, progression: number): CharacterProgress {
  const byte = (offset: number) => bytes.at(offset) ?? 0;
  const raw: [number, number, number] = [byte(DIFFICULTY_OFFSET), byte(DIFFICULTY_OFFSET + 1), byte(DIFFICULTY_OFFSET + 2)];
  const found = raw.findIndex((value) => (value & 0x80) !== 0);
  const difficulty: DifficultyIndex = found === 1 || found === 2 ? found : 0;
  return { difficulty, act: ((raw[difficulty] & 0x7f) % 5) + 1, progression, raw };
}

/** The quest words of `Woo!` at `start`; null when the declared size cannot hold three difficulties */
export function readQuests(bytes: Uint8Array, start: number): CharacterQuests | null {
  const byte = (offset: number) => bytes.at(offset) ?? 0;
  const size = byte(start + 8) | (byte(start + 9) << 8);
  if (size < QUEST_HEADER + 3 * QUEST_WORDS * 2 || start + size > bytes.length) return null;
  const difficulty = (d: number): QuestDifficulty => {
    const base = start + QUEST_HEADER + d * QUEST_WORDS * 2;
    const words = Array.from({ length: QUEST_WORDS }, (_, i) => byte(base + 2 * i) | (byte(base + 2 * i + 1) << 8));
    return {
      words,
      completed: ((words.at(QUEST_WORD.eveOfDestruction) ?? 0) & 1) !== 0,
      resistScroll: ((words.at(QUEST_WORD.prisonOfIce) ?? 0) & RESIST_SCROLL_BIT) !== 0,
    };
  };
  return { difficulties: [difficulty(0), difficulty(1), difficulty(2)] };
}
