/**
 * The hand-written explanations, bundled into the page chunk as text and parsed once. Replacing
 * content/modifiers/modifiers.md (or open-questions.md) with a re-checked file is all an update takes; the content
 * test checks the keys and placeholders (docs/features/MODIFIERS.md "Content").
 */
import modifiersText from '../../../content/modifiers/modifiers.md?raw';
import questionsText from '../../../content/modifiers/open-questions.md?raw';
import { parseModifierContent, parseOpenQuestions } from './utils/modifierContent';

export const MODIFIER_CONTENT = parseModifierContent(modifiersText).blocks;
export const OPEN_QUESTIONS = parseOpenQuestions(questionsText);
