import type { LootFilterRow } from '@/core/supabase/types';
import type { FilterText } from '../engine/types';

/** Sort orders of the Shared tab, each backed by a keyset cursor ending with `(created_at, id)`. */
export type SharedFilterSort = 'newest' | 'most_liked' | 'most_downloaded';

/** Public author fields embedded with a filter (`profiles!loot_filters_user_id_fkey`). */
export interface SharedFilterAuthor {
  readonly display_name: string;
  readonly discriminator: number;
  readonly avatar_url: string | null;
}

/** One entry of a filter's `filterLevels`, as stored in `loot_filters.levels`; the name may be per language. */
export interface SharedFilterLevel {
  readonly id: number;
  readonly name: FilterText;
}

/** A saved filter as the lists fetch it: every column but `content`, with `levels` checked and the author embedded. */
export type SharedFilterSummary = Readonly<Omit<LootFilterRow, 'content' | 'levels'>> & {
  readonly levels: SharedFilterLevel[] | null;
  readonly profiles: SharedFilterAuthor | null;
};

/** A saved filter with its file, for the editor / sandbox. */
export type SharedFilterDetail = SharedFilterSummary & { readonly content: string };

/** What a copy needs to know about its source to offer "Update available". */
export interface SourceRevision {
  readonly id: string;
  readonly revision: number;
  readonly change_note: string | null;
  readonly name: string;
}
