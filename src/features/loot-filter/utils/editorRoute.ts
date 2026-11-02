import { compareVersions } from '@/core/utils/versionUtils';
import type { SharedFilterAuthor, SourceRevision } from '../sharing/types';
import type { EditorTarget, LootFilterBasedOn } from '../store/types';
import { TEMPLATE_ID, TEMPLATE_VERSION } from './template';

/** What an editor URL shows: `/loot-filters/draft/:id`, `/loot-filters/:id` (a saved filter) or `/loot-filters/sully`. */
export type EditorRoute =
  { readonly kind: 'draft'; readonly id: string } | { readonly kind: 'saved'; readonly id: string } | { readonly kind: 'sully' };

/** The route of the editor screen from its params (`draftId` on the draft route, `id` on the saved one, none for Sully). */
export function editorRouteOf(params: { readonly draftId?: string; readonly id?: string }): EditorRoute {
  if (params.draftId !== undefined) return { kind: 'draft', id: params.draftId };
  if (params.id !== undefined) return { kind: 'saved', id: params.id };
  return { kind: 'sully' };
}

/** The editor URL of an open target (where the route goes after Save or Copy to my filters). */
export function editorPathOf(target: EditorTarget): string {
  if (target.kind === 'draft') return `/loot-filters/draft/${target.entryId}`;
  return target.savedId === null ? '/loot-filters/sully' : `/loot-filters/${target.savedId}`;
}

/**
 * Whether the open target is what the route shows. On a saved filter's route the kind must also suit the viewer: the
 * owner edits it (`saved`), anyone else (or a signed-out visitor) gets the sandbox. `viewerId` is only read there.
 */
export function targetMatchesRoute(target: EditorTarget | null, route: EditorRoute, viewerId: string | null): boolean {
  if (target === null) return false;
  if (route.kind === 'draft') return target.kind === 'draft' && target.entryId === route.id;
  if (route.kind === 'sully') return target.kind === 'sandbox' && target.savedId === null;
  if (target.kind === 'draft' || target.savedId !== route.id) return false;
  const owner = viewerId !== null && viewerId === target.ownerId;
  return owner === (target.kind === 'saved');
}

/** "Name#1234", as authors are shown everywhere. */
export function authorLabelOf(author: SharedFilterAuthor | null): string {
  return author === null ? 'Unknown author' : `${author.display_name}#${String(author.discriminator)}`;
}

/** What the Update available banner shows for a filter's `basedOn`. */
export type SourceUpdate =
  /** Nothing to show (not based on anything, up to date, or the source is not checked yet). */
  | { readonly kind: 'none' }
  /** A shared source has a newer revision. */
  | { readonly kind: 'shared'; readonly id: string; readonly revision: number; readonly changeNote: string | null; readonly name: string }
  /** The bundled template is newer than the one the filter started from. */
  | { readonly kind: 'template'; readonly fromVersion: string | null }
  /** The shared source was deleted or made private. */
  | { readonly kind: 'gone'; readonly id: string };

/**
 * Compares a filter's `basedOn` with what is known about its source: `revisions` from the source lookup (null: no longer
 * shared, absent: not looked up), the bundled template's version for template-based filters (an unknown version counts
 * as older).
 */
export function sourceUpdateOf(
  basedOn: LootFilterBasedOn | null,
  revisions: Readonly<Record<string, SourceRevision | null>>
): SourceUpdate {
  if (basedOn === null) return { kind: 'none' };
  if (basedOn.id !== undefined) {
    if (!(basedOn.id in revisions)) return { kind: 'none' };
    const source = revisions[basedOn.id];
    if (source === null) return { kind: 'gone', id: basedOn.id };
    if (source.revision <= (basedOn.revision ?? 0)) return { kind: 'none' };
    return { kind: 'shared', id: source.id, revision: source.revision, changeNote: source.change_note, name: source.name };
  }
  if (basedOn.template === TEMPLATE_ID) {
    const version = basedOn.version ?? null;
    return version === null || compareVersions(version, TEMPLATE_VERSION) < 0
      ? { kind: 'template', fromVersion: version }
      : { kind: 'none' };
  }
  return { kind: 'none' };
}
