import type { LootFilterRow } from '@/core/supabase/types';

/** A saved filter row for tests: public, revision 3, owned by `owner-1`, not based on anything. */
export function lootFilterRow(overrides: Partial<LootFilterRow> = {}): LootFilterRow {
  return {
    id: 'row-1',
    user_id: 'owner-1',
    name: 'Shared',
    description: null,
    content: '{"formatVersion": 1, "title": "Shared", "rules": []}',
    is_private: false,
    title: 'Shared',
    author: null,
    file_version: null,
    rule_count: 0,
    levels: null,
    esr_version: null,
    plugin_version: null,
    esr_version_updated: null,
    plugin_version_updated: null,
    change_note: null,
    based_on_id: null,
    based_on_revision: null,
    based_on_template: null,
    based_on_version: null,
    based_on_label: null,
    revision: 3,
    likes_count: 0,
    download_count: 0,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}
