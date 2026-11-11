import { useState, type ReactNode } from 'react';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DraftReviewRow, SaveImportReport } from '@/features/character/engine/buildDraft';
import { assessSaveAge } from '@/features/character/parser/saveAge';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import type { VariantDraft } from './buildFormModel';
import { openReviewRows, reviewRowSlotLabel } from '../utils/saveImportReview';

interface SaveImportPanelProps {
  readonly report: SaveImportReport;
  /** The imported variant as it stands now; undefined once it was deleted */
  readonly draft: VariantDraft | undefined;
  readonly disabled: boolean;
  readonly onGoToSlot: (row: DraftReviewRow) => void;
  readonly onClearSlot: (row: DraftReviewRow) => void;
}

function Banner({ children }: { readonly children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function ReviewRow({
  row,
  disabled,
  onGoToSlot,
  onKeep,
  onClearSlot,
}: {
  readonly row: DraftReviewRow;
  readonly disabled: boolean;
  readonly onGoToSlot: () => void;
  readonly onKeep: () => void;
  readonly onClearSlot: () => void;
}) {
  const check = row.severity === 'check';
  return (
    <li className={cn('space-y-1.5 rounded-md border p-2.5 text-sm', check && 'border-amber-500/50 bg-amber-500/10')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{reviewRowSlotLabel(row)}</p>
          <p className="break-words">
            <span className="font-semibold">{row.name}</span>
            {row.name !== row.base && <span className="text-muted-foreground"> · {row.base}</span>}
            <span className="text-muted-foreground"> · {row.kindLabel}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onGoToSlot}>
            Go to slot
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onKeep}>
            {check ? 'Looks right' : 'Keep as custom'}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onClearSlot}>
            Clear
          </Button>
        </div>
      </div>
      {row.message !== null && (
        <p className="flex items-start gap-1 text-xs text-amber-700 dark:text-amber-400">
          <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
          {row.message}
        </p>
      )}
      {row.stats.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Rolled stats ({row.stats.length}, not saved)</summary>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {row.stats.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}

/** What the import did and what still needs a look: sits above the variant tabs, reads the live draft, never blocks saving. */
export function SaveImportPanel({ report, draft, disabled, onGoToSlot, onClearSlot }: SaveImportPanelProps) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const manifest = useManifest();

  const rows = openReviewRows(report.rows, draft, dismissed);
  const age =
    manifest === null
      ? null
      : assessSaveAge({
          lastSavedAt: report.lastSavedAt,
          sidecarVersion: report.sidecarVersion,
          bundleVersion: manifest.esrVersion,
          bundleDate: manifest.esrDate,
        });

  return (
    <section aria-label="Imported from a save file" className="space-y-2 rounded-xl border bg-card p-3 shadow-sm">
      <p className="font-medium">
        Imported from {report.fileName}: {report.matched} matched, {rows.length} to review.
      </p>
      {age?.status === 'saved-before-release' && (
        <Banner>
          Saved on {new Date(report.lastSavedAt * 1000).toLocaleDateString()}, before ESR {age.bundleVersion} came out. Names and stats here
          are the current data, so an older item may read differently.
        </Banner>
      )}
      {age?.status === 'different-version' && (
        <Banner>
          Saved with ESR {age.savedVersion}; names and stats here are the ESR {age.bundleVersion} data, so an older item may read
          differently.
        </Banner>
      )}
      {report.incompleteNote !== null && <Banner>{report.incompleteNote}</Banner>}
      {report.corpses > 0 && (
        <Banner>This character has a corpse. Gear left on it is not in the slots below, so check them against the game.</Banner>
      )}
      {rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <ReviewRow
              key={row.id}
              row={row}
              disabled={disabled}
              onGoToSlot={() => {
                onGoToSlot(row);
              }}
              onKeep={() => {
                setDismissed(new Set(dismissed).add(row.id));
              }}
              onClearSlot={() => {
                onClearSlot(row);
              }}
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Not imported: attributes, mercenary type, exact rolls and the inventory. Nothing is saved until you save the build.
      </p>
    </section>
  );
}
