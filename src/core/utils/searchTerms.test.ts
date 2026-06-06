import { describe, it, expect } from 'vitest';
import { parseSearchTerms } from './searchTerms';

describe('parseSearchTerms', () => {
  it('should return empty array for empty string', () => {
    expect(parseSearchTerms('')).toEqual([]);
  });

  it('should return empty array for whitespace only', () => {
    expect(parseSearchTerms('   ')).toEqual([]);
  });

  it('should parse single word', () => {
    expect(parseSearchTerms('fire')).toEqual(['fire']);
  });

  it('should parse multiple words as separate terms', () => {
    expect(parseSearchTerms('fire resist')).toEqual(['fire', 'resist']);
  });

  it('should parse quoted phrase as single term', () => {
    expect(parseSearchTerms('"life stolen per hit"')).toEqual(['life stolen per hit']);
  });

  it('should parse mixed quoted and unquoted terms', () => {
    expect(parseSearchTerms('defense "life stolen" resist')).toEqual(['defense', 'life stolen', 'resist']);
  });

  it('should lowercase all terms', () => {
    expect(parseSearchTerms('FIRE Resist')).toEqual(['fire', 'resist']);
  });

  it('should handle multiple quoted phrases', () => {
    expect(parseSearchTerms('"fire damage" "cold resist"')).toEqual(['fire damage', 'cold resist']);
  });

  it('should handle empty quotes as literal match', () => {
    // Empty quotes are treated as a literal "" term by the regex
    expect(parseSearchTerms('fire "" resist')).toEqual(['fire', '""', 'resist']);
  });
});
