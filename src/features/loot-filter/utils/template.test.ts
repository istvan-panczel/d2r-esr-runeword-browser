import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import { BUNDLED_TEMPLATES, BUNDLED_TEMPLATE_LIST, bundledTemplate } from './template';
import { checkTemplateText } from './templateSource';

describe('bundled templates', () => {
  it.each(BUNDLED_TEMPLATE_LIST)('$id: name and author are those of the bundled file', (template) => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters', template.file), 'utf8');
    const { filter } = parseLootFilter(text);
    expect(filter.title).toBe(template.name);
    expect(filter.author).toBe(template.author);
  });

  // Holds for any version `npm run loot-filter:template` fetches: the fallback must be a valid stand-in for the live file.
  it.each(BUNDLED_TEMPLATE_LIST)('$id: the bundled file passes checkTemplateText', (template) => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters', template.file), 'utf8');
    expect(checkTemplateText(template.id, text)).toMatchObject({ ok: true });
  });

  it('names no version of a template (the version comes from the text in use)', () => {
    for (const template of BUNDLED_TEMPLATE_LIST) {
      expect(`${template.credit} ${template.summary}`).not.toMatch(/\bv\d/);
    }
  });

  it("loads Sully's live from his repository's main branch; the example has no live file", () => {
    expect(BUNDLED_TEMPLATES['sullys-qol'].liveUrl).toBe(
      'https://raw.githubusercontent.com/Thisisnotsully/QoL-Filter/refs/heads/main/Sullys-QoL-Filter.json'
    );
    expect(BUNDLED_TEMPLATES['sullys-qol'].repoUrl).toBe('https://github.com/Thisisnotsully/QoL-Filter');
    expect(BUNDLED_TEMPLATES.example.liveUrl).toBeUndefined();
  });

  it('keys each template by its id, with its own file and sandbox route, Sully first', () => {
    for (const [id, template] of Object.entries(BUNDLED_TEMPLATES)) expect(template.id).toBe(id);
    expect(BUNDLED_TEMPLATE_LIST.map((template) => template.id)).toEqual(['sullys-qol', 'example']);
    expect(new Set(BUNDLED_TEMPLATE_LIST.map((template) => template.file)).size).toBe(BUNDLED_TEMPLATE_LIST.length);
    expect(BUNDLED_TEMPLATE_LIST.map((template) => template.sandboxPath)).toEqual(['/loot-filters/sully', '/loot-filters/example']);
  });

  it('bundledTemplate finds a template by id only', () => {
    expect(bundledTemplate('sullys-qol')).toBe(BUNDLED_TEMPLATES['sullys-qol']);
    expect(bundledTemplate('example')).toBe(BUNDLED_TEMPLATES.example);
    expect(bundledTemplate('other')).toBeNull();
    expect(bundledTemplate(undefined)).toBeNull();
    expect(bundledTemplate(null)).toBeNull();
  });
});
