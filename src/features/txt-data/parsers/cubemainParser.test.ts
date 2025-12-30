import { describe, it, expect } from 'vitest';
import { parseAncientCouponItems } from './cubemainParser';

describe('cubemainParser', () => {
  describe('parseAncientCouponItems', () => {
    it('should parse coupon items with valid output names', () => {
      const content = `description\toutput\tnuminputs
Coupon\tThe Grandfather\t1
Coupon\tWindforce\t1`;

      const result = parseAncientCouponItems(content);

      expect(result.size).toBe(2);
      expect(result.has('The Grandfather')).toBe(true);
      expect(result.has('Windforce')).toBe(true);
    });

    it('should filter out numeric output codes', () => {
      const content = `description\toutput\tnuminputs
Coupon\t01c\t1
Coupon\tThe Grandfather\t1
Coupon\t2abc\t1`;

      const result = parseAncientCouponItems(content);

      expect(result.size).toBe(1);
      expect(result.has('The Grandfather')).toBe(true);
    });

    it('should only process Coupon descriptions', () => {
      const content = `description\toutput\tnuminputs
Coupon\tThe Grandfather\t1
upgrade armor\tElite Armor\t1
Coupon\tWindforce\t1`;

      const result = parseAncientCouponItems(content);

      expect(result.size).toBe(2);
      expect(result.has('Elite Armor')).toBe(false);
    });

    it('should handle empty content', () => {
      const result = parseAncientCouponItems('');
      expect(result.size).toBe(0);
    });

    it('should handle content with only header', () => {
      const content = `description\toutput\tnuminputs`;
      const result = parseAncientCouponItems(content);
      expect(result.size).toBe(0);
    });

    it('should skip rows with empty output', () => {
      const content = `description\toutput\tnuminputs
Coupon\t\t1
Coupon\tThe Grandfather\t1`;

      const result = parseAncientCouponItems(content);

      expect(result.size).toBe(1);
    });
  });
});
