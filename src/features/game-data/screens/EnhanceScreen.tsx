import { useSearchParams } from 'react-router-dom';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { useDebouncedFilterValue } from '@/core/hooks/useDebouncedFilterValue';
import { buildShareUrl } from '@/core/utils/filterUrlParams';
import { cn } from '@/lib/utils';
import type { EnhanceBundle } from '../engine/schema';
import { EnhanceAnointment } from '../components/EnhanceAnointment';
import { EnhanceCorruption } from '../components/EnhanceCorruption';
import { EnhanceSearch } from '../components/EnhanceParts';
import { EnhanceSanctification } from '../components/EnhanceSanctification';
import { EnhanceStandard } from '../components/EnhanceStandard';
import { EnhanceVessel } from '../components/EnhanceVessel';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import { ENHANCE_TABS, ENHANCE_TAB_LABELS, encodeEnhanceState, readEnhanceState, slotOptions, type EnhanceState } from '../utils/enhance';

const ENHANCE_FILES = ['enhance'] as const;
const ENHANCE_ROUTE = 'game-data/enhance';
const SEARCH_DEBOUNCE_MS = 300;

export function EnhanceScreen() {
  const gameData = useGameData(ENHANCE_FILES);
  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return <EnhanceBrowser bundle={gameData.data.enhance} />;
}

const SEARCH_PLACEHOLDERS: Record<EnhanceState['tab'], string> = {
  corruption: 'Search outcomes...',
  anointment: 'Search anointments...',
  sanctification: 'Search sanctifications...',
  vessel: 'Search materials or bonuses...',
  standard: 'Search charms or bonuses...',
};

/** The page state lives in the URL (tab, slot, tier, search), so links and the back button keep it. */
function EnhanceBrowser({ bundle }: { readonly bundle: EnhanceBundle }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = readEnhanceState(searchParams, bundle);

  const update = (patch: Partial<EnhanceState>) => {
    const next = { ...state, ...patch };
    const slots = slotOptions(bundle, next.tab);
    const slot = slots.includes(next.slot) ? next.slot : (slots[0] ?? '');
    setSearchParams(encodeEnhanceState({ ...next, slot }, bundle), { replace: true });
  };

  const [search, setSearch, commitSearch] = useDebouncedFilterValue(
    state.search,
    (value) => {
      update({ search: value });
    },
    SEARCH_DEBOUNCE_MS
  );

  const getShareUrl = () => buildShareUrl(ENHANCE_ROUTE, encodeEnhanceState({ ...state, search }, bundle));

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Every outcome of corrupting, anointing, sanctifying jewels, filling the Vessel of Souls and upgrading unique charms, read from the
        cube recipes of the game files.
      </p>

      <FilterPanel>
        <nav className="flex flex-wrap gap-1" aria-label="Enhance sections">
          {ENHANCE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={state.tab === tab}
              onClick={() => {
                update({ tab });
              }}
              className={cn(SUBTAB_BASE, state.tab === tab ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
            >
              {ENHANCE_TAB_LABELS[tab]}
            </button>
          ))}
        </nav>

        <div className="flex flex-wrap items-end gap-4">
          <EnhanceSearch
            value={search}
            onChange={setSearch}
            onClear={() => {
              commitSearch('');
            }}
            placeholder={SEARCH_PLACEHOLDERS[state.tab]}
          />
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share this view.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>
      </FilterPanel>

      {state.tab === 'corruption' && (
        <EnhanceCorruption
          bundle={bundle}
          slot={state.slot}
          search={state.search}
          onSlot={(slot) => {
            update({ slot });
          }}
        />
      )}
      {state.tab === 'anointment' && (
        <EnhanceAnointment
          bundle={bundle}
          pool={state.slot}
          search={state.search}
          onPool={(slot) => {
            update({ slot });
          }}
        />
      )}
      {state.tab === 'sanctification' && <EnhanceSanctification bundle={bundle} search={state.search} />}
      {state.tab === 'vessel' && (
        <EnhanceVessel
          bundle={bundle}
          tier={state.tier}
          search={state.search}
          onTier={(tier) => {
            update({ tier });
          }}
        />
      )}
      {state.tab === 'standard' && <EnhanceStandard bundle={bundle} search={state.search} />}
    </div>
  );
}
