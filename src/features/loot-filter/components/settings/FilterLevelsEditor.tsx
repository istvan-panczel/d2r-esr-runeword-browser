import { useDispatch } from 'react-redux';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { levelName, shownLanguage } from '../../engine/text';
import type { FilterLevel, FilterText, LootFilter } from '../../engine/types';
import { renumberLevel, setFilterLevels, setHeader } from '../../store/lootFilterSlice';
import { NumberInput } from '../NumberInput';

const NO_DEFAULT = '__none';

/** How many rules list each level id in `activeInLevels`. */
function levelUsage(filter: LootFilter): ReadonlyMap<number, number> {
  const usage = new Map<number, number>();
  for (const rule of filter.rules) {
    for (const id of new Set(rule.activeInLevels ?? [])) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

interface FilterLevelsEditorProps {
  readonly filter: LootFilter;
}

/** The level list (id + name), `defaultLevel`, and warnings for level ids the rules use. */
export function FilterLevelsEditor({ filter }: FilterLevelsEditorProps) {
  const dispatch = useDispatch();
  const levels = filter.filterLevels ?? [];
  const usage = levelUsage(filter);
  const levelIds = new Set(levels.map((level) => level.id));
  const missing = [...usage.keys()].filter((id) => !levelIds.has(id)).sort((a, b) => a - b);

  const commit = (next: readonly FilterLevel[]) => {
    dispatch(setFilterLevels(next.length === 0 ? undefined : next));
    if (next.length === 0 && filter.defaultLevel !== undefined) dispatch(setHeader({ defaultLevel: undefined }));
  };

  /** A per-language name keeps its other languages: the field edits the language it shows (enUS, else the first). */
  const renameLevel = (index: number, name: string) => {
    const renamed = (current: FilterText): FilterText =>
      typeof current === 'string' ? name : { ...current, [shownLanguage(current)]: name };
    commit(levels.map((current, position) => (position === index ? { ...current, name: renamed(current.name) } : current)));
  };

  /** Changes a level's id along with the rules and default level that use it; a taken id is not committed. */
  const changeLevelId = (index: number, id: number) => {
    const previous = levels[index];
    if (previous.id === id || levelIds.has(id)) return;
    if (levels.filter((level) => level.id === previous.id).length > 1) {
      // A duplicated id (from the file): only this row changes; the rules still have a level with the old id.
      commit(levels.map((current, position) => (position === index ? { ...current, id } : current)));
      return;
    }
    dispatch(renumberLevel({ from: previous.id, to: id }));
  };

  const addLevel = () => {
    const id = levels.reduce((max, level) => Math.max(max, level.id), 0) + 1;
    commit([...levels, { id, name: `Level ${String(id)}` }]);
    if (filter.defaultLevel === undefined) dispatch(setHeader({ defaultLevel: id }));
  };

  const removeLevel = (index: number) => {
    const removed = levels[index];
    commit(levels.filter((_, position) => position !== index));
    if (filter.defaultLevel === removed.id && levels.length > 1) {
      const fallback = levels.find((_, position) => position !== index);
      dispatch(setHeader({ defaultLevel: fallback?.id }));
    }
  };

  const defaultKnown = filter.defaultLevel === undefined || levelIds.has(filter.defaultLevel);

  return (
    <div className="space-y-3">
      {levels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No levels: every rule is always active and the level key does nothing.</p>
      ) : (
        <ul className="space-y-2">
          {levels.map((level, index) => {
            const used = usage.get(level.id) ?? 0;
            const edited = typeof level.name === 'string' ? undefined : shownLanguage(level.name);
            const otherLanguages = typeof level.name === 'string' ? 0 : Object.keys(level.name).length - 1;
            return (
              // Ids can repeat or change while typing, so the row position is the only stable key.
              // eslint-disable-next-line react-x/no-array-index-key
              <li key={index} className="flex flex-wrap items-center gap-2">
                <Label className="sr-only" htmlFor={`loot-filter-level-id-${String(index)}`}>
                  Level id
                </Label>
                <NumberInput
                  id={`loot-filter-level-id-${String(index)}`}
                  integer
                  className="w-20"
                  value={level.id}
                  onCommit={(id) => {
                    if (id !== undefined) changeLevelId(index, id);
                  }}
                />
                <Label className="sr-only" htmlFor={`loot-filter-level-name-${String(index)}`}>
                  Level name
                </Label>
                <Input
                  id={`loot-filter-level-name-${String(index)}`}
                  className="min-w-40 flex-1"
                  value={levelName(level)}
                  onChange={(event) => {
                    renameLevel(index, event.target.value);
                  }}
                />
                {otherLanguages > 0 && (
                  <span className="text-xs text-muted-foreground" title="Edit the other languages in the JSON tab">
                    {edited}; +{otherLanguages} {otherLanguages === 1 ? 'language' : 'languages'}
                  </span>
                )}
                <span className="w-28 text-xs text-muted-foreground">
                  {used === 0 ? 'Not used by rules' : `Used by ${String(used)} ${used === 1 ? 'rule' : 'rules'}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    removeLevel(index);
                  }}
                  aria-label={`Remove level ${levelName(level)}`}
                >
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {levels.some((level) => (usage.get(level.id) ?? 0) > 0) && (
        <p className="text-xs text-muted-foreground">
          Removing a level that rules use leaves those rules pointing at a missing level; changing its id updates them.
        </p>
      )}
      {missing.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Rules use level {missing.length === 1 ? 'id' : 'ids'} {missing.join(', ')}, which {missing.length === 1 ? 'is' : 'are'} not in
          this list.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <Button variant="outline" size="sm" onClick={addLevel}>
          <Plus />
          Add level
        </Button>
        {levels.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loot-filter-default-level">Default level</Label>
            <Select
              value={filter.defaultLevel === undefined ? NO_DEFAULT : String(filter.defaultLevel)}
              onValueChange={(selected) => {
                dispatch(setHeader({ defaultLevel: selected === NO_DEFAULT ? undefined : Number(selected) }));
              }}
            >
              <SelectTrigger id="loot-filter-default-level" className="w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_DEFAULT}>Not set</SelectItem>
                {!defaultKnown && <SelectItem value={String(filter.defaultLevel)}>{filter.defaultLevel} (not in the list)</SelectItem>}
                {[...new Map(levels.map((level) => [level.id, level])).values()].map((level) => (
                  <SelectItem key={level.id} value={String(level.id)}>
                    {level.id}: {levelName(level) === '' ? 'unnamed' : levelName(level)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
