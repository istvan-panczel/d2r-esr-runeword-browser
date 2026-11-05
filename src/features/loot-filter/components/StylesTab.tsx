import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Copy, Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { selectRuleView } from '@/features/settings';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CONDITION_KEYS } from '../engine/parse';
import type { Diagnostic, LootFilter, LootFilterStyle, RuleActions } from '../engine/types';
import { removeStyle, renameStyle, setStyle } from '../store/lootFilterSlice';
import { countActions, countStyleUsers } from '../utils/effectiveActions';
import { applyPatch, type ShallowPatch } from '../utils/patch';
import { actionFieldGate } from '../utils/ruleView';
import { presetStyleStatus, type StylePreset } from '../utils/stylePresets';
import { ActionsEditor } from './actions/ActionsEditor';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { NameDialog } from './NameDialog';
import { MoreInAdvanced, ViewToggle } from './rules/ViewToggle';
import { StylePresetMenu } from './StylePresetMenu';

interface StylesTabProps {
  readonly filter: LootFilter;
  /** The filter's diagnostics: a style's own (`style` set) keep the fields they point at visible in the Basic view. */
  readonly diagnostics: readonly Diagnostic[];
}

const VIEW_TOGGLE_ID = 'loot-filter-style-view';

type NameDialogState = { readonly mode: 'add' } | { readonly mode: 'rename'; readonly name: string } | null;

/** The first free name among `base`, `base 2`, `base 3`… */
function freeName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base} ${String(n)}`)) n += 1;
  return `${base} ${String(n)}`;
}

function usedBy(count: number): string {
  return count === 1 ? 'used by 1 rule' : `used by ${String(count)} rules`;
}

/** The style's keys that are conditions (kept in passthrough by the parser: styles hold actions only). */
function strayConditions(style: LootFilterStyle): string[] {
  const passthrough = style.passthrough ?? {};
  return (CONDITION_KEYS as readonly string[]).filter((key) => key in passthrough);
}

/** Named sets of actions that rules pull in with `useStyle`: list, add, rename, duplicate, delete, edit. */
export function StylesTab({ filter, diagnostics }: StylesTabProps) {
  const dispatch = useDispatch();
  const styles = filter.styles ?? {};
  const entries = Object.entries(styles);
  const names = entries.map(([name]) => name);
  const [selected, setSelected] = useState<string | null>(null);
  const [nameDialog, setNameDialog] = useState<NameDialogState>(null);
  // The style being deleted stays set while the dialog closes, so its text does not change during the animation.
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Basic / Advanced: the rule editor's setting, so one view for the whole editor.
  const view = useSelector(selectRuleView);

  // A renamed, deleted or not-yet-chosen selection falls back to the first style.
  const [current, currentStyle] = entries.find(([name]) => name === selected) ?? entries.at(0) ?? [null, undefined];

  const handleAdd = (name: string) => {
    if (name in styles) {
      toast.error(`There is already a style named "${name}"`);
      return;
    }
    dispatch(setStyle({ name, style: {} }));
    setSelected(name);
    setNameDialog(null);
  };

  // A preset never overwrites a style of the same name: the filter's own style is kept and selected.
  const handleAddPreset = (preset: StylePreset) => {
    const status = presetStyleStatus(styles, preset);
    if (status === 'missing') {
      dispatch(setStyle({ name: preset.name, style: preset.style }));
      toast.success(`Added the style ${preset.name}`, { description: 'Rules use it with Use style.' });
    } else if (status === 'same') {
      toast.info(`${preset.name} is already in the filter`);
    } else {
      toast.info(`The filter already has a style named ${preset.name}`, {
        description: 'Your style is kept as it is. Rename it first to add the preset.',
      });
    }
    setSelected(preset.name);
  };

  const handleRename = (from: string, to: string) => {
    if (to !== from && to in styles) {
      toast.error(`There is already a style named "${to}"`);
      return;
    }
    if (to !== from) dispatch(renameStyle({ from, to }));
    setSelected(to);
    setNameDialog(null);
  };

  const handleDuplicate = (name: string, style: LootFilterStyle) => {
    const copy = freeName(`${name} (copy)`, names);
    dispatch(setStyle({ name: copy, style }));
    setSelected(copy);
  };

  const handleDelete = () => {
    if (deleting !== null) dispatch(removeStyle(deleting));
    setDeleteOpen(false);
  };

  const handleChange = (name: string, style: LootFilterStyle, patch: ShallowPatch<RuleActions>) => {
    dispatch(setStyle({ name, style: applyPatch(style, patch) }));
  };

  const deletingUsers = deleting === null ? 0 : countStyleUsers(filter, deleting);
  const stray = currentStyle === undefined ? [] : strayConditions(currentStyle);
  const gate =
    current === null
      ? undefined
      : actionFieldGate({ view, actions: currentStyle, diagnostics: diagnostics.filter((diagnostic) => diagnostic.style === current) });

  return (
    // Wide pages: a little more room for the style names; the editor's sections become tiles (ActionsEditor).
    <div className="grid gap-4 lg:grid-cols-[18rem_1fr] @8xl/page:grid-cols-[20rem_minmax(0,1fr)] @10xl/page:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Styles</CardTitle>
          <CardDescription>Named sets of actions; a rule pulls one in with Use style.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {names.length === 0 && <p className="text-sm text-muted-foreground">No styles yet.</p>}
          <ul className="flex flex-col gap-1">
            {entries.map(([name, style]) => {
              const count = countActions(style);
              return (
                <li key={name}>
                  <button
                    type="button"
                    aria-current={name === current ? 'true' : undefined}
                    className={cn(
                      'flex w-full flex-col items-start rounded-md px-3 py-2 text-left transition-colors hover:bg-accent',
                      name === current && 'bg-accent text-accent-foreground'
                    )}
                    onClick={() => {
                      setSelected(name);
                    }}
                  >
                    <span className="w-full truncate font-medium">{name}</span>
                    <span className="text-xs text-muted-foreground">
                      {count === 1 ? '1 action' : `${String(count)} actions`} · {usedBy(countStyleUsers(filter, name))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setNameDialog({ mode: 'add' });
              }}
            >
              <Plus />
              Add style
            </Button>
            <StylePresetMenu onPick={handleAddPreset} />
          </div>
        </CardContent>
      </Card>

      {current !== null ? (
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <CardTitle className="truncate">{current}</CardTitle>
                <CardDescription>
                  {usedBy(countStyleUsers(filter, current))}. The rule&apos;s own actions win over the style&apos;s.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <ViewToggle id={VIEW_TOGGLE_ID} owner="style" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Rename ${current}`}
                  title="Rename"
                  onClick={() => {
                    setNameDialog({ mode: 'rename', name: current });
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Duplicate ${current}`}
                  title="Duplicate"
                  onClick={() => {
                    handleDuplicate(current, currentStyle);
                  }}
                >
                  <Copy />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${current}`}
                  title="Delete"
                  onClick={() => {
                    setDeleting(current);
                    setDeleteOpen(true);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
            {stray.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2 text-sm">
                <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex flex-col gap-1">
                  <p>Styles hold actions only, so these conditions are ignored (they stay in the file; remove them in the JSON tab):</p>
                  <div className="flex flex-wrap gap-1">
                    {stray.map((key) => (
                      <Badge key={key} variant="outline" className="font-mono">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <ActionsEditor
              key={current}
              actions={currentStyle}
              filter={filter}
              owner="style"
              styleName={current}
              gate={gate}
              onChange={(patch) => {
                handleChange(current, currentStyle, patch);
              }}
            />
            <MoreInAdvanced count={gate?.hiddenActions ?? 0} noun="action" toggleId={VIEW_TOGGLE_ID} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No style selected</CardTitle>
            <CardDescription>Add a style to give several rules the same label, sound or icon in one place.</CardDescription>
          </CardHeader>
        </Card>
      )}

      <NameDialog
        open={nameDialog !== null}
        onOpenChange={(open) => {
          if (!open) setNameDialog(null);
        }}
        title={nameDialog?.mode === 'rename' ? 'Rename style' : 'Add style'}
        description={nameDialog?.mode === 'rename' ? 'Rules that use the style follow the new name.' : undefined}
        initialName={nameDialog?.mode === 'rename' ? nameDialog.name : freeName('New style', names)}
        submitLabel={nameDialog?.mode === 'rename' ? 'Rename' : 'Add'}
        onSubmit={(name) => {
          if (nameDialog?.mode === 'rename') handleRename(nameDialog.name, name);
          else handleAdd(name);
        }}
      />

      <ConfirmDeleteDialog
        open={deleteOpen}
        name={deleting}
        title="Delete style?"
        description={`“${deleting ?? ''}” is removed from the filter.${
          deletingUsers > 0
            ? ` ${deletingUsers === 1 ? '1 rule uses' : `${String(deletingUsers)} rules use`} it; they keep the name and lose its actions (the problems list flags them).`
            : ' No rule uses it.'
        }`}
        onCancel={() => {
          setDeleteOpen(false);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
