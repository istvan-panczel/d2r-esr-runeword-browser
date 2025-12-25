#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const ASSETS_DIR = join(ROOT_DIR, 'src', 'assets');

// Read version from package.json
const packageJson = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf-8'));
const version = packageJson.version;

// Ensure assets directory exists
mkdirSync(ASSETS_DIR, { recursive: true });

// Write version to assets/version.json
const versionData = {
  version,
  buildTime: new Date().toISOString(),
};

writeFileSync(join(ASSETS_DIR, 'version.json'), JSON.stringify(versionData, null, 2) + '\n');

console.log(`Version ${version} written to src/assets/version.json`);
