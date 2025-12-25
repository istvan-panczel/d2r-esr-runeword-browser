#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'test-fixtures');

const gemsHtml = readFileSync(join(FIXTURES_DIR, 'gems.htm'), 'utf-8');
const dom = new JSDOM(gemsHtml);
const doc = dom.window.document;

// Find all header cells (rows with colspan="3" containing item names)
const headerCells = doc.querySelectorAll('td[colspan="3"]');

const runes = [];
const nonRunes = [];

for (const headerCell of headerCells) {
  // Get the name from the bold tag
  const boldTag = headerCell.querySelector('b');
  if (!boldTag) continue;

  const name = boldTag.textContent?.trim();
  if (!name) continue;

  // Get the color - look for font with color that directly contains the name
  // The structure is: <font color="GRAY"><FONT COLOR="PURPLE">Name</FONT></font>
  // We want the innermost font color that's not GRAY
  let color = null;
  const fonts = headerCell.querySelectorAll('font[color]');
  for (const font of fonts) {
    const fontColor = font.getAttribute('color');
    // Skip the GRAY wrapper, we want the actual item color
    if (fontColor && fontColor !== 'GRAY' && font.textContent?.includes(name)) {
      color = fontColor;
      break;
    }
  }

  if (name.endsWith(' Rune')) {
    runes.push({ name, color });
  } else {
    nonRunes.push({ name, color });
  }
}

// Group runes by color
const runesByColor = new Map();
for (const rune of runes) {
  const key = rune.color || 'NO_COLOR';
  if (!runesByColor.has(key)) {
    runesByColor.set(key, []);
  }
  runesByColor.get(key).push(rune.name);
}

// Output runes by color
console.log(`=== RUNES (${runes.length} total) ===`);
console.log('');

// LoD runes (no color)
const lodRunes = runesByColor.get('NO_COLOR') || [];
if (lodRunes.length > 0) {
  console.log(`LoD Runes (no color): ${lodRunes.length}`);
  console.log(lodRunes.join(', '));
  console.log('');
}

// Kanji runes (BLUE)
const kanjiRunes = runesByColor.get('BLUE') || [];
if (kanjiRunes.length > 0) {
  console.log(`Kanji Runes (BLUE): ${kanjiRunes.length}`);
  console.log(kanjiRunes.join(', '));
  console.log('');
}

// ESR runes (other colors - dynamically discovered)
const esrRunes = [];
for (const [color, names] of runesByColor) {
  if (color !== 'NO_COLOR' && color !== 'BLUE') {
    esrRunes.push(...names);
    console.log(`ESR Runes (${color}): ${names.length}`);
    console.log(names.join(', '));
    console.log('');
  }
}

// Output non-runes (gems, crystals, etc.)
console.log(`=== NON-RUNES (${nonRunes.length} total) ===`);
console.log(nonRunes.map(item => item.name).join(', '));
console.log('');

// Summary
console.log('=== SUMMARY ===');
console.log(`LoD Runes: ${lodRunes.length}`);
console.log(`Kanji Runes: ${kanjiRunes.length}`);
console.log(`ESR Runes: ${esrRunes.length}`);
console.log(`Non-Runes (gems/crystals): ${nonRunes.length}`);
console.log(`Total: ${runes.length + nonRunes.length} socketables`);
