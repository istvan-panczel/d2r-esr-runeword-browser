import { describe, expect, it } from 'vitest';
import { baseName, displayName, hasEndgameZoneSuffix, memberLabel, wrapLabel } from './text';

describe('names', () => {
  it('strips the Endgame Zone suffix and the level number', () => {
    expect(displayName('Naraku Level 1 (Endgame Zone)')).toBe('Naraku Level 1');
    expect(hasEndgameZoneSuffix('Lost Farm (Endgame Zone)')).toBe(true);
    expect(baseName("Harpie's Nest Level 2 (Endgame Zone)")).toBe("Harpie's Nest");
    expect(baseName('Underground Maze')).toBe('Underground Maze');
  });

  it('labels stack members L<n> only when they share the base name', () => {
    expect(memberLabel('Tower Cellar Level 3', 'Tower Cellar')).toBe('L3');
    expect(memberLabel('Catacombs Level 3', 'Catacombs')).toBe('L3');
    expect(memberLabel('The Altar of Doomed Salvation', 'The Reliquary of False Light')).toBe('');
  });
});

describe('wrapLabel', () => {
  it('wraps greedily at word boundaries', () => {
    expect(wrapLabel('Underground Passage', 17)).toEqual(['Underground', 'Passage']);
    expect(wrapLabel("Bill Roper's Memorial Ball Park", 17)).toEqual(["Bill Roper's", 'Memorial Ball', 'Park']);
    expect(wrapLabel('Cave', 17)).toEqual(['Cave']);
  });
});
