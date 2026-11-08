#!/usr/bin/env node

import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'test-fixtures');

const ESR_BASE_URL = 'https://easternsunresurrected.com';

const FILES = [
  { url: `${ESR_BASE_URL}/gems.htm`, name: 'gems.htm' },
  { url: `${ESR_BASE_URL}/gemwords.htm`, name: 'gemwords.htm' },
  { url: `${ESR_BASE_URL}/runewords.htm`, name: 'runewords.htm' },
  { url: `${ESR_BASE_URL}/changelogs.html`, name: 'changelogs.html' },
  { url: `${ESR_BASE_URL}/unique_weapons.htm`, name: 'unique_weapons.htm' },
  { url: `${ESR_BASE_URL}/unique_armors.htm`, name: 'unique_armors.htm' },
  { url: `${ESR_BASE_URL}/unique_others.htm`, name: 'unique_others.htm' },
  { url: `${ESR_BASE_URL}/unique_mythicals.htm`, name: 'unique_mythicals.htm' },
  { url: `${ESR_BASE_URL}/ascendancies.htm`, name: 'ascendancies.htm' },
];

// The pre-ESR 3.3 page layouts the parsers still read (a cached or lagging page): frozen at 3.2.24, never refreshed
const LAYOUT_DIR = 'layout-3.2.24';
const LAYOUT_PAGES = ['gemwords.htm', 'runewords.htm', 'unique_weapons.htm'];
const LAYOUT_FILES = LAYOUT_PAGES.map((page) => ({
  url: `https://raw.githubusercontent.com/CelestialRayOne/Eastern_Sun_Resurrected/3.2.24/docs/${page}`,
  name: `${LAYOUT_DIR}/${page}`,
}));

async function fetchLayoutFile(file) {
  const exists = await access(join(FIXTURES_DIR, file.name)).then(
    () => true,
    () => false
  );
  if (!exists) await fetchFile(file);
}

async function fetchFile(file) {
  console.log(`Fetching ${file.name}...`);
  const response = await fetch(file.url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${file.name}: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  const filePath = join(FIXTURES_DIR, file.name);
  await writeFile(filePath, content, 'utf-8');
  console.log(`  ✓ Saved ${file.name} (${(content.length / 1024).toFixed(1)} KB)`);
}

async function main() {
  console.log('Fetching ESR test fixtures...\n');

  await mkdir(join(FIXTURES_DIR, LAYOUT_DIR), { recursive: true });

  const results = await Promise.allSettled([...FILES.map(fetchFile), ...LAYOUT_FILES.map(fetchLayoutFile)]);

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('\nErrors:');
    failures.forEach((f) => console.error(`  ✗ ${f.reason.message}`));
    process.exit(1);
  }

  console.log(`\nDone! Files saved to test-fixtures/`);
}

main();
