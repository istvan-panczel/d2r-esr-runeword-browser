import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { cn } from '@/lib/utils';
import { CHARACTER_TAB_PANEL_ID, CHARACTER_TABS, characterTabId, type CharacterTab } from '../engine/characterTabs';

interface CharacterTabBarProps {
  readonly tab: CharacterTab;
  readonly onChange: (tab: CharacterTab) => void;
}

/** The page's sub-tabs in a toolbar card (`role="tablist"`, like the loot filter editor's); the row scrolls sideways on phones. */
export function CharacterTabBar({ tab, onChange }: CharacterTabBarProps) {
  return (
    <ToolbarCard>
      <div role="tablist" aria-label="Character sections" className="-m-1 flex gap-1 overflow-x-auto p-1">
        {CHARACTER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            id={characterTabId(item.id)}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={CHARACTER_TAB_PANEL_ID}
            className={cn(SUBTAB_BASE, 'shrink-0 whitespace-nowrap', tab === item.id ? SUBTAB_ACTIVE : SUBTAB_INACTIVE)}
            onClick={() => {
              onChange(item.id);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </ToolbarCard>
  );
}
