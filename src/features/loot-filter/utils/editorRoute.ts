import { compareVersions } from '@/core/utils/versionUtils';
import type { SharedFilterAuthor, SharedFilterSummary, SourceRevision } from '../sharing/types';
import type { EditorTarget, LootFilterBasedOn } from '../store/types';
import { BUNDLED_TEMPLATE_LIST, SULLYS_QOL_TEMPLATE, bundledTemplate, type BundledTemplate, type BundledTemplateId } from './template';

/**
 * What an editor URL shows: `/loot-filters/draft/:id`, `/loot-filters/:id` (a saved filter) or a bundled template's
 * sandbox (`/loot-filters/sully`, `/loot-filters/example`).
 */
export type EditorRoute =
  | { readonly kind: 'draft'; readonly id: string }
  | { readonly kind: 'saved'; readonly id: string }
  | { readonly kind: 'template'; readonly template: BundledTemplateId };

/**
 * The route of the editor screen from its params (`draftId` on the draft route, `id` on the saved one) or, on a
 * template sandbox route (no params), from its `pathname` (Sully's when it names no template).
 */
export function editorRouteOf(params: { readonly draftId?: string; readonly id?: string }, pathname = ''): EditorRoute {
  if (params.draftId !== undefined) return { kind: 'draft', id: params.draftId };
  if (params.id !== undefined) return { kind: 'saved', id: params.id };
  const path = pathname.replace(/\/+$/, '');
  const template = BUNDLED_TEMPLATE_LIST.find((candidate) => candidate.sandboxPath === path) ?? SULLYS_QOL_TEMPLATE;
  return { kind: 'template', template: template.id };
}

/** The bundled template a sandbox without a saved filter shows (Sully's when its `basedOn` names none). */
function sandboxTemplateOf(target: Extract<EditorTarget, { kind: 'sandbox' }>): BundledTemplate {
  return bundledTemplate(target.basedOn?.template) ?? SULLYS_QOL_TEMPLATE;
}

/** The editor URL of an open target (where the route goes after Save or Copy to my filters). */
export function editorPathOf(target: EditorTarget): string {
  if (target.kind === 'draft') return `/loot-filters/draft/${target.entryId}`;
  if (target.kind === 'sandbox' && target.savedId === null) return sandboxTemplateOf(target).sandboxPath;
  return `/loot-filters/${target.savedId ?? ''}`;
}

/**
 * Whether the open target is what the route shows. On a saved filter's route the kind must also suit the viewer: the
 * owner edits it (`saved`), anyone else (or a signed-out visitor) gets the sandbox. `viewerId` is only read there.
 */
export function targetMatchesRoute(target: EditorTarget | null, route: EditorRoute, viewerId: string | null): boolean {
  if (target === null) return false;
  if (route.kind === 'draft') return target.kind === 'draft' && target.entryId === route.id;
  if (route.kind === 'template') {
    return target.kind === 'sandbox' && target.savedId === null && sandboxTemplateOf(target).id === route.template;
  }
  if (target.kind === 'draft' || target.savedId !== route.id) return false;
  const owner = viewerId !== null && viewerId === target.ownerId;
  return owner === (target.kind === 'saved');
}

/**
 * Whether two targets are the same open filter (the same draft, or the same saved / shared filter in the same kind of
 * target): an action started on `before` (a fetch awaited) only applies while `now` is still that filter.
 */
export function isSameEditorFilter(before: EditorTarget | null, now: EditorTarget | null): boolean {
  if (before === null || now === null) return false;
  if (before.kind === 'draft' || now.kind === 'draft') {
    return before.kind === 'draft' && now.kind === 'draft' && before.entryId === now.entryId;
  }
  return before.kind === now.kind && before.savedId === now.savedId;
}

/**
 * The viewer just signed in as the owner of the filter open in the sandbox, which has edits: the editor keeps the
 * sandbox (and offers the switch to the editable version) instead of reopening it as the owner's filter, which would
 * drop those edits. A sandbox without edits switches by itself.
 */
export function keepsOwnerSandbox(target: EditorTarget | null, dirty: boolean, route: EditorRoute, viewerId: string | null): boolean {
  return (
    target?.kind === 'sandbox' &&
    dirty &&
    route.kind === 'saved' &&
    target.savedId === route.id &&
    viewerId !== null &&
    target.ownerId === viewerId
  );
}

/** What the Save dialog starts from: the name, description and Private of the filter; `isPrivate` null when unknown. */
export interface SaveDialogDetails {
  readonly name: string;
  readonly description: string;
  readonly isPrivate: boolean | null;
}

/**
 * The Save dialog's details: a new draft starts public with no description; a saved filter (or a draft of one) takes
 * them from its row (`saved`: the loaded detail or the My filters entry), and its privacy is unknown (null) until that
 * row is known, so nothing defaults it to public.
 */
export function saveDialogDetailsOf(
  name: string,
  newDraft: boolean,
  saved: Pick<SharedFilterSummary, 'description' | 'is_private'> | null
): SaveDialogDetails {
  if (newDraft) return { name, description: '', isPrivate: false };
  return { name, description: saved?.description ?? '', isPrivate: saved?.is_private ?? null };
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
  /** The bundled template (`template`) is newer than the one the filter started from. */
  | { readonly kind: 'template'; readonly template: BundledTemplateId; readonly fromVersion: string | null }
  /** The shared source was deleted or made private (`id` null: deleted, the saved copy lost its `based_on_id`). */
  | { readonly kind: 'gone'; readonly id: string | null };

/**
 * Compares a filter's `basedOn` with what is known about its source: `revisions` from the source lookup (null: no longer
 * shared, absent: not looked up), the template's bundled version for template-based filters (an unknown version counts
 * as older). A copy with a label but neither a source id nor a template lost its source (`on delete set null`), as
 * `filterUpdateStatus` reads it in the library.
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
  if (basedOn.template === undefined) return { kind: 'gone', id: null };
  const template = bundledTemplate(basedOn.template);
  if (template === null) return { kind: 'none' };
  const version = basedOn.version ?? null;
  return version === null || compareVersions(version, template.version) < 0
    ? { kind: 'template', template: template.id, fromVersion: version }
    : { kind: 'none' };
}

/** Router state that opens the editor scrolled to the problems list (the AI help page's first import with problems). */
export const SHOW_PROBLEMS_STATE = { showProblems: true } as const;

export function isShowProblemsState(state: unknown): boolean {
  return typeof state === 'object' && state !== null && 'showProblems' in state && state.showProblems === true;
}
