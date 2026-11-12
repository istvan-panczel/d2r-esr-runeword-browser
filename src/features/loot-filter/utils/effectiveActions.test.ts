import type { LootFilter } from '../engine/types';
import { countActions, countStyleUsers, effectiveActions, mergeActions, previewLabelText } from './effectiveActions';

const filter: LootFilter = {
  formatVersion: 1,
  leadingComments: [],
  styles: {
    Loud: { sound: 'tink.mp3', labelBackground: [255, 255, 255], labelBorder: { color: [255, 0, 0], width: 1 }, passthrough: { x: 1 } },
  },
  rules: [{ useStyle: 'Loud' }, { useStyle: 'Loud', hide: true }, { useStyle: 'Other' }],
};

describe('effective actions', () => {
  it('puts the rule over the style, per key', () => {
    expect(mergeActions({ sound: 'gong.mp3', namePrefix: 'X' }, { sound: 'tink.mp3', notify: true })).toEqual({
      namePrefix: 'X',
      notify: true,
      sound: 'gong.mp3',
    });
  });

  it('applies the named style and leaves out passthrough', () => {
    const actions = effectiveActions({ useStyle: 'Loud', labelBackground: [0, 0, 0, 200] }, filter);
    expect(actions).toEqual({
      useStyle: 'Loud',
      labelBackground: [0, 0, 0, 200],
      labelBorder: { color: [255, 0, 0], width: 1 },
      sound: 'tink.mp3',
    });
  });

  it('ignores a missing or unset style', () => {
    expect(effectiveActions({ useStyle: 'Nope', hide: true }, filter)).toEqual({ useStyle: 'Nope', hide: true });
    expect(effectiveActions({ notify: false }, filter)).toEqual({ notify: false });
  });

  it('builds the preview label from prefix, name and suffix', () => {
    expect(previewLabelText({})).toBe('Item Name');
    expect(previewLabelText({ namePrefix: 'ÿc1* ', nameSuffix: ' {sockets}' })).toBe('ÿc1* Item Name {sockets}');
    expect(previewLabelText({ replaceName: { deDE: 'Rune', enUS: 'ÿc8{name} Rune' } })).toBe('ÿc8Item Name Rune');
  });

  it('counts actions and style users', () => {
    expect(countActions({ comment: 'x', hide: true, sound: 1 })).toBe(2);
    expect(countStyleUsers(filter, 'Loud')).toBe(2);
    expect(countStyleUsers(filter, 'Nope')).toBe(0);
  });
});
