import { useDispatch, useSelector } from 'react-redux';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { FilterGroup, FilterGroupHeader, FilterGroupList } from '@/components/FilterGroup';
import { FilterPanel } from '@/components/FilterPanel';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { NumberFilterInput } from '@/core/components/RecipeCommonFilters';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { isClassCode, type ClassInfo } from '../engine/schema';
import {
  BASE_KINDS,
  BASE_KIND_LABELS,
  BASE_SORT_KEYS,
  BASE_SORT_LABELS,
  BASE_TIERS,
  BASE_TIER_LABELS,
  BASE_VIEWS,
  BASE_VIEW_LABELS,
  isBaseSortKey,
  isBaseView,
} from '../constants/bases';
import {
  clearBaseCodes,
  clearBaseTypes,
  resetBaseFilters,
  selectBaseFilters,
  setBaseClassOnly,
  setBaseMaxReqLvl,
  setBaseMinSockets,
  setBaseSearch,
  setBaseSort,
  setBaseSortDir,
  setBaseTypeGroup,
  setBaseView,
  toggleBaseKind,
  toggleBaseTier,
  toggleBaseType,
} from '../store/gameDataSlice';
import type { TypeGroup } from '../utils/typeGroups';

const INPUT_DEBOUNCE_MS = 300;

interface BaseFiltersProps {
  readonly classes: readonly ClassInfo[];
  readonly typeGroups: readonly TypeGroup[];
  readonly typeNames: ReadonlyMap<string, string>;
  readonly getShareUrl: () => string;
}

export function BaseFilters({ classes, typeGroups, typeNames, getShareUrl }: BaseFiltersProps) {
  const dispatch = useDispatch();
  const filters = useSelector(selectBaseFilters);

  const familiesView = filters.view === 'families';

  const [localSearch, setLocalSearch, commitSearch] = useDebouncedFilterValue(
    filters.search,
    (value) => dispatch(setBaseSearch(value)),
    INPUT_DEBOUNCE_MS
  );
  const [localMinSockets, setLocalMinSockets, commitMinSockets] = useDebouncedFilterValue(
    filters.minSockets,
    (value) => dispatch(setBaseMinSockets(value)),
    INPUT_DEBOUNCE_MS
  );
  const [localMaxReqLvl, setLocalMaxReqLvl, commitMaxReqLvl] = useDebouncedFilterValue(
    filters.maxReqLvl,
    (value) => dispatch(setBaseMaxReqLvl(value)),
    INPUT_DEBOUNCE_MS
  );

  return (
    <FilterPanel>
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search name, type or code; <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton />
          </div>
          <Label htmlFor="bases-search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="bases-search"
              type="text"
              placeholder="Search bases..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
              }}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {localSearch && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => {
                    commitSearch('');
                  }}
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          {filters.codes.length > 0 && (
            <Badge variant="secondary" asChild>
              <button type="button" onClick={() => dispatch(clearBaseCodes())} aria-label="Show all bases, not only the linked ones">
                Only the {filters.codes.length} linked {filters.codes.length === 1 ? 'base' : 'bases'}
                <X />
              </button>
            </Badge>
          )}
        </div>

        <NumberFilterInput
          id="bases-minSockets"
          hint="Min sockets."
          label="Min Sockets"
          placeholder="Sockets"
          max={6}
          value={localMinSockets}
          onChange={setLocalMinSockets}
          onClear={() => {
            commitMinSockets(null);
          }}
          clearLabel="Clear min sockets"
        />

        <NumberFilterInput
          id="bases-maxReqLvl"
          hint="Max required level."
          label="Max Req Level"
          placeholder="Max Req Lvl"
          max={999}
          value={localMaxReqLvl}
          onChange={setLocalMaxReqLvl}
          onClear={() => {
            commitMaxReqLvl(null);
          }}
          clearLabel="Clear max req level"
        />

        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">Share your current filters.</p>
            <CopyLinkHelpButton />
          </div>
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Kind</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {BASE_KINDS.map((kind) => (
              <label key={kind} className="flex h-7 cursor-pointer items-center gap-1">
                <Checkbox checked={filters.kinds.includes(kind)} onCheckedChange={() => dispatch(toggleBaseKind(kind))} />
                <span className="text-sm">{BASE_KIND_LABELS[kind]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Tier</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {BASE_TIERS.map((tier) => (
              <label key={tier} className="flex h-7 cursor-pointer items-center gap-1">
                <Checkbox checked={filters.tiers.includes(tier)} onCheckedChange={() => dispatch(toggleBaseTier(tier))} />
                <span className="text-sm">{BASE_TIER_LABELS[tier]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="bases-class" className="text-xs font-normal text-muted-foreground">
            Class restriction
          </Label>
          <Select
            value={filters.classOnly}
            onValueChange={(value) => {
              if (value === 'any' || value === 'none' || isClassCode(value)) dispatch(setBaseClassOnly(value));
            }}
          >
            <SelectTrigger id="bases-class" size="sm" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any</SelectItem>
              <SelectItem value="none">No class restriction</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.code} value={cls.code}>
                  {cls.name} only
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <p id="bases-view-label" className="text-xs text-muted-foreground">
            View
          </p>
          <Tabs
            value={filters.view}
            onValueChange={(value) => {
              if (isBaseView(value)) dispatch(setBaseView(value));
            }}
          >
            <TabsList aria-labelledby="bases-view-label" className="h-8">
              {BASE_VIEWS.map((view) => (
                <TabsTrigger key={view} value={view} className="px-3">
                  {BASE_VIEW_LABELS[view]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div
          className="space-y-1"
          title={familiesView ? 'The families table keeps its own order; sorting applies to the cards view' : undefined}
        >
          <Label htmlFor="bases-sort" className="text-xs font-normal text-muted-foreground">
            Sort by
          </Label>
          <div className="flex items-center gap-1">
            <Select
              disabled={familiesView}
              value={filters.sort}
              onValueChange={(value) => {
                if (isBaseSortKey(value)) dispatch(setBaseSort(value));
              }}
            >
              <SelectTrigger id="bases-sort" size="sm" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BASE_SORT_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {BASE_SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={familiesView}
              onClick={() => dispatch(setBaseSortDir(filters.sortDir === 'asc' ? 'desc' : 'asc'))}
              aria-label={filters.sortDir === 'asc' ? 'Sorted ascending, switch to descending' : 'Sorted descending, switch to ascending'}
              title={filters.sortDir === 'asc' ? 'Ascending' : 'Descending'}
            >
              {filters.sortDir === 'asc' ? <ArrowUpNarrowWide className="size-4" /> : <ArrowDownWideNarrow className="size-4" />}
            </Button>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={() => dispatch(resetBaseFilters())}>
          Reset filters
        </Button>
      </div>

      <TypePicker typeGroups={typeGroups} typeNames={typeNames} selected={filters.types} />
    </FilterPanel>
  );
}

interface TypePickerProps {
  readonly typeGroups: readonly TypeGroup[];
  readonly typeNames: ReadonlyMap<string, string>;
  readonly selected: readonly string[];
}

/** Item-type checkboxes grouped like the runeword ItemTypeFilter; nothing selected means every type. */
function TypePicker({ typeGroups, typeNames, selected }: TypePickerProps) {
  const dispatch = useDispatch();
  // Parent types (e.g. "Melee Weapon" from an Item Types link) are not in the picker; show them as removable chips
  const pickerCodes = new Set(typeGroups.flatMap((group) => group.types.map((type) => type.code)));
  const extraSelected = selected.filter((code) => !pickerCodes.has(code));

  return (
    <div className="space-y-2">
      <FilterGroupHeader label="Item Types">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0 ? 'all (none selected)' : `${String(selected.length)} selected`}
        </span>
        <Button variant="outline" size="sm" onClick={() => dispatch(clearBaseTypes())} disabled={selected.length === 0}>
          Clear
        </Button>
        {extraSelected.map((code) => (
          <Badge key={code} variant="secondary" asChild>
            <button type="button" onClick={() => dispatch(toggleBaseType(code))} aria-label={`Remove type filter ${code}`}>
              {typeNames.get(code) ?? code} ({code})
              <X />
            </button>
          </Badge>
        ))}
      </FilterGroupHeader>
      <FilterGroupList>
        {typeGroups.map((group) => {
          const codes = group.types.map((type) => type.code);
          const selectedCount = codes.filter((code) => selected.includes(code)).length;
          const groupChecked = selectedCount === 0 ? false : selectedCount === codes.length ? true : 'indeterminate';
          return (
            <FilterGroup
              key={group.label}
              label={group.label}
              checked={groupChecked}
              onToggleGroup={() => dispatch(setBaseTypeGroup({ codes, selected: groupChecked !== true }))}
              options={group.types.map((type) => ({ id: type.code, label: type.name, checked: selected.includes(type.code) }))}
              onToggle={(code) => dispatch(toggleBaseType(code))}
            />
          );
        })}
      </FilterGroupList>
    </div>
  );
}
