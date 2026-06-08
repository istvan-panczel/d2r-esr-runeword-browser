import { describe, expect, it } from 'vitest';
import type { BuildWithAuthor } from '../types';
import { EXPORT_APP_NAME, buildExportFilename, buildExportPayload } from './buildExport';

function makeBuild(overrides: Partial<BuildWithAuthor> = {}): BuildWithAuthor {
  return {
    id: '1a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d',
    user_id: 'u1',
    name: 'Hammerdin MF',
    description: null,
    class: 'Paladin',
    build_data: {},
    esr_version: '3.9.07',
    esr_version_updated: null,
    likes_count: 3,
    created_at: '2026-06-08T10:00:00.000Z',
    updated_at: '2026-06-08T10:00:00.000Z',
    profiles: { display_name: 'Hero', discriminator: 4242, avatar_url: null },
    ...overrides,
  };
}

describe('buildExportPayload', () => {
  it('wraps the raw build with a provenance header', () => {
    const build = makeBuild();
    const payload = buildExportPayload(build, 'https://example.test/build/1a2b3c4d', '2026-06-08T12:00:00.000Z');
    expect(payload).toEqual({
      exportedAt: '2026-06-08T12:00:00.000Z',
      app: EXPORT_APP_NAME,
      source: 'https://example.test/build/1a2b3c4d',
      build,
    });
    // The build is included verbatim (faithful raw dump).
    expect(payload.build).toBe(build);
  });
});

describe('buildExportFilename', () => {
  it('slugifies the name and appends a short id', () => {
    expect(buildExportFilename(makeBuild())).toBe('hammerdin-mf-1a2b3c4d.json');
  });

  it('collapses punctuation/whitespace and trims dashes', () => {
    expect(buildExportFilename(makeBuild({ name: '  Lightning / Fury!! ' }))).toBe('lightning-fury-1a2b3c4d.json');
  });

  it('falls back to "build" when the name has no slug-able characters', () => {
    expect(buildExportFilename(makeBuild({ name: '✨🔥✨' }))).toBe('build-1a2b3c4d.json');
  });
});
