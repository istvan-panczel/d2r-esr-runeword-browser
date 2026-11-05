import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LootFilterEntry } from '../store/types';
import {
  basedOnColumns,
  basedOnFromRow,
  entryBasedOn,
  inferTemplateBasedOn,
  sharedBasedOn,
  templateBasedOn,
  templateStartInput,
  templateVersionOf,
} from './basedOn';
import { EXAMPLE_TEMPLATE, SULLYS_QOL_TEMPLATE } from './template';

const bundledText = (file: string) => readFileSync(resolve(process.cwd(), 'public/loot-filters', file), 'utf8');
const SULLY_TEXT = bundledText(SULLYS_QOL_TEMPLATE.file);
const EXAMPLE_TEXT = bundledText(EXAMPLE_TEMPLATE.file);

/** A minimal file with Sully's title (old template drafts are his filter). */
const sullyFile = (version: string | null) =>
  `{"formatVersion": 1, "title": "Sully's QoL Filter"${version === null ? '' : `, "version": ${JSON.stringify(version)}`}, "rules": []}`;

const ENTRY: LootFilterEntry = { id: 'a', name: 'A', source: 'template', createdAt: 1, updatedAt: 1, text: sullyFile('0.5.0') };

describe('template basedOn', () => {
  it('defaults to the bundled version of each template', () => {
    expect(templateBasedOn('sullys-qol')).toEqual({
      template: 'sullys-qol',
      version: SULLYS_QOL_TEMPLATE.version,
      label: `Sully's QoL Filter v${SULLYS_QOL_TEMPLATE.version}`,
    });
    expect(templateBasedOn('example')).toEqual({
      template: 'example',
      version: EXAMPLE_TEMPLATE.version,
      label: `Example filter (with explanations) v${EXAMPLE_TEMPLATE.version}`,
    });
    expect(templateBasedOn('example', null)).toEqual({ template: 'example', label: 'Example filter (with explanations)' });
  });

  it('infers the template of an old template draft from the bundled files', () => {
    expect(inferTemplateBasedOn(SULLY_TEXT)).toEqual(templateBasedOn('sullys-qol'));
    expect(inferTemplateBasedOn(EXAMPLE_TEXT)).toEqual(templateBasedOn('example'));
  });

  it("infers Sully's by its title or author, the example by its title, else no template", () => {
    expect(inferTemplateBasedOn(`// c\n${sullyFile('0.6.2')}`)).toEqual(templateBasedOn('sullys-qol', '0.6.2'));
    expect(inferTemplateBasedOn('{"formatVersion": 1, "title": "My edit", "author": "sully", "rules": []}')).toEqual(
      templateBasedOn('sullys-qol', null)
    );
    expect(inferTemplateBasedOn(sullyFile(null))).toEqual({ template: 'sullys-qol', label: "Sully's QoL Filter" });
    const example = '{"formatVersion": 1, "title": " example filter (with explanations) ", "version": "0.9", "rules": []}';
    expect(inferTemplateBasedOn(example)).toEqual(templateBasedOn('example', '0.9'));
    expect(inferTemplateBasedOn('{"formatVersion": 1, "title": "Mine", "author": "Bob", "version": "0.6.2", "rules": []}')).toBeNull();
    expect(inferTemplateBasedOn('{"formatVersion": 1, "rules": []}')).toBeNull();
    expect(inferTemplateBasedOn('{ not json')).toBeNull();
  });

  it('takes the file version only when it looks like a template version', () => {
    const unknown = { template: 'sullys-qol', label: "Sully's QoL Filter" };
    expect(inferTemplateBasedOn(sullyFile('v0.6.3'))).toEqual(templateBasedOn('sullys-qol', '0.6.3'));
    expect(inferTemplateBasedOn(sullyFile(' 1.2 '))).toEqual(templateBasedOn('sullys-qol', '1.2'));
    expect(inferTemplateBasedOn(sullyFile('my edit of Sully, second try'))).toEqual(unknown);
    expect(inferTemplateBasedOn(sullyFile(`0.${'1'.repeat(60)}`))).toEqual(unknown);
    expect(inferTemplateBasedOn(sullyFile('1.2.3.4.5'))).toEqual(unknown);
    expect(templateVersionOf('0.6.11')).toBe('0.6.11');
    expect(templateVersionOf(undefined)).toBeNull();
    expect(templateVersionOf('')).toBeNull();
  });

  it('entryBasedOn prefers the recorded value and infers only for template drafts', () => {
    expect(entryBasedOn(ENTRY)).toEqual(templateBasedOn('sullys-qol', '0.5.0'));
    const recorded = { id: 'src', revision: 2, label: 'X by Y#1' };
    expect(entryBasedOn({ ...ENTRY, basedOn: recorded })).toBe(recorded);
    expect(entryBasedOn({ ...ENTRY, source: 'upload' })).toBeNull();
    expect(entryBasedOn({ ...ENTRY, text: '{"formatVersion": 1, "title": "Mine", "rules": []}' })).toBeNull();
  });

  it('templateStartInput names the draft after the template and records it at its bundled version', () => {
    expect(templateStartInput('example', EXAMPLE_TEXT)).toEqual({
      name: 'Example filter (with explanations)',
      text: EXAMPLE_TEXT,
      source: 'template',
      basedOn: { template: 'example', version: '2.1.0', label: 'Example filter (with explanations) v2.1.0' },
    });
    expect(templateStartInput('sullys-qol', SULLY_TEXT)).toMatchObject({
      name: "Sully's QoL Filter",
      basedOn: templateBasedOn('sullys-qol'),
    });
    expect(() => templateStartInput('example', '<!doctype html><html></html>')).toThrow();
  });
});

describe('row mapping', () => {
  const NONE = { based_on_id: null, based_on_revision: null, based_on_template: null, based_on_version: null, based_on_label: null };

  it('reads the based_on columns', () => {
    expect(basedOnFromRow(NONE)).toBeNull();
    expect(basedOnFromRow({ ...NONE, based_on_id: 'src', based_on_revision: 3, based_on_label: 'X by Y#1' })).toEqual({
      id: 'src',
      revision: 3,
      label: 'X by Y#1',
    });
    // The source was deleted: the label stays.
    expect(basedOnFromRow({ ...NONE, based_on_revision: 3, based_on_label: 'X by Y#1' })).toEqual({ revision: 3, label: 'X by Y#1' });
  });

  it('writes them back', () => {
    expect(basedOnColumns(null)).toEqual(NONE);
    for (const template of [templateBasedOn('sullys-qol'), templateBasedOn('example')]) {
      expect(basedOnFromRow(basedOnColumns(template))).toEqual(template);
    }
  });

  it('keeps the columns within their limits', () => {
    const columns = basedOnColumns({ id: 'src', revision: 2, version: 'x'.repeat(51), label: `${'é'.repeat(150)}${'😀'.repeat(100)}` });
    expect(columns.based_on_version).toBeNull();
    expect(Array.from(columns.based_on_label ?? '')).toHaveLength(200);
    expect(columns.based_on_label?.endsWith('😀')).toBe(true);
    expect(basedOnColumns({ template: 'sullys-qol', version: '0.6.11', label: 'Short' })).toMatchObject({
      based_on_version: '0.6.11',
      based_on_label: 'Short',
    });
  });

  it('labels a shared copy "name by author"', () => {
    expect(sharedBasedOn({ id: 'src', revision: 4, name: 'Mine' }, 'Bob#1234')).toEqual({
      id: 'src',
      revision: 4,
      label: 'Mine by Bob#1234',
    });
  });
});
