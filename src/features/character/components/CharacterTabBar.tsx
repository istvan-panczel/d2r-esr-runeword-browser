import type { KeyboardEvent } from 'react';
import { ToolbarCard } from '@/components/ToolbarCard';
import { SUBTAB_ACTIVE, SUBTAB_BASE, SUBTAB_INACTIVE } from '@/core/components/navTabClasses';
import { cn } from '@/lib/utils';
import { CHARACTER_TAB_PANEL_ID, CHARACTER_TABS, characterTabId, tabAfterKey, type CharacterTab } from '../engine/characterTabs';

interface CharacterTabBarProps {
  readonly tab: CharacterTab;
  readonly onChange: (tab: CharacterTab) => void;
}

/**
 * The page's sub-tabs in a toolbar card (`role="tablist"`); the row scrolls sideways on phones. Keyboard: one Tab stop
 * (the selected tab), the arrow keys and Home / End move to and open another tab (roving tabindex).
 */
export function CharacterTabBar({ tab, onChange }: CharacterTabBarProps) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = CHARACTER_TABS.findIndex((item) => item.id === tab);
    const next = tabAfterKey(current, event.key, CHARACTER_TABS.length);
    const target = next === null ? undefined : CHARACTER_TABS.at(next);
    if (target === undefined) return;
    event.preventDefault();
    onChange(target.id);
    document.getElementById(characterTabId(target.id))?.focus();
  };
  return (
    <ToolbarCard>
      <div role="tablist" aria-label="Character sections" className="-m-1 flex gap-1 overflow-x-auto p-1" onKeyDown={onKeyDown}>
        {CHARACTER_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            id={characterTabId(item.id)}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={CHARACTER_TAB_PANEL_ID}
            tabIndex={tab === item.id ? 0 : -1}
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
