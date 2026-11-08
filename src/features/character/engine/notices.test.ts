import { describe, expect, it } from 'vitest';
import { corpseNotice, incompleteNotice, saveAgeNotice, sidecarNotice } from './notices';
import type { CharacterSectionName } from '../parser/errors';

const incomplete = (section: CharacterSectionName) => incompleteNotice({ section, message: 'x', unverified: 'bound-demon' });

describe('save age notice', () => {
  it('names the exact version with a matching sidecar', () => {
    const same = saveAgeNotice({ status: 'same-version', source: 'sidecar', savedVersion: '3.3.02', bundleVersion: '3.3.02' });
    expect(same).toMatchObject({ tone: 'info', title: 'Saved with ESR 3.3.02.' });
    const older = saveAgeNotice({ status: 'different-version', source: 'sidecar', savedVersion: '3.2.24', bundleVersion: '3.3.02' });
    expect(older).toMatchObject({ tone: 'warning', title: 'Saved with ESR 3.2.24.' });
    expect(older.text).toContain('3.3.02');
  });

  it('says "may be older" from the date otherwise', () => {
    const notice = saveAgeNotice({
      status: 'saved-before-release',
      source: 'last-saved',
      lastSavedAt: 1,
      bundleDate: '2026-11-08T08:37:34+02:00',
      bundleVersion: '3.3.02',
    });
    expect(notice).toMatchObject({ tone: 'warning', title: 'This save may be older than ESR 3.3.02.' });
    expect(notice.text).toContain('.d2rl');
  });
});

describe('sidecar notice', () => {
  it('only speaks about a sidecar that was not used', () => {
    expect(sidecarNotice({ status: 'none' })).toBeNull();
    expect(sidecarNotice({ status: 'matched', name: 'a.d2rl', esrVersion: '3.3.02' })).toBeNull();
    expect(sidecarNotice({ status: 'rejected', name: 'a.d2rl', reason: 'mismatch' })?.title).toBe('a.d2rl was not used.');
  });
});

describe('incomplete notice', () => {
  it('names what could not be read and what stays empty', () => {
    const notice = incomplete('merc-items');
    expect(notice.title).toBe('Could not read the mercenary gear.');
    expect(notice.text).toContain('mercenary gear, golem item and saved summons stay empty');
  });

  it('does not list the bound demon as staying empty', () => {
    const notice = incomplete('bound-demon');
    expect(notice.title).toBe('Could not read the bound demon.');
    expect(notice.text).toContain('On this page, saved summons stay empty.');
    expect(notice.text).not.toContain('bound demon stay');
  });

  it('copes with a section outside the known list', () => {
    expect(incomplete('header').title).toBe('Could not read part of the save.');
  });
});

describe('corpse notice', () => {
  it('says the gear may be on the corpse, and is silent without one', () => {
    expect(corpseNotice(0)).toBeNull();
    expect(corpseNotice(1)?.text).toContain('may be on the corpse');
  });
});
