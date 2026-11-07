/**
 * The instruction part of the LLM prompt (PROMPT.md in the zip, the first section of the single .md, what "Copy
 * prompt" copies): role, workflow, rules for the filter, the reference file list, the user's request and the starter.
 */
import type { GameDataSize } from './gameDataTables';

/** A reference file as the prompt lists it. */
export interface ReferenceFileInfo {
  readonly path: string;
  readonly summary: string;
}

/** The filter the user starts from, as the prompt names it. */
export interface StarterInfo {
  /** "Sully's QoL Filter v0.6.13", "My filter", "11 example rules". */
  readonly label: string;
  readonly ruleCount: number;
  /** The rules were picked from the app's example rules: a skeleton (one "Default" level), not a finished filter. */
  readonly fromExamples?: boolean;
}

/** `files`: the reference comes as attached files (zip, Copy prompt); `single`: it follows in the same document. */
export type PromptLayout = 'files' | 'single';

export interface InstructionsInput {
  readonly request: string;
  readonly starter: StarterInfo | null;
  readonly size: GameDataSize;
  readonly files: readonly ReferenceFileInfo[];
  readonly layout: PromptLayout;
  readonly esrVersion?: string;
}

export const REQUEST_OPEN = '<user_request>';
export const REQUEST_CLOSE = '</user_request>';

/** The user's text verbatim, except that it cannot close its own delimiter. */
export function delimitRequest(request: string): string {
  const text = request.trim() === '' ? '(No description yet: ask me what I want from the filter.)' : request.trim();
  return [REQUEST_OPEN, text.split(REQUEST_CLOSE).join('</ user_request>'), REQUEST_CLOSE].join('\n');
}

const SIZE_NOTE: Readonly<Record<GameDataSize, string>> = {
  compact:
    'This is the compact game data: every item type and stat, the bases and misc items that drop, uniques by name, set items, areas and class skills. If you need something it lacks (a base or misc item that does not drop, an item skill id), ask me.',
  full: 'This is the full game data: every item code, type, stat, unique and set row, area and skill.',
};

function referenceSection({ files, layout, size }: InstructionsInput): string[] {
  const intro =
    layout === 'files'
      ? 'The reference comes as attached files. If one of them is missing, ask me to attach it before you write rules:'
      : 'Everything is in this document: after this prompt, each reference file follows under a heading "File: <name>":';
  return ['## Reference', '', intro, '', ...files.map((file) => `- ${file.path}: ${file.summary}`), '', SIZE_NOTE[size]];
}

function starterSection(starter: StarterInfo | null, layout: PromptLayout): string[] {
  if (starter === null) return ['## Starter', '', 'There is no starter: write a new filter from scratch.'];
  const where = layout === 'files' ? 'starter.json' : 'the section "File: starter.json" at the end';
  const tooLong =
    'If the complete file would be too long for one answer, tell me before you start, so we can shorten it or I can paste the parts together.';
  const rules = `${String(starter.ruleCount)} ${starter.ruleCount === 1 ? 'rule' : 'rules'}`;
  if (starter.fromExamples === true)
    return [
      '## Starter',
      '',
      `Start from ${where}: ${rules} I picked from the app's example rules, with the style presets they use. It is a skeleton: one "Default" level and the title "AI filter". Keep these rules and their styles (adapt them where my request says otherwise), add the rules my request needs, and give the filter a fitting title and the levels we agree on. ${tooLong}`,
    ];
  return [
    '## Starter',
    '',
    `Start from the filter in ${where}: "${starter.label}", ${rules}. Change it as my request says and keep everything else (rules, comments, styles, levels) unless I say otherwise. ${tooLong}`,
  ];
}

/** PROMPT.md: the instructions, the reference file list, the request and the starter. */
export function buildInstructions(input: InstructionsInput): string {
  const esr = input.esrVersion === undefined ? '' : ` ${input.esrVersion}`;
  return [
    '# Build an ESR loot filter with me',
    '',
    `You are an expert on Diablo II: Resurrected with the Eastern Sun Resurrected (ESR${esr}) mod and on the JSON filter format of ESR's loot filter plugin. Your goal: write with me a complete loot filter file that does what I describe below, using only the codes, types, stats and ids in the reference.`,
    '',
    '## Language',
    '',
    'Reply in the language of my request below (or the one I switch to later). Keep the JSON keys, codes, names and values exactly as the format needs them. Rule comments may be in my language; texts the game shows (chat lines, name prefixes) are one plain string (English unless I ask otherwise) or, when I ask for translations, one string per language as FORMAT.md shows.',
    '',
    '## How we work',
    '',
    '1. Ask first. Before writing any rule, ask me every question you need, as one short numbered list, and ask again later whenever something is unclear. Typical questions: which class and build; which difficulty and how far into the game (leveling, Hell, maps); which item groups matter (runes, gems, charms, jewels, uniques, sets, runeword bases, maps, coupons, potions, gold); how strict, how many filter levels and what each level hides; sounds and minimap icons (yes or no, for which items); languages for chat and name texts.',
    '2. Plan. Propose a short plan: the filter levels, the rule groups in order (the looks, and narrow hide rules with their exceptions), the styles, sounds and icons. Wait for my OK.',
    '3. Write. Output the complete filter as ONE ```json code block, following "How to write the JSON" below (it also says how to split a filter too long for one message): the whole file every time, never a partial diff or "the rest stays the same", unless I ask for a snippet. Give the filter a short "title" (the app names the draft after it; a starter keeps its title unless I ask for another) and every rule a meaningful "comment": the app shows it as the rule title.',
    '4. After every answer with the complete filter (when it is split, after its last part only), end with this reminder (in my language, the button names as written): "Import it in the app: click Import AI answer and paste my whole answer (the first time on the AI help page, step 3, which creates a draft; after that in the filter editor, which replaces the draft\'s content). If the app lists problems, click Copy problems for the AI and paste the list here."',
    '5. When I paste a problems list: fix exactly those problems, keep everything else as it is, and reply with the complete filter again as one json block. If a problem cannot be fixed (a plugin limit), say so and suggest another way.',
    '',
    '## How to write the JSON',
    '',
    'The app reads the filter out of your answer, so its shape matters:',
    '',
    '- Write the filter in the chat message itself, never in a canvas, document, file, attachment or download link.',
    "- Open the code block with a line that holds only ```json and close it with a line that holds only ```. Inside the block, the file's `//` header comment lines come first (only if the filter has them, as a starter may), then the opening `{`; the last line inside is the closing `}` of the filter.",
    '- Put ALL of the JSON inside that one block, and NOTHING else: no sentences, no reminder, no "..." placeholders. Not a single line of JSON may come before the opening ```json line or after the closing ``` line.',
    '- Your explanation goes before the block; the import reminder (step 4) goes after the closing ```.',
    '- Before you send, check: exactly one ```json line and one closing ``` line in the message, nothing but JSON between them, the braces of the whole file balance, and the reminder is outside the block.',
    '- If the filter is too long for one message, stop after a complete rule, close the block with ```, and say "continued in the next message". When I say continue, send the rest in a new ```json block. I paste all parts into the app together.',
    '',
    '## Rules for the filter',
    '',
    "- Use only item codes, item types, stat names, params and unique or set ids from the reference. If you need one you cannot find, ask me: I can look it up in the app's pickers. Never guess one: the app's validator flags unknown codes.",
    "- Sounds and minimap icons: only the bundled files in assets.md (the app's .zip download ships them); assets.md says what each one is for. The game's own sounds (the sound names of the mod's sounds.txt) work too, but the reference does not list them: use one only when I ask for a game sound, and ask me for its exact name (I can look it up in the app's sound picker). Never guess a sounds.txt name.",
    '- Styles: every `useStyle` must name a style defined under `"styles"` in the same file. For a ready-made look, copy a style preset from examples.md into `"styles"` under its name.',
    '- Mind the known plugin limits in FORMAT.md: Enhanced Damage and Enhanced Defense read 0 on weapons and armour, a stat check without "param" reads only param 0, stats read the tooltip number (+40 Life = 40), per-level stats read at the character level, and rules with item stat checks skip unidentified items.',
    '- A matching hide rule hides the item whatever the rules before it did, so every hide rule is narrow and carries its own exceptions ("< 1" stat checks, except lists, a quality list).',
    '- Strict JSON between the braces: no comments, no trailing commas (notes belong in the rules\' "comment"). `//` comment lines only at the top of the file, before the opening brace.',
    '',
    ...referenceSection(input),
    '',
    '## My request',
    '',
    delimitRequest(input.request),
    '',
    ...starterSection(input.starter, input.layout),
    '',
  ].join('\n');
}
