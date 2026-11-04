import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { openSignInDialog } from '@/features/auth';
import type { VisibleDraft } from '../../store/selectors';
import { duplicate, remove, rename } from '../../store/lootFilterSlice';
import type { LootFilterEntry } from '../../store/types';
import { draftLinks } from '../../utils/library';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { LibraryEntryCard, type EntrySaveAction } from '../LibraryEntryCard';
import { NameDialog } from '../NameDialog';

interface DraftsSectionProps {
  readonly drafts: readonly VisibleDraft[];
  /** Whether filters can be saved at all (Supabase configured): adds Save and calls removing "Discard". */
  readonly sharingEnabled: boolean;
  readonly signedIn: boolean;
}

function discardDescription(entry: LootFilterEntry | null, sharingEnabled: boolean): string | undefined {
  if (entry === null) return undefined;
  if (entry.savedId !== undefined)
    return `The unsaved changes to “${entry.name}” are removed from this browser. The saved filter stays as it is.`;
  if (!sharingEnabled) return undefined;
  return `“${entry.name}” was never saved, so it is removed for good. Download it first if you want to keep a copy; this cannot be undone.`;
}

/** The drafts in this browser as cards: Open, Save (or sign in), Download, Duplicate, Rename, Discard. */
export function DraftsSection({ drafts, sharingEnabled, signedIn }: DraftsSectionProps) {
  const dispatch = useDispatch();
  const [renaming, setRenaming] = useState<LootFilterEntry | null>(null);
  // The entry being discarded stays set while the dialog closes, so its text does not change during the animation.
  const [pendingDelete, setPendingDelete] = useState<LootFilterEntry | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const sorted = [...drafts].sort((a, b) => b.entry.updatedAt - a.entry.updatedAt);
  const deleteLabel = sharingEnabled ? 'Discard' : 'Delete';

  const saveAction = (draft: VisibleDraft, save: string): EntrySaveAction | undefined => {
    if (!sharingEnabled) return undefined;
    if (!signedIn || draft.needsSignIn) return { kind: 'sign-in', onSignIn: () => dispatch(openSignInDialog()) };
    return { kind: 'link', to: save };
  };

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7">
        {sorted.map((draft) => {
          const { entry } = draft;
          const links = draftLinks(entry, draft.needsSignIn);
          return (
            <LibraryEntryCard
              key={entry.id}
              entry={entry}
              openTo={links.open}
              save={saveAction(draft, links.save)}
              deleteLabel={deleteLabel}
              onDuplicate={() => dispatch(duplicate(entry.id))}
              onRename={
                entry.savedId === undefined
                  ? () => {
                      setRenaming(entry);
                    }
                  : undefined
              }
              onDelete={() => {
                setPendingDelete(entry);
                setDeleteOpen(true);
              }}
            />
          );
        })}
      </div>

      <NameDialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) setRenaming(null);
        }}
        title="Rename filter"
        initialName={renaming?.name ?? ''}
        submitLabel="Rename"
        onSubmit={(name) => {
          if (renaming !== null) dispatch(rename({ id: renaming.id, name }));
          setRenaming(null);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        name={pendingDelete?.name ?? null}
        title={sharingEnabled ? (pendingDelete?.savedId === undefined ? 'Discard draft?' : 'Discard changes?') : undefined}
        description={discardDescription(pendingDelete, sharingEnabled)}
        confirmLabel={deleteLabel}
        onCancel={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (pendingDelete) dispatch(remove(pendingDelete.id));
          setDeleteOpen(false);
        }}
      />
    </>
  );
}
