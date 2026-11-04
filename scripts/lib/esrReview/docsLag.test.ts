import { describe, expect, it } from 'vitest';
import { APP_DOCS_PAGES, docsLagCheck } from './docsLag.ts';

const EXCEL = 'Eastern_Sun_Resurrected.mpq/data/global/excel/';

describe('docsLagCheck', () => {
  it('is ok when no table behind the parsed pages changed', () => {
    expect(docsLagCheck([`${EXCEL}levels.txt`], ['docs/gems.htm']).status).toBe('ok');
  });

  it('is ok when the changed tables have regenerated pages', () => {
    const check = docsLagCheck([`${EXCEL}uniqueitems.txt`], ['docs/unique_armors.htm', 'docs/unique_others.htm']);
    expect(check.status).toBe('ok');
    expect(check.details[0]).toContain('unique_armors.htm, unique_others.htm');
  });

  it('is a finding when tables changed but no parsed page did', () => {
    const check = docsLagCheck([`${EXCEL}runes.txt`, `${EXCEL}uniqueitems.txt`], ['docs/cube recipes.html']);
    expect(check.status).toBe('finding');
    expect(check.summary).toContain('runes.txt, uniqueitems.txt');
    expect(check.summary).toContain('Why it matters');
  });

  it('is info when one table lags while other pages were regenerated', () => {
    const check = docsLagCheck([`${EXCEL}gems.txt`, `${EXCEL}runes.txt`], ['docs/runewords.htm']);
    expect(check.status).toBe('info');
    expect(check.summary).toContain('gems.txt');
  });

  it('ignores locale copies of the pages', () => {
    expect(docsLagCheck([`${EXCEL}gems.txt`], ['docs/deDE/gems.htm']).status).toBe('finding');
  });

  it('lists every generated page the app parses', () => {
    expect(APP_DOCS_PAGES).toContain('runewords.htm');
    expect(APP_DOCS_PAGES).toContain('unique_mythicals.htm');
    expect(APP_DOCS_PAGES).not.toContain('ascendancies.htm');
  });
});
