import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BarChart3, ChevronDown, Eye, FileUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { checkSaveUpload } from '@/features/character/engine/buildDraftRead';
import { statsFromSaveBytes, type SaveStatsResult } from '@/features/character/engine/buildDraftStats';
import { useGameData } from '@/features/game-data/hooks/useGameData';
import { STAT_RANGES, STATS_DIFFICULTIES, isStatsDifficulty } from '../buildStats';
import type { VariantDraftAction } from '../utils/variantDrafts';
import { DIFFICULTY_NAMES, STAT_GROUPS, statsProvenance, type StatGroup } from '../utils/statLabels';
import { emptyStatsDraft, invalidStatKeys, statedCount, statRangeHint, toStatsDraft } from '../utils/statsDraft';
import type { StatsDraft } from './buildFormModel';

/** Fetched only once a file is picked (the reader mounts then) */
const STATS_FILES = ['stash', 'charsheet', 'itemtext'] as const;

interface PickedSave {
  readonly file: File;
  /** The variant the file was picked for */
  readonly variantKey: string;
}

/** Reads a picked .d2s once the bundles are ready and hands back only its stats. */
function StatsSaveReader({ picked, onResult }: { readonly picked: PickedSave; readonly onResult: (result: SaveStatsResult) => void }) {
  const data = useGameData(STATS_FILES);
  const started = useRef(false);

  useEffect(() => {
    if (data.status === 'loading' || started.current) return;
    started.current = true;
    if (data.status === 'error') {
      onResult({
        ok: false,
        error: { title: 'Stats data not available', message: 'Reload the page and try again, or enter the stats by hand.' },
      });
      return;
    }
    picked.file.arrayBuffer().then(
      (buffer) => {
        onResult(statsFromSaveBytes(new Uint8Array(buffer), picked.file.name, data.data));
      },
      () => {
        onResult({ ok: false, error: { title: 'Could not open the file', message: `"${picked.file.name}" could not be read.` } });
      }
    );
  }, [picked, data, onResult]);

  return null;
}

interface StatsEditorProps {
  readonly stats: StatsDraft | null;
  /** The variant's position, which the edits target */
  readonly index: number;
  /** The variant draft's stable key: a save file read asynchronously lands on this variant, wherever it is by then */
  readonly variantKey: string;
  readonly disabled: boolean;
  readonly dispatch: (action: VariantDraftAction) => void;
}

function StatGroupFields({
  group,
  stats,
  index,
  invalid,
  disabled,
  dispatch,
}: {
  readonly group: StatGroup;
  readonly stats: StatsDraft;
  readonly index: number;
  readonly invalid: ReadonlySet<string>;
  readonly disabled: boolean;
  readonly dispatch: (action: VariantDraftAction) => void;
}) {
  return (
    <fieldset className="min-w-0 space-y-2">
      <legend className="flex w-full flex-wrap items-center justify-between gap-2 text-sm font-semibold">
        <span>{group.title}</span>
        {group.id === 'resists' && (
          <span className="flex items-center gap-2 text-xs font-normal">
            <Label htmlFor="build-stats-difficulty" className="text-xs text-muted-foreground">
              Values for
            </Label>
            <Select
              value={String(stats.difficulty)}
              disabled={disabled}
              onValueChange={(value) => {
                const difficulty = Number(value);
                if (isStatsDifficulty(difficulty)) dispatch({ type: 'setStatsDifficulty', variant: index, difficulty });
              }}
            >
              <SelectTrigger id="build-stats-difficulty" size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATS_DIFFICULTIES.map((difficulty) => (
                  <SelectItem key={difficulty} value={String(difficulty)}>
                    {DIFFICULTY_NAMES[difficulty]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        )}
      </legend>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
        {group.stats.map(({ key, label, unit }) => {
          const hint = key === 'ar' && stats.arSkill !== undefined ? `With ${stats.arSkill}, main hand (from the save)` : null;
          const id = `build-stat-${key}`;
          const bad = invalid.has(key);
          return (
            <div key={key} className="flex min-w-0 flex-col gap-1">
              <Label htmlFor={id} className="text-xs text-muted-foreground">
                {label}
                {unit === 'percent' ? ' (%)' : ''}
              </Label>
              {/* Text, not type="number": a pasted "73,276" must not turn into an empty field (parseStatText reads it) */}
              <Input
                id={id}
                type="text"
                inputMode={STAT_RANGES[key].min < 0 ? 'text' : 'numeric'}
                autoComplete="off"
                spellCheck={false}
                value={stats.values[key] ?? ''}
                placeholder="—"
                className="h-8"
                disabled={disabled}
                aria-invalid={bad}
                aria-describedby={bad ? `${id}-hint` : hint === null ? undefined : `${id}-note`}
                onChange={(event) => {
                  dispatch({ type: 'setStatValue', variant: index, key, text: event.target.value });
                }}
              />
              {bad && (
                <p id={`${id}-hint`} className="text-xs text-destructive">
                  {statRangeHint(key)}
                </p>
              )}
              {!bad && hint !== null && (
                <p id={`${id}-note`} className="text-xs text-muted-foreground">
                  {hint}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * The "Character stats" card of a variant: empty, it offers "Add stats" and "Fill from a save file"; filled, grouped
 * number inputs, the difficulty of the resistances, a buffs flag, where the numbers came from, and Clear.
 */
export function StatsEditor({ stats, index, variantKey, disabled, dispatch }: StatsEditorProps) {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState<PickedSave | null>(null);
  const [error, setError] = useState<{ readonly title: string; readonly message: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const reading = picked !== null;
  const invalid = new Set<string>(invalidStatKeys(stats));
  const count = stats === null ? 0 : statedCount(stats);

  const handleFile = (file: File) => {
    const bad = checkSaveUpload(file.name, file.size);
    if (bad !== null) {
      setError(bad);
      return;
    }
    setError(null);
    setPicked({ file, variantKey });
  };

  const handleResult = (result: SaveStatsResult) => {
    setPicked(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const draft = toStatsDraft(result.stats);
    // By key: the variant the file was picked for, even if it moved meanwhile (nothing happens if it is gone)
    if (draft !== null && picked !== null) dispatch({ type: 'setStatsFromSave', variantKey: picked.variantKey, stats: draft });
    setOpen(true);
  };

  return (
    <section aria-labelledby="build-stats-title" className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="build-stats-title" className="flex items-baseline gap-2 text-lg font-semibold">
          <BarChart3 className="size-5 self-center text-muted-foreground" aria-hidden />
          <span>Character stats</span>
          <span className="text-sm font-normal text-muted-foreground">{stats === null ? '(optional)' : `${String(count)} stated`}</span>
        </h2>
        {stats !== null && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={open}
            aria-controls="build-stats-body"
            onClick={() => {
              setOpen(!open);
            }}
          >
            <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} aria-hidden />
            {open ? 'Hide stats' : 'Show stats'}
          </Button>
        )}
      </div>

      {stats === null ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            The character&apos;s numbers for this variant: attributes, life, resistances, speeds, find and more. They are shown on the
            public build page.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || reading}
              onClick={() => {
                setError(null);
                dispatch({ type: 'setStats', variant: index, stats: emptyStatsDraft() });
                setOpen(true);
              }}
            >
              <Plus className="size-4" />
              Add stats
            </Button>
            <input
              ref={input}
              type="file"
              accept=".d2s"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.item(0) ?? null;
                event.target.value = '';
                if (file !== null) handleFile(file);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || reading}
              onClick={() => {
                input.current?.click();
              }}
            >
              {reading ? <Spinner className="size-4" /> : <FileUp className="size-4" />}
              Fill from a save file
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Fill from a save file reads a .d2s in your browser and fills only these stats (computed for the difficulty the character is in,
            without buffs); nothing else in the form changes, and the file is never uploaded.
          </p>
          {picked !== null && <StatsSaveReader picked={picked} onResult={handleResult} />}
          {error !== null && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold">{error.title}</p>
                <p className="break-words">{error.message}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div id="build-stats-body" hidden={!open} className="space-y-4">
          <div className="space-y-1 text-sm">
            <p className="font-medium">{statsProvenance(stats.showCharacter ? stats : { ...stats, character: undefined })}</p>
            {stats.source === 'save' && stats.character !== undefined && (
              <label className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={stats.showCharacter}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    dispatch({ type: 'setStatsShowCharacter', variant: index, show: checked === true });
                  }}
                />
                Show the character&apos;s name ({stats.character})
              </label>
            )}
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>Shown publicly with the build, as entered here. Leave a field empty to not state it; Clear removes the block.</span>
            </p>
          </div>

          {STAT_GROUPS.map((group) => (
            <StatGroupFields
              key={group.id}
              group={group}
              stats={stats}
              index={index}
              invalid={invalid}
              disabled={disabled}
              dispatch={dispatch}
            />
          ))}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={stats.buffed}
                disabled={disabled}
                onCheckedChange={(checked) => {
                  dispatch({ type: 'setStatsBuffed', variant: index, buffed: checked === true });
                }}
              />
              The numbers include buffs
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={disabled}
              onClick={() => {
                if (count > 0 && !window.confirm('Remove the character stats of this variant?')) return;
                dispatch({ type: 'setStats', variant: index, stats: null });
              }}
            >
              <Trash2 className="size-4" />
              Clear stats
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
