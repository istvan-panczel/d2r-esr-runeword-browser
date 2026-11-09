import { describe, expect, it } from 'vitest';
import { isMacUserAgent, isSearchShortcut, searchShortcutLabel, type ShortcutKeyEvent } from './searchShortcut';

const event = (overrides: Partial<ShortcutKeyEvent>): ShortcutKeyEvent => ({
  key: 'k',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
});

describe('isSearchShortcut', () => {
  it('is Ctrl+K off a Mac', () => {
    expect(isSearchShortcut(event({ ctrlKey: true }), false)).toBe(true);
    expect(isSearchShortcut(event({ metaKey: true }), false)).toBe(false);
  });

  it('is Cmd+K on a Mac and leaves Ctrl+K to the text field', () => {
    expect(isSearchShortcut(event({ metaKey: true }), true)).toBe(true);
    expect(isSearchShortcut(event({ ctrlKey: true }), true)).toBe(false);
  });

  it('accepts an upper-case key (Caps Lock)', () => {
    expect(isSearchShortcut(event({ key: 'K', ctrlKey: true }), false)).toBe(true);
  });

  it('needs the modifier and no other one', () => {
    expect(isSearchShortcut(event({}), false)).toBe(false);
    expect(isSearchShortcut(event({ ctrlKey: true, shiftKey: true }), false)).toBe(false);
    expect(isSearchShortcut(event({ ctrlKey: true, altKey: true }), false)).toBe(false);
    expect(isSearchShortcut(event({ ctrlKey: true, metaKey: true }), false)).toBe(false);
    expect(isSearchShortcut(event({ key: 'j', ctrlKey: true }), false)).toBe(false);
  });
});

describe('platform helpers', () => {
  it('recognises Apple user agents', () => {
    expect(isMacUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true);
    expect(isMacUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isMacUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(false);
    expect(isMacUserAgent('Mozilla/5.0 (X11; Linux x86_64)')).toBe(false);
  });

  it('names the shortcut for the platform', () => {
    expect(searchShortcutLabel(true)).toBe('⌘K');
    expect(searchShortcutLabel(false)).toBe('Ctrl+K');
  });
});
