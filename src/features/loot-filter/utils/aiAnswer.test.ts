import { describe, expect, it } from 'vitest';
import { codeBlocks, extractFilterFromAnswer, type AiAnswerResult } from './aiAnswer';

const FILTER =
  '{\n  "formatVersion": 1,\n  "rules": [{ "comment": "High runes", "itemCodes": ["r83"], "labelBorder": { "color": [255, 0, 0], "width": 2 } }]\n}';
const OTHER = '{ "formatVersion": 1, "title": "Second", "rules": [] }';

function success(result: AiAnswerResult) {
  if (!result.ok) throw new Error(`expected success, got ${result.kind}: ${result.message}`);
  return result;
}

function failure(result: AiAnswerResult) {
  if (result.ok) throw new Error('expected a failure');
  return result;
}

describe('codeBlocks', () => {
  it('finds fenced blocks with their info string, backtick and tilde fences, and an unclosed last block', () => {
    const text = 'a\n```json\n{ }\n```\ntext\n~~~\nx\n~~~\n````jsonc title\ny\n````\n```\ncut';
    expect(codeBlocks(text)).toEqual([
      { info: 'json', content: '{ }', closed: true },
      { info: '', content: 'x', closed: true },
      { info: 'jsonc', content: 'y', closed: true },
      { info: '', content: 'cut', closed: false },
    ]);
  });

  it('does not close a fence on a shorter one or on a line with text', () => {
    expect(codeBlocks('````\n```\n``` not a fence\n````')).toEqual([{ info: '', content: '```\n``` not a fence', closed: true }]);
  });
});

describe('extractFilterFromAnswer', () => {
  it('reads the json block out of a reply with prose around it', () => {
    const result = success(extractFilterFromAnswer(`Here is your filter:\n\n\`\`\`json\n${FILTER}\n\`\`\`\n\nImport it in the app: …`));
    expect(result.text).toBe(`${FILTER}\n`);
    expect(result.filter.rules).toHaveLength(1);
    expect(result.blocks).toBe(1);
    expect(result.diagnostics).toEqual([]);
  });

  it('reads the filter when the JSON sits before the fence and only the closing sentence is inside it (seen from ChatGPT)', () => {
    const answer = `Here is your filter:\n\n${FILTER}\n\n\`\`\`json\nImport it in the app: click Import AI answer.\n\`\`\``;
    const result = success(extractFilterFromAnswer(answer));
    expect(result.filter.rules).toHaveLength(1);
  });

  it('prefers the whole file over a later snippet that has only "rules"', () => {
    const answer = `Here is the filter:\n\n\`\`\`json\n${FILTER}\n\`\`\`\n\nTo add a level later, add this:\n\n\`\`\`json\n{ "rules": [] }\n\`\`\``;
    const result = success(extractFilterFromAnswer(answer));
    expect(result.filter.rules).toHaveLength(1);
  });

  it('still reads a lone snippet with only "rules"', () => {
    const result = success(extractFilterFromAnswer('```json\n{ "rules": [] }\n```'));
    expect(result.filter.rules).toHaveLength(0);
  });

  it('takes the last complete filter when the reply has several blocks', () => {
    const reply = `Old:\n\`\`\`json\n${FILTER}\n\`\`\`\nNew:\n\`\`\`json\n${OTHER}\n\`\`\`\nOne rule:\n\`\`\`json\n{ "itemCodes": ["r51"], "hide": true }\n\`\`\``;
    const result = success(extractFilterFromAnswer(reply));
    expect(result.filter.title).toBe('Second');
    expect(result.blocks).toBe(3);
  });

  it('skips blocks of other languages', () => {
    const result = success(extractFilterFromAnswer(`\`\`\`python\nprint("{")\n\`\`\`\n\`\`\`json\n${FILTER}\n\`\`\``));
    expect(result.filter.rules).toHaveLength(1);
  });

  it('reads a reply without fences, from the first brace line to the closing brace line, keeping the // lines above', () => {
    const reply = `Sure! Below is the file.\n// My filter\n${FILTER}\nUse {name} in texts to show the item name.`;
    const result = success(extractFilterFromAnswer(reply));
    expect(result.text).toBe(`// My filter\n${FILTER}\n`);
    expect(result.filter.leadingComments).toEqual(['// My filter']);
  });

  it('reads a bare JSON paste and accepts what the game accepts (comments, a trailing comma)', () => {
    const result = success(extractFilterFromAnswer('{ "formatVersion": 1, /* note */ "rules": [], }'));
    expect(result.notes.map((note) => note.message)).toEqual([
      expect.stringContaining('Trailing commas were accepted'),
      expect.stringContaining('Block comments'),
      expect.stringContaining('is dropped on the first edit'),
    ]);
  });

  it('keeps the parser diagnostics of a filter with mistakes (it imports, the editor lists them)', () => {
    const result = success(extractFilterFromAnswer('```json\n{ "rules": [{ "highlight": true }] }\n```'));
    expect(result.diagnostics.map((diagnostic) => diagnostic.message)).toEqual([
      'Missing "formatVersion" (it is always 1)',
      'Unknown key "highlight"; it is kept as is',
    ]);
  });

  it('joins an answer continued in a second block', () => {
    const reply = `Part 1:\n\`\`\`json\n{ "formatVersion": 1,\n  "rules": [\n\`\`\`\nPart 2:\n\`\`\`json\n  { "itemCodes": ["r83"], "hide": true }\n] }\n\`\`\``;
    const result = success(extractFilterFromAnswer(reply));
    expect(result.filter.rules).toHaveLength(1);
  });

  it('reports a cut-off block as a syntax problem with its position', () => {
    const result = failure(extractFilterFromAnswer('```json\n{ "formatVersion": 1,\n  "rules": [\n    { "itemCodes": ["r8'));
    expect(result.kind).toBe('syntax');
    expect(result.message).toMatch(/line \d+, column \d+/);
  });

  it('says when the JSON is not a whole filter', () => {
    expect(failure(extractFilterFromAnswer('```json\n[{ "itemCodes": ["r51"] }]\n```'))).toMatchObject({
      kind: 'notFilter',
      message: expect.stringContaining('is a list') as unknown,
    });
    expect(failure(extractFilterFromAnswer('```json\n{ "itemCodes": ["r51"], "hide": true }\n```')).kind).toBe('notFilter');
  });

  it('says when there is no JSON or nothing at all', () => {
    expect(failure(extractFilterFromAnswer('I need to know your class first. Which one do you play?')).kind).toBe('none');
    expect(failure(extractFilterFromAnswer('  \n ')).kind).toBe('empty');
  });

  it('reads Windows line ends', () => {
    expect(success(extractFilterFromAnswer(`\`\`\`json\r\n${FILTER.replace(/\n/g, '\r\n')}\r\n\`\`\``)).filter.rules).toHaveLength(1);
  });
});
