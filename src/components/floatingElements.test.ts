import { describe, expect, it } from 'vitest';
import { floatingLift } from './floatingElements';

describe('floatingLift', () => {
  it('lifts the floating elements above the builds form bar and the guide note phone bar', () => {
    expect(floatingLift('/builds/new')).toBe('formBar');
    expect(floatingLift('/builds/abc-123/edit')).toBe('formBar');
    expect(floatingLift('/builds')).toBe('none');
    expect(floatingLift('/guide/terror-zones')).toBe('phoneBar');
    expect(floatingLift('/guide/map')).toBe('none');
    expect(floatingLift('/guide')).toBe('none');
    expect(floatingLift('/runewords')).toBe('none');
    expect(floatingLift('/')).toBe('none');
  });
});
