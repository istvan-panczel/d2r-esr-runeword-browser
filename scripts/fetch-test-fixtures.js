#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '..', 'test-fixtures');

const ESR_BASE_URL = 'https://celestialrayone.github.io/Eastern_Sun_Resurrected/docs';

const FILES = [
  { url: `${ESR_BASE_URL}/gems.htm`, name: 'gems.htm' },
  { url: `${ESR_BASE_URL}/runewords.htm`, name: 'runewords.htm' },
  { url: `${ESR_BASE_URL}/changelogs.html`, name: 'changelogs.html' },
];

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

  await mkdir(FIXTURES_DIR, { recursive: true });

  const results = await Promise.allSettled(FILES.map(fetchFile));

  const failures = results.filter((r) => r.status === 'rejected');
  if (failures.length > 0) {
    console.error('\nErrors:');
    failures.forEach((f) => console.error(`  ✗ ${f.reason.message}`));
    process.exit(1);
  }

  console.log(`\nDone! Files saved to test-fixtures/`);
}

main();
