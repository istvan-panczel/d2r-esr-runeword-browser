// Test rows for the sharing slice and saga tests (not imported by app code).
import type { SharedFilterDetailRow } from './sharingQuery';
import type { SharedFilterDetail, SharedFilterSummary } from './types';

export const VIEWER_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';

/** A uuid-shaped filter id from a short tag (`f(1)` → `00000000-0000-4000-8000-000000000001`). */
export function filterId(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function makeSummary(id: string, overrides: Partial<SharedFilterSummary> = {}): SharedFilterSummary {
  return {
    id,
    user_id: OTHER_USER_ID,
    name: `Filter ${id}`,
    description: null,
    is_private: false,
    title: 'A filter',
    author: 'Someone',
    file_version: '1.0',
    rule_count: 10,
    levels: null,
    esr_version: '3.2.24',
    plugin_version: '1.5.3',
    esr_version_updated: null,
    plugin_version_updated: null,
    change_note: null,
    based_on_id: null,
    based_on_revision: null,
    based_on_template: null,
    based_on_version: null,
    based_on_label: null,
    revision: 1,
    likes_count: 0,
    download_count: 0,
    created_at: '2026-11-02T10:00:00.000Z',
    updated_at: '2026-11-02T10:00:00.000Z',
    profiles: { display_name: 'Hero', discriminator: 4242, avatar_url: null },
    ...overrides,
  };
}

export function makeDetail(id: string, overrides: Partial<SharedFilterDetail> = {}): SharedFilterDetail {
  return { ...makeSummary(id), content: '{ "formatVersion": 1, "rules": [] }', ...overrides };
}

/** A detail row as PostgREST returns it (raw `levels` JSON). */
export function makeDetailRow(id: string, overrides: Partial<SharedFilterDetailRow> = {}): SharedFilterDetailRow {
  return { ...makeDetail(id), ...overrides } as SharedFilterDetailRow;
}
