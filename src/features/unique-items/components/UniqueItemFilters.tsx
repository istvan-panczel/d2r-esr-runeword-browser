import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { ItemTypeFilter } from './ItemTypeFilter';
import { useShareUrl } from '../hooks/useShareUrl';
import { setSearchText, setMaxReqLevel, selectSearchText, selectMaxReqLevel } from '../store';

const SEARCH_DEBOUNCE_MS = 300;
const INPUT_DEBOUNCE_MS = 300;

export function UniqueItemFilters() {
  const dispatch = useDispatch();
  const searchText = useSelector(selectSearchText);
  const maxReqLevel = useSelector(selectMaxReqLevel);
  const getShareUrl = useShareUrl();

  const [localSearchText, setLocalSearchText] = useState(searchText);
  const [localMaxReqLevel, setLocalMaxReqLevel] = useState(maxReqLevel);

  // Sync local state when Redux state changes externally
  useEffect(() => {
    setLocalSearchText(searchText);
  }, [searchText]);

  useEffect(() => {
    setLocalMaxReqLevel(maxReqLevel);
  }, [maxReqLevel]);

  // Debounce dispatch to Redux
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearchText !== searchText) {
        dispatch(setSearchText(localSearchText));
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [localSearchText, searchText, dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localMaxReqLevel !== maxReqLevel) {
        dispatch(setMaxReqLevel(localMaxReqLevel));
      }
    }, INPUT_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [localMaxReqLevel, maxReqLevel, dispatch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    setLocalSearchText('');
    dispatch(setSearchText(''));
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
    setLocalMaxReqLevel(null);
    dispatch(setMaxReqLevel(null));
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Search row */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Search input */}
        <div className="flex-1 min-w-64 max-w-md space-y-1">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground">
              Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
            </p>
            <SearchHelpButton />
          </div>
          <Label htmlFor="unique-search" className="sr-only">
            Search
          </Label>
          <InputGroup>
            <InputGroupInput
              id="unique-search"
              type="text"
              placeholder="Search name or properties..."
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

        {/* Max Required Level */}
        <div className="w-32 space-y-1">
          <p className="text-xs text-muted-foreground">Max required level.</p>
          <Label htmlFor="unique-maxReqLevel" className="sr-only">
            Max Req Level
          </Label>
          <InputGroup>
            <InputGroupInput
              id="unique-maxReqLevel"
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
        <CopyLinkButton getShareUrl={getShareUrl} />
      </div>

      {/* Item Type Filter */}
      <ItemTypeFilter />
    </div>
  );
}
