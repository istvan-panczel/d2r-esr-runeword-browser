import { describe, expect, it } from 'vitest';
import { changelogCheckErrors, changelogSkeleton, patchNoteLines, renderChangelogCheck, type ChangelogCheck } from './esrChangelogCheck.ts';
import type { ReleaseDiff } from './releaseDiff.ts';

const PATCH_NOTE = [
  '**Bug Fixes**',
  '',
  '* Fixed a bug where characters started with a \\-1% resistance penalty.  ',
  '* Fixed <the> panel.  ',
  '',
  '**Monsters**',
  '',
  '* **Diablo** \\- Reduced lightning inferno damage by 50%.  ',
  '',
  '**Specializations**',
  '',
  '* **Alchemist**  ',
  '  * **Transmutation** \\- Reduced chance from 50% to 25%.',
  '',
  '**Weapon Swap Improvements**',
  '',
  '* Now the swap is queued.',
].join('\n');

const REVISION = { rev: '3.3', commit: 'd6f5996c2b64', describe: '3.3', date: '2026-11-07' };
const DIFF = {
  from: REVISION,
  to: { ...REVISION, rev: '3.3.02', commit: '4237a0098', describe: '3.3.02', date: '2026-11-08' },
  patchNotes: [{ path: 'patchnotes/3.3.02.md', status: 'A', version: '3.3.02', text: PATCH_NOTE }],
  tables: [
    {
      path: 'x/excel/cubemain.txt',
      status: 'M',
      rowsBefore: 2,
      rowsAfter: 3,
      added: 1,
      removed: 0,
      changed: 4,
      addedKeys: [],
      removedKeys: [],
      addedColumns: [],
      removedColumns: [],
      columnsReordered: false,
      readByApp: true,
    },
  ],
  strings: [
    {
      path: 's.json',
      status: 'M',
      added: 0,
      removed: 0,
      changed: 1,
      addedKeys: [],
      removedKeys: [],
      enUSChanges: [{ key: 'k', before: '50%', after: '25%' }],
    },
  ],
  launcher: [
    { status: 'A', path: 'd2rloader/config/a.toml', added: 1, removed: 0 },
    { status: 'M', path: 'd2rloader/plugins/esr-wiki-overlay/page.htm', added: 1, removed: 1 },
    { status: 'M', path: 'd2rloader/plugins/esr-wiki-overlay/page.htm.meta', added: 1, removed: 1 },
  ],
} as unknown as ReleaseDiff;

function filled(): ChangelogCheck {
  const check = changelogSkeleton(DIFF);
  return {
    ...check,
    intro: 'A patch.',
    notes: check.notes.map((entry) => ({ ...entry, status: 'confirmed', evidence: 'in the files' })),
  };
}

describe('patchNoteLines', () => {
  it('reads one line per change, unescaped, with group labels and sections', () => {
    expect(patchNoteLines(PATCH_NOTE)).toEqual([
      { section: 'Bug Fixes', note: 'Fixed a bug where characters started with a -1% resistance penalty.' },
      { section: 'Bug Fixes', note: 'Fixed <the> panel.' },
      { section: 'Monsters', note: 'Diablo - Reduced lightning inferno damage by 50%.' },
      { section: 'Specializations', note: 'Alchemist: Transmutation - Reduced chance from 50% to 25%.' },
      { section: 'Weapon Swap Improvements', note: 'Now the swap is queued.' },
    ]);
  });
});

describe('changelogCheckErrors', () => {
  it('accepts a complete file', () => {
    expect(changelogCheckErrors(filled(), DIFF)).toEqual([]);
  });

  it('rejects the untouched skeleton', () => {
    const errors = changelogCheckErrors(changelogSkeleton(DIFF), DIFF);
    expect(errors).toContain('intro is empty');
    expect(errors.filter((error) => error.includes('status is pending'))).toHaveLength(5);
  });

  it('names a patch-note line without a verdict', () => {
    const check = filled();
    check.notes.pop();
    expect(changelogCheckErrors(check, DIFF)).toEqual(['no verdict for the patch-note line "Now the swap is queued."']);
  });
});

describe('renderChangelogCheck', () => {
  it('escapes the text and counts the verdicts', () => {
    const check = filled();
    const first = check.notes[0];
    if (first !== undefined) check.notes[0] = { ...first, status: 'partial' };
    const html = renderChangelogCheck(check, DIFF);
    expect(html).toContain('Fixed &lt;the&gt; panel.');
    expect(html).not.toContain('<the>');
    expect(html).toContain('<span class="pill partial">Partly</span> <b>1</b>');
    expect(html).toContain('<span class="pill confirmed">Confirmed</span> <b>4</b>');
  });

  it('counts the wiki pages once and leaves out empty sections', () => {
    const html = renderChangelogCheck(filled(), DIFF);
    expect(html).toContain('1 in-game wiki pages changed');
    expect(html).not.toContain('Not checked');
    expect(html).toContain('cubemain.txt');
  });
});
