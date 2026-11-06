/** spine.yml, _glossary.yml and _sources.yml → validated bundle parts. */
import type { GlossaryEntry, GuideQuestion, GuideSpine, GuideSpineStep, SourceRef } from '../engine/schema.ts';
import { FieldReader, isObject, parseYaml } from './fields.ts';

export function parseSpine(text: string, where: string, errors: string[]): GuideSpine {
  const data = parseYaml(text, where, errors);
  if (!isObject(data)) {
    if (data !== undefined) errors.push(`${where}: expected a mapping with steps and questions`);
    return { steps: [], questions: [] };
  }
  const root = new FieldReader(data, where, errors);
  root.onlyKeys(['steps', 'questions']);
  const steps = root.list('steps').flatMap((item, i): GuideSpineStep[] => {
    if (!isObject(item)) {
      root.error(`steps[${String(i)}]`, 'must be a mapping with title, summary and notes');
      return [];
    }
    const step = new FieldReader(item, `${where}: steps[${String(i)}]`, errors);
    step.onlyKeys(['title', 'summary', 'notes']);
    return [
      {
        title: step.string('title', { required: true }),
        summary: step.string('summary', { required: true }),
        notes: step.strings('notes'),
      },
    ];
  });
  const questions = root.list('questions').flatMap((item, i): GuideQuestion[] => {
    if (!isObject(item)) {
      root.error(`questions[${String(i)}]`, 'must be a mapping with label and note');
      return [];
    }
    const question = new FieldReader(item, `${where}: questions[${String(i)}]`, errors);
    question.onlyKeys(['label', 'note']);
    return [{ label: question.string('label', { required: true }), note: question.string('note', { required: true }) }];
  });
  return { steps, questions };
}

function parseList(text: string, where: string, errors: string[]): unknown[] {
  const data = parseYaml(text, where, errors);
  if (data === undefined || data === null) return [];
  if (!Array.isArray(data)) {
    errors.push(`${where}: expected a list`);
    return [];
  }
  return data as unknown[];
}

export function parseGlossary(text: string, where: string, errors: string[]): GlossaryEntry[] {
  const entries = parseList(text, where, errors).flatMap((item, i): GlossaryEntry[] => {
    if (!isObject(item)) {
      errors.push(`${where}: [${String(i)}]: must be a mapping with term and definition`);
      return [];
    }
    const entry = new FieldReader(item, `${where}: [${String(i)}]`, errors);
    entry.onlyKeys(['term', 'definition', 'note', 'link']);
    // The link is still a guide link target (`page:/modifiers?kind=…`) here; resolveGlossaryEntries resolves it.
    const link = entry.string('link');
    return [
      {
        term: entry.string('term', { required: true }),
        definition: entry.string('definition', { required: true }),
        note: entry.string('note'),
        ...(link === null ? {} : { link }),
      },
    ];
  });
  const seen = new Set<string>();
  for (const entry of entries) {
    const key = entry.term.toLowerCase();
    if (seen.has(key)) errors.push(`${where}: duplicate term "${entry.term}"`);
    seen.add(key);
  }
  return entries;
}

export function parseSourceRefs(text: string, where: string, errors: string[]): SourceRef[] {
  const refs = parseList(text, where, errors).flatMap((item, i): SourceRef[] => {
    if (!isObject(item)) {
      errors.push(`${where}: [${String(i)}]: must be a mapping with id and title`);
      return [];
    }
    const ref = new FieldReader(item, `${where}: [${String(i)}]`, errors);
    ref.onlyKeys(['id', 'title', 'url', 'license', 'note']);
    const url = ref.string('url');
    if (url !== null && !/^https?:\/\//.test(url)) ref.error('url', `must be an http(s) URL (got "${url}")`);
    return [
      {
        id: ref.string('id', { required: true }),
        title: ref.string('title', { required: true }),
        url,
        license: ref.string('license'),
        note: ref.string('note'),
      },
    ];
  });
  const seen = new Set<string>();
  for (const ref of refs) {
    if (seen.has(ref.id)) errors.push(`${where}: duplicate id "${ref.id}"`);
    seen.add(ref.id);
  }
  return refs;
}
