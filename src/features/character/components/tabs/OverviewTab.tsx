import { ChevronRight } from 'lucide-react';
import { GameDataError } from '@/features/game-data/components/GameDataError';
import { GameDataLoading } from '@/features/game-data/components/GameDataLoading';
import { useManifest } from '@/features/game-data/hooks/useManifest';
import { useClockValue } from '@/features/terror-zones/store/clock';
import type { CharacterFileMeta } from '../../db/characterDb';
import { characterGlance, overviewGroups, type SheetGroup } from '../../engine/characterSheet';
import { characterNotices, savedAgoText } from '../../engine/notices';
import { progressCounters } from '../../engine/characterProgress';
import type { CharacterTab } from '../../engine/characterTabs';
import { sheetText, whereText } from '../../engine/sheetView';
import { useCharacterItemNames } from '../../hooks/useCharacterItems';
import { useCharacterSheet } from '../../hooks/useCharacterSheet';
import type { CharacterFile } from '../../parser/types';
import { CreateBuildAction } from '../CreateBuildAction';
import { CopySheetButton } from '../overview/CopySheetButton';
import { OverviewSheet } from '../overview/OverviewSheet';
import { SaveNotices } from '../SaveNotices';
import { SheetFailedPanel } from '../SheetFailedPanel';
import { CARD_CLASS, NUMBER_FORMAT } from './tabClasses';

const LAST_SAVED_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface OverviewTabProps {
  readonly character: CharacterFile;
  readonly file: CharacterFileMeta;
  readonly bytes: Uint8Array;
  readonly onTab: (tab: CharacterTab) => void;
  /** Opens the Gear tab on an item (from a number's sources) */
  readonly onShowItem: (index: number) => void;
}

/** The stored base values: shown while the sheet's data loads or when it cannot be loaded */
function StatGroupCard({ group }: { readonly group: SheetGroup }) {
  const id = `character-group-${group.key}`;
  return (
    <section aria-labelledby={id} className={CARD_CLASS}>
      <h3 id={id} className="mb-2 font-semibold">
        {group.title}
      </h3>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 text-sm">
        {group.rows.map((stat) => (
          <div key={stat.label} className="contents">
            <dt className="text-muted-foreground">{stat.label}</dt>
            <dd className="text-right tabular-nums">{NUMBER_FORMAT.format(stat.value)}</dd>
          </div>
        ))}
      </dl>
      {group.note !== undefined && <p className="mt-2 text-xs text-muted-foreground">{group.note}</p>}
    </section>
  );
}

interface GlanceLink {
  readonly tab: CharacterTab;
  readonly label: string;
  readonly text: string;
}

function glanceLinks(character: CharacterFile): GlanceLink[] {
  const glance = characterGlance(character);
  const { kills } = progressCounters(character);
  const plural = (count: number, one: string, many = `${one}s`) => `${NUMBER_FORMAT.format(count)} ${count === 1 ? one : many}`;
  const merc = { none: 'no mercenary', alive: 'a mercenary', dead: 'a dead mercenary' }[glance.mercenary];
  return [
    {
      tab: 'gear',
      label: 'Gear',
      text: `${plural(glance.equipped, 'item')} equipped, ${plural(glance.charms, 'item')} in the Charm Inventory, ${merc}`,
    },
    { tab: 'skills', label: 'Skills', text: `${plural(glance.hardPoints, 'hard point')} in ${plural(glance.skillsLearned, 'skill')}` },
    { tab: 'combat', label: 'Combat', text: 'Chance to hit and to be hit across the areas, maps and bosses' },
    { tab: 'storage', label: 'Storage', text: `${plural(glance.stored, 'item')} carried and stored` },
    { tab: 'progress', label: 'Progress', text: `${plural(kills, 'kill')}, specializations, Kill Ledger and Ascendancy` },
  ];
}

/**
 * Overview: who the character is, the save's banners, the computed sheet (unbuffed by default, every number with its
 * sources), the buff switches, the level and gold, the build action and a line per other tab.
 */
export function OverviewTab({ character, file, bytes, onTab, onShowItem }: OverviewTabProps) {
  const manifest = useManifest();
  const sheet = useCharacterSheet(character);
  const itemName = useCharacterItemNames(character);
  const savedAgo = useClockValue((now) => savedAgoText(character.lastSavedAt, now));
  return (
    <div className="space-y-4">
      <header className={`${CARD_CLASS} flex flex-wrap items-start justify-between gap-4`}>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold break-all">{character.name}</h2>
          <p className="text-sm text-muted-foreground">
            Level {character.level} {character.className}
            {sheet.status === 'ready' ? `, ${whereText(sheet.sheet)}` : ''}. Last saved{' '}
            {LAST_SAVED_FORMAT.format(character.lastSavedAt * 1000)}
            {savedAgo !== '' && ` (${savedAgo})`}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {sheet.status === 'ready' && <CopySheetButton text={() => sheetText(sheet.sheet, { className: character.className })} />}
          <CreateBuildAction file={file} bytes={bytes} />
        </div>
      </header>

      <SaveNotices notices={characterNotices(character, file.sidecar, manifest)} />

      {sheet.status === 'ready' ? (
        <OverviewSheet character={character} state={sheet} itemName={itemName} onTab={onTab} onShowItem={onShowItem} />
      ) : (
        <>
          {sheet.status === 'loading' && <GameDataLoading />}
          {sheet.status === 'error' && <GameDataError error={sheet.error} onRetry={sheet.retry} />}
          {sheet.status === 'failed' && <SheetFailedPanel message={sheet.message} />}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overviewGroups(character).map((group) => (
              <StatGroupCard key={group.key} group={group} />
            ))}
          </div>
        </>
      )}

      <section aria-labelledby="character-glance" className="space-y-2">
        <h3 id="character-glance" className="font-semibold">
          At a glance
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {glanceLinks(character).map((link) => (
            <li key={link.tab}>
              <button
                type="button"
                className="group flex h-full w-full items-start justify-between gap-3 rounded-xl border bg-card p-3 text-left shadow-sm hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                onClick={() => {
                  onTab(link.tab);
                }}
              >
                <span className="space-y-0.5">
                  <span className="block font-medium">{link.label}</span>
                  <span className="block text-sm text-muted-foreground">{link.text}</span>
                </span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
