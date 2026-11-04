import { describe, expect, it } from 'vitest';
import {
  countVersionMentions,
  discordCheck,
  docsSiteCheck,
  linksCheck,
  liveFilterRepositories,
  lootFilterSourcesCheck,
  oldVersionDocsCheck,
  pluginVersionCheck,
  sullyAssetsCheck,
  sullyTemplateCheck,
  templateValidationCheck,
} from './externalChecks.ts';

describe('external checks', () => {
  it('compares the live docs pages and metadata with the clone', () => {
    expect(docsSiteCheck([{ file: 'runewords.htm', result: 'same' }], '3.2.24', '3.2.24').status).toBe('ok');
    expect(docsSiteCheck([{ file: 'runewords.htm', result: 'differs', detail: '1 vs 2 bytes' }], '3.2.24', '3.2.24').status).toBe(
      'finding'
    );
    expect(docsSiteCheck([{ file: 'runewords.htm', result: 'same' }], '3.2.24', '3.2.25').status).toBe('finding');
    expect(docsSiteCheck([{ file: 'gems.htm', result: 'error', detail: 'timeout' }], '3.2.24', '3.2.24').status).toBe('info');
  });

  it('reports failing links and the Discord invite', () => {
    expect(linksCheck([{ url: 'https://a', status: 200, where: 'x' }]).status).toBe('ok');
    expect(linksCheck([{ url: 'https://a', status: null, error: 'timeout', where: 'x' }]).details).toEqual(['timeout https://a (x)']);
    expect(discordCheck('abc', { guild: { name: 'ESR' }, expires_at: null }, null).status).toBe('ok');
    expect(discordCheck('abc', { guild: { name: 'ESR' }, expires_at: '2026-12-01' }, null).status).toBe('finding');
    expect(discordCheck('abc', null, 'HTTP 404').status).toBe('finding');
  });

  it('compares the plugin version with the editor constant', () => {
    expect(pluginVersionCheck('1.5.3', '1.5.3', '1.5.3').status).toBe('ok');
    expect(pluginVersionCheck('1.5.2', '1.5.3', '1.5.3').status).toBe('info');
    expect(pluginVersionCheck('1.5.3', '1.5.4', '1.5.3').status).toBe('finding');
  });

  it('reads the live filter repositories through comments', () => {
    const text =
      '// url https://github.com/<owner>/<repo>\n{ "repositories": [ { "url": "https://github.com/a/b" }, {"url":"https://github.com/c/d"} ] }';
    expect(liveFilterRepositories(text)).toEqual(['https://github.com/a/b', 'https://github.com/c/d']);
    expect(lootFilterSourcesCheck(text, text).status).toBe('ok');
    expect(lootFilterSourcesCheck(text, `${text}\n`).status).toBe('info');
    expect(lootFilterSourcesCheck(text, '{"repositories":[{"url":"https://github.com/a/b"}]}')).toMatchObject({
      status: 'finding',
      details: ['- https://github.com/c/d'],
    });
  });

  it("compares Sully's template and assets with upstream", () => {
    const base = { upstreamText: 'x', upstreamVersion: '0.6.11', bundledText: 'x', bundledVersion: '0.6.11', constantVersion: '0.6.11' };
    expect(sullyTemplateCheck(base).status).toBe('ok');
    expect(sullyTemplateCheck({ ...base, upstreamText: 'y', upstreamVersion: '0.6.12' }).status).toBe('finding');
    expect(sullyTemplateCheck({ ...base, constantVersion: '0.6.10' }).status).toBe('finding');
    expect(sullyTemplateCheck({ ...base, upstreamText: null, error: 'timeout' }).status).toBe('info');

    const upstream = { icons: ['star.sprite'], sounds: ['gong.mp3', 'readme.txt'] };
    expect(sullyAssetsCheck(upstream, { icons: ['star.sprite'], sounds: ['gong.mp3'] }, null).status).toBe('ok');
    expect(sullyAssetsCheck(upstream, { icons: ['star.sprite', 'extra.sprite'], sounds: ['gong.mp3'] }, null)).toMatchObject({
      status: 'ok',
      details: ['only here: icons/extra.sprite'],
    });
    expect(sullyAssetsCheck(upstream, { icons: [], sounds: ['gong.mp3'] }, null).status).toBe('finding');
    expect(sullyAssetsCheck({ icons: null, sounds: null }, upstream, 'HTTP 403').status).toBe('info');
  });

  it('reports only the diagnostics the new data adds', () => {
    const known = { severity: 'warning', path: 'rules/31/itemStatsAnyOf', message: 'tab params' };
    expect(templateValidationCheck([{ file: 'sully.json', before: [known], after: [known] }]).status).toBe('ok');
    const fresh = { severity: 'error', path: 'rules/2/itemCodes/0', message: 'Unknown item code "xyz"' };
    expect(templateValidationCheck([{ file: 'sully.json', before: [known], after: [known, fresh] }])).toMatchObject({
      status: 'finding',
      details: ['+ sully.json error rules/2/itemCodes/0: Unknown item code "xyz"'],
    });
  });

  it('counts mentions of the old version', () => {
    expect(countVersionMentions('ESR 3.2.24, not 3.2.240 or 13.2.24 or 3.2.24.1; (3.2.24).', '3.2.24')).toBe(2);
    expect(oldVersionDocsCheck('3.2.24', false, [{ path: 'docs/a.md', count: 2 }]).status).toBe('ok');
    expect(oldVersionDocsCheck('3.2.24', true, [{ path: 'docs/a.md', count: 2 }])).toMatchObject({
      status: 'info',
      details: ['docs/a.md: 2'],
    });
  });
});
