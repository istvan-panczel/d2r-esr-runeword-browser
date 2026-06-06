import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { writePersistentJson } from '@/core/hooks/usePersistentState';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { ItemTypeFilter } from './ItemTypeFilter';
import { GemCheckboxGroup } from './GemCheckboxGroup';
import { useGemGroups } from '../hooks/useGemGroups';
import { useShareUrl } from '../hooks/useShareUrl';
import { GEMWORD_FILTER_STORAGE_KEY } from '../hooks/useUrlInitialize';
import { buildGemQualitySelection } from '../utils/filteringHelpers';
import { GEM_QUALITIES } from '@/features/data-sync/constants/constants';
import type { GemQuality } from '@/core/db';
import {
  setSearchText,
  setSocketCount,
  setMaxReqLevel,
  setAllGems,
  selectSearchText,
  selectSocketCount,
  selectMaxReqLevel,
  selectAllGems,
  deselectAllGems,
  selectSelectedGems,
  selectSelectedItemTypes,
} from '../store/gemwordsSlice';

const SEARCH_DEBOUNCE_MS = 300;
const INPUT_DEBOUNCE_MS = 300;

export function GemwordFilters() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSearchText);
  const socketCount = useSelector(selectSocketCount);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const selectedGems = useSelector(selectSelectedGems);
  const selectedItemTypes = useSelector(selectSelectedItemTypes);
  const gemGroups = useGemGroups();
  const getShareUrl = useShareUrl();

  const [localSearchText, setLocalSearchText, commitSearchText] = useDebouncedFilterValue(
    searchText,
    (value) => dispatch(setSearchText(value)),
    SEARCH_DEBOUNCE_MS
  );
  const [localSocketCount, setLocalSocketCount, commitSocketCount] = useDebouncedFilterValue(
    socketCount,
    (value) => dispatch(setSocketCount(value)),
    INPUT_DEBOUNCE_MS
  );
  const [localMaxReqLevel, setLocalMaxReqLevel, commitMaxReqLevel] = useDebouncedFilterValue(
    maxReqLevel,
    (value) => dispatch(setMaxReqLevel(value)),
    INPUT_DEBOUNCE_MS
  );

  const hasHydratedRef = useRef(false);
  useEffect(() => {
    if (Object.keys(selectedItemTypes).length === 0 || Object.keys(selectedGems).length === 0) return;

    // The first populated state comes from useUrlInitialize (storage or a shared
    // URL). Skip persisting it: re-writing storage-derived state is pointless,
    // and persisting URL-derived state would silently overwrite the user's own
    // saved filters. Only changes made after hydration are persisted.
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }

    writePersistentJson(typeof window === 'undefined' ? null : window.localStorage, GEMWORD_FILTER_STORAGE_KEY, {
      searchText,
      socketCount,
      maxReqLevel,
      selectedItemTypes,
      selectedGems,
    });
  }, [maxReqLevel, searchText, selectedGems, selectedItemTypes, socketCount]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    commitSearchText('');
  };

  const handleSocketChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setLocalSocketCount(null);
    } else {
      const num = parseInt(value, 10);
      if (num >= 1 && num <= 6) {
        setLocalSocketCount(num);
      }
    }
  };

  const handleClearSockets = () => {
    commitSocketCount(null);
  };

  const handleMaxReqLevelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setLocalMaxReqLevel(null);
    } else {
      const num = parseInt(value, 10);
      if (num >= 1 && num <= 999) {
        setLocalMaxReqLevel(num);
      }
    }
  };

  const handleClearMaxReqLevel = () => {
    commitMaxReqLevel(null);
  };

  const allGemsSelected = Object.keys(selectedGems).length > 0 && Object.values(selectedGems).every(Boolean);
  const noGemsSelected = Object.keys(selectedGems).length > 0 && Object.values(selectedGems).every((value) => !value);

  // Qualities that actually appear among the gems used by gemwords
  const availableQualities = new Set((gemGroups ?? []).flatMap((group) => group.gems.map((gem) => gem.quality)));

  const handleSelectQualityOnly = (quality: GemQuality) => {
    if (!gemGroups) return;
    dispatch(setAllGems(buildGemQualitySelection(gemGroups, quality)));
  };

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton />
          </div>
          <Label htmlFor="gemword-search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="gemword-search"
              type="text"
              placeholder="Search name, gems or affixes..."
              value={localSearchText}
              onChange={handleSearchChange}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
            />
            {localSearchText && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClearSearch} aria-label="Clear search">
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Socket count */}
        <div className="w-32 space-y-1">
          <p className="text-xs text-muted-foreground">Filter by # of sockets.</p>
          <Label htmlFor="gemword-sockets" className="sr-only">
            Sockets
          </Label>
          <InputGroup>
            <InputGroupInput
              id="gemword-sockets"
              type="number"
              min={1}
              max={6}
              placeholder="Sockets"
              value={localSocketCount ?? ''}
              onChange={handleSocketChange}
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {localSocketCount !== null && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClearSockets} aria-label="Clear sockets">
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Max Required Level */}
        <div className="w-32 space-y-1">
          <p className="text-xs text-muted-foreground">Max required level.</p>
          <Label htmlFor="gemword-maxReqLevel" className="sr-only">
            Max Req Level
          </Label>
          <InputGroup>
            <InputGroupInput
              id="gemword-maxReqLevel"
              type="number"
              min={1}
              max={999}
              placeholder="Max Req Lvl"
              value={localMaxReqLevel ?? ''}
              onChange={handleMaxReqLevelChange}
              autoComplete="off"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {localMaxReqLevel !== null && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton variant="ghost" size="icon-xs" onClick={handleClearMaxReqLevel} aria-label="Clear max req level">
                  <X className="size-4" />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>

        {/* Copy Link button */}
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">Share your current filters.</p>
            <CopyLinkHelpButton />
          </div>
          <CopyLinkButton getShareUrl={getShareUrl} />
        </div>
      </div>

      {/* Item Type Filter */}
      <ItemTypeFilter />

      {/* Gem Filter */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">Gems:</span>
          <Button variant="outline" size="sm" onClick={() => dispatch(selectAllGems())} disabled={allGemsSelected}>
            All
          </Button>
          <Button variant="outline" size="sm" onClick={() => dispatch(deselectAllGems())} disabled={noGemsSelected}>
            None
          </Button>
          <span className="text-xs text-muted-foreground">Only quality:</span>
          {GEM_QUALITIES.filter((quality) => availableQualities.has(quality)).map((quality) => (
            <Button
              key={quality}
              variant="outline"
              size="sm"
              title={`Select only ${quality} gems`}
              onClick={() => {
                handleSelectQualityOnly(quality);
              }}
            >
              {quality}
            </Button>
          ))}
        </div>
        <GemCheckboxGroup />
      </div>
    </div>
  );
}
