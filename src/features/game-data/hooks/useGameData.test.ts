import { describe, expect, it } from 'vitest';
import { filesFromKey } from './useGameData';

describe('useGameData files key', () => {
  it('splits the joined file list and reads an empty key as no files', () => {
    expect(filesFromKey('skills,skilldetails')).toEqual(['skills', 'skilldetails']);
    expect(filesFromKey('skills')).toEqual(['skills']);
    // useSkillTree / useCraftData pass [] while disabled: no fetch of a file named ""
    expect(filesFromKey('')).toEqual([]);
  });
});
