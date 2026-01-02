import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { SearchHelpButton } from '@/components/SearchHelpButton';
import { useShareUrl } from '../hooks/useShareUrl';
import {
  toggleCategory,
  setSearchText,
  selectAllCategories,
  selectEnabledCategories,
  selectSearchText,
  type EnabledCategories,
} from '../store/socketablesSlice';

const CATEGORY_LABELS: Record<keyof EnabledCategories, string> = {
  gems: 'Gems',
  esrRunes: 'ESR Runes',
  lodRunes: 'LoD Runes',
  kanjiRunes: 'Kanji Runes',
  crystals: 'Crystals',
};

const SEARCH_DEBOUNCE_MS = 300;

export function SocketableFilters() {
  const dispatch = useDispatch();
  const enabledCategories = useSelector(selectEnabledCategories);
  const searchText = useSelector(selectSearchText);
  const getShareUrl = useShareUrl();

  // Local state for immediate input feedback
  const [localSearchText, setLocalSearchText] = useState(searchText);

  // Sync local state when Redux state changes externally
  useEffect(() => {
    setLocalSearchText(searchText);
  }, [searchText]);

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

  const handleCategoryToggle = (category: keyof EnabledCategories) => {
    dispatch(toggleCategory(category));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearchText(e.target.value);
  };

  const handleClearSearch = () => {
    setLocalSearchText('');
    dispatch(setSearchText(''));
  };

  const handleSelectAll = () => {
    dispatch(selectAllCategories());
  };

  const allSelected = Object.values(enabledCategories).every(Boolean);

  return (
    <div className="space-y-4 mb-6">
      {/* Category checkboxes */}
      <div className="flex flex-wrap items-center gap-4">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof EnabledCategories>).map((category) => (
          <label key={category} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={enabledCategories[category]}
              onCheckedChange={() => {
                handleCategoryToggle(category);
              }}
            />
            <span className="text-sm">{CATEGORY_LABELS[category]}</span>
          </label>
        ))}
        <Button variant="outline" size="sm" onClick={handleSelectAll} disabled={allSelected}>
          All
        </Button>
        <CopyLinkButton getShareUrl={getShareUrl} />
      </div>

      {/* Search input */}
      <div className="max-w-md space-y-1">
        <div className="flex items-center gap-1">
          <p className="text-xs text-muted-foreground">
            Search by words or <code className="bg-muted px-1 rounded">"exact phrases"</code>
          </p>
          <SearchHelpButton />
        </div>
        <Label htmlFor="search" className="sr-only">
          Search
        </Label>
        <InputGroup>
          <InputGroupInput
            id="search"
            type="text"
            placeholder="Search by name or bonus text..."
            value={localSearchText}
            onChange={handleSearchChange}
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
    </div>
  );
}
