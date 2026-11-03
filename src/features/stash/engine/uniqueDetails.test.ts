import { describe, expect, it } from 'vitest';
import type { HtmUniqueItem } from '@/core/db';
import { findUniqueDetails, indexUniqueDetails } from './uniqueDetails';

const unique = (id: number, name: string, baseItemCode: string) => ({ id, name, baseItemCode }) as unknown as HtmUniqueItem;

describe('findUniqueDetails', () => {
  const index = indexUniqueDetails([unique(1, 'Azurewrath', '7cr'), unique(2, 'Azurewrath', 'crs'), unique(3, "Biggin's Bonnet", 'cap')]);

  it('matches the name like the ?name= links and prefers the item on the coupon base', () => {
    expect(findUniqueDetails(index, 'azurewrath', 'crs')?.id).toBe(2);
    expect(findUniqueDetails(index, 'Azurewrath', '7cr')?.id).toBe(1);
    expect(findUniqueDetails(index, 'Biggin’s Bonnet', null)?.id).toBe(3);
  });

  it('falls back to the first item of the name, and gives nothing for a name the docs do not list', () => {
    expect(findUniqueDetails(index, 'Azurewrath', 'xxx')?.id).toBe(1);
    expect(findUniqueDetails(index, 'Azurewrath_old', 'crs')).toBeUndefined();
  });
});
