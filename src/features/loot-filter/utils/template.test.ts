import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import { BUNDLED_TEMPLATES, BUNDLED_TEMPLATE_LIST, bundledTemplate } from './template';

describe('bundled templates', () => {
  it.each(BUNDLED_TEMPLATE_LIST)('$id: name, author and version are those of the bundled file', (template) => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters', template.file), 'utf8');
    const { filter } = parseLootFilter(text);
    expect(filter.version).toBe(template.version);
    expect(filter.title).toBe(template.name);
    expect(filter.author).toBe(template.author);
  });

  it.each(BUNDLED_TEMPLATE_LIST)('$id: the credit names that version', (template) => {
    expect(template.credit).toContain(`v${template.version}`);
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
