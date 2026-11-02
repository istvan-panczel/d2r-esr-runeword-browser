import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLootFilter } from '../engine/parse';
import { TEMPLATE_CREDIT, TEMPLATE_FILE, TEMPLATE_VERSION } from './template';

describe('bundled template', () => {
  it('TEMPLATE_VERSION is the version of the bundled file', () => {
    const text = readFileSync(resolve(process.cwd(), 'public/loot-filters', TEMPLATE_FILE), 'utf8');
    expect(parseLootFilter(text).filter.version).toBe(TEMPLATE_VERSION);
  });

  it('the credit names that version', () => {
    expect(TEMPLATE_CREDIT).toContain(`v${TEMPLATE_VERSION}`);
  });
});
