import { describe, expect, it } from 'vitest';
import { parseCharacter } from './parseCharacter';
import { readProgress, readQuests, QUEST_WORD, RESIST_SCROLL_BIT } from './progress';
import { buildSave, indexOfMarker, testData, withChecksum } from './testCharacter';

/** A synthetic save with the difficulty bytes and some quest words set */
function save(
  difficulty: [number, number, number],
  words: { difficulty: number; word: number; value: number }[] = [],
  progression = 0
): Uint8Array {
  const bytes = buildSave({
    patch: (header, view) => {
      header.set(difficulty, 0x98);
      view.setUint8(0x15, progression);
    },
  });
  const quests = indexOfMarker(bytes, 'Woo!');
  for (const { difficulty: d, word, value } of words) new DataView(bytes.buffer).setUint16(quests + 10 + d * 96 + word * 2, value, true);
  return withChecksum(bytes);
}

describe('readProgress', () => {
  it('takes the difficulty from the byte with bit 7 set and the act from its low bits', () => {
    expect(parseCharacter(save([0x00, 0x00, 0x84]), testData).progress).toEqual({
      difficulty: 2,
      act: 5,
      progression: 0,
      raw: [0, 0, 0x84],
    });
    expect(parseCharacter(save([0x00, 0x81, 0x00], [], 6), testData).progress).toMatchObject({ difficulty: 1, act: 2, progression: 6 });
    expect(parseCharacter(save([0x80, 0x00, 0x00]), testData).progress).toMatchObject({ difficulty: 0, act: 1 });
  });

  it('falls back to Normal when no byte is marked', () => {
    expect(readProgress(new Uint8Array(0x200), 0)).toMatchObject({ difficulty: 0, act: 1 });
  });
});

describe('readQuests', () => {
  it('reads Anya’s scroll (Prison of Ice bit 7) and Eve of Destruction completed per difficulty', () => {
    const character = parseCharacter(
      save(
        [0, 0x80, 0],
        [
          { difficulty: 0, word: QUEST_WORD.prisonOfIce, value: 0x1789 },
          { difficulty: 0, word: QUEST_WORD.eveOfDestruction, value: 0x14dd },
          { difficulty: 1, word: QUEST_WORD.prisonOfIce, value: 0x1001 },
        ]
      ),
      testData
    );
    const quests = character.quests?.difficulties;
    expect(quests?.map((difficulty) => [difficulty.resistScroll, difficulty.completed])).toEqual([
      [true, true],
      [false, false],
      [false, false],
    ]);
    expect(quests?.[0]?.words[QUEST_WORD.prisonOfIce]).toBe(0x1789);
    expect(quests?.[0]?.words).toHaveLength(48);
    expect(RESIST_SCROLL_BIT).toBe(0x80);
  });

  it('gives null for a quest section too short for three difficulties', () => {
    const bytes = new Uint8Array(400);
    bytes.set([0x57, 0x6f, 0x6f, 0x21, 6, 0, 0, 0, 100, 0], 0);
    expect(readQuests(bytes, 0)).toBeNull();
  });
});
