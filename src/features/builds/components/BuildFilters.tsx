import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import { CHARACTER_CLASSES, type CharacterClass } from '../constants';
import type { BuildSortMode } from '../types';
import {
  selectBuildsClassFilter,
  selectBuildsMyBuildsOnly,
  selectBuildsSearchText,
  selectBuildsSortMode,
  setClassFilter,
  setMyBuildsOnly,
  setSearchText,
  setSortMode,
} from '../store';

const SEARCH_DEBOUNCE_MS = 300;
const ALL_CLASSES = '__all__';

export function BuildFilters() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const searchText = useSelector(selectBuildsSearchText);
  const classFilter = useSelector(selectBuildsClassFilter);
  const sortMode = useSelector(selectBuildsSortMode);
  const myBuildsOnly = useSelector(selectBuildsMyBuildsOnly);

  const [localSearch, setLocalSearch] = useState(searchText);

  // Keep local input in sync if the store value changes externally (e.g. clear).
  const [prevSearch, setPrevSearch] = useState(searchText);
  if (searchText !== prevSearch) {
    setPrevSearch(searchText);
    setLocalSearch(searchText);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchText) dispatch(setSearchText(localSearch));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [localSearch, searchText, dispatch]);

  const handleClearSearch = () => {
    setLocalSearch('');
    dispatch(setSearchText(''));
  };

  return (
    <div className="mb-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {isAuthenticated ? (
          <Button asChild>
            <Link to="/builds/new">
              <Plus className="size-4" />
              Create Build
            </Link>
          </Button>
        ) : (
          <Button
            onClick={() => {
              dispatch(openSignInDialog());
            }}
          >
            <Plus className="size-4" />
            Create Build
          </Button>
        )}

        <InputGroup className="max-w-xs flex-1">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search builds..."
            value={localSearch}
            onChange={(event) => {
              setLocalSearch(event.target.value);
            }}
          />
          {localSearch.length > 0 && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton size="icon-xs" onClick={handleClearSearch} aria-label="Clear search">
                <X className="size-4" />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        <Select
          value={classFilter ?? ALL_CLASSES}
          onValueChange={(value) => {
            dispatch(setClassFilter(value === ALL_CLASSES ? null : (value as CharacterClass)));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLASSES}>All classes</SelectItem>
            {CHARACTER_CLASSES.map((characterClass) => (
              <SelectItem key={characterClass} value={characterClass}>
                {characterClass}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sortMode}
          onValueChange={(value) => {
            dispatch(setSortMode(value as BuildSortMode));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="most_liked">Most liked</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isAuthenticated && (
        <div>
          <Button
            variant={myBuildsOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              dispatch(setMyBuildsOnly(!myBuildsOnly));
            }}
          >
            My Builds
          </Button>
        </div>
      )}
    </div>
  );
}
