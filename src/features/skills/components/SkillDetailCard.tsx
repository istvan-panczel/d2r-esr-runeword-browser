import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { ExternalLink } from '@/components/ExternalLink';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ESR_SKILL_INFO_URL } from '@/core/navigation/navConfig';
import type { SkillCalcSkill, SkillDetail, SkillGrant, SkillInfoText, SkillMercenary } from '@/features/game-data/engine/schema';
import {
  defaultContext,
  evaluateSkill,
  itemTriggerInfo,
  skillTable,
  synergyInputs,
  type SkillCalcIndex,
  type SkillCalcOptions,
  type SkillLineResult,
  type SkillTableRow,
} from '@/features/game-data/engine/skillCalc';
import { cn } from '@/lib/utils';
import { restoreScroll, saveScroll, scrollToTop, type SavedScroll } from '../hooks/useDetailScroll';
import { useSkillCalc } from '../hooks/useSkillCalc';
import {
  grantHeadline,
  grantHeadlines,
  grantLevel,
  headlineKeys,
  quickRows,
  resolveSynergyPoints,
  synergyLineInputs,
  synergyTexts,
  valueTableLevels,
  varyingRows,
  withSynergyPoints,
  type GrantHeadline,
  type SynergyInput,
} from '../utils/skillLevels';
import {
  dependents,
  descriptionParagraphs,
  formatMana,
  GRANT_GROUPS,
  grantText,
  ITEM_KIND_LABELS,
  itemPageUrl,
  keyed,
  mercenaryGroups,
  skillContext,
  type SkillsView,
} from '../utils/skills';
import { LevelStepper } from './LevelInput';
import { SkillIcon } from './SkillIcon';
import { SkillLevelBar, SkillLevelValues, type SkillLevelsConfig } from './SkillLevelValues';

/** Grants shown per group before "Show all" */
const GRANTS_SHOWN = 8;

const LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';
const KIND_CLASS: Record<string, string> = {
  unique: 'text-amber-700 dark:text-amber-400',
  set: 'text-green-700 dark:text-green-400',
  runeword: 'text-yellow-700 dark:text-yellow-300',
  gemword: 'text-sky-700 dark:text-sky-300',
};

interface SkillDetailCardProps {
  readonly view: SkillsView;
  readonly skill: SkillDetail;
  readonly mythicals: ReadonlySet<string>;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly className?: string;
  /** Rendered right after the header, above the tabs (the builds pages' point controls / counter) */
  readonly children?: ReactNode;
  /** The per-level values (skill calculator) and how the page drives them; omitted = only the fixed lines */
  readonly levels?: SkillLevelsConfig;
}

type CardTab = 'values' | 'items' | 'about';

function isCardTab(value: string): value is CardTab {
  return value === 'values' || value === 'items' || value === 'about';
}

/** A "Granted by" level shown in the Values tab: where it came from and where the Items tab was scrolled */
interface GrantJump {
  readonly name: string;
  readonly level: number;
  readonly scroll: SavedScroll | null;
  /** The card has shown that level (until then the page's level may still be the old one) */
  readonly reached: boolean;
}

/** A calculator tag with its explanation */
interface FactTag {
  readonly label: string;
  readonly title: string;
}

/** The calculator's results for the card's skill at the page's level state */
interface CalcResults {
  readonly record: SkillCalcSkill;
  readonly index: SkillCalcIndex;
  readonly config: SkillLevelsConfig;
  readonly inputs: readonly SynergyInput[];
  readonly synergyPoints: Readonly<Record<string, number>>;
  readonly results: readonly SkillLineResult[];
  /** Every line at the quick levels (plus the selected level when it is not one of them) */
  readonly rows: readonly SkillTableRow[];
  readonly tableOptions: Omit<SkillCalcOptions, 'level'>;
  /** The skill's headline lines at an item's level (no hard points: items never give any) */
  readonly headline: (level: number) => GrantHeadline;
}

function evaluateCalc(record: SkillCalcSkill, index: SkillCalcIndex, config: SkillLevelsConfig): CalcResults {
  const { level, charLevel, synergy } = config.state;
  const inputs = synergyInputs(record, index);
  const synergyPoints = resolveSynergyPoints(inputs, synergy);
  const tableOptions = { charLevel, synergyPoints, hardPoints: config.hardPoints };
  const results = evaluateSkill(record, index, defaultContext(record, { ...tableOptions, level }));
  const rows = skillTable(record, index, valueTableLevels(level), tableOptions);
  const keys = headlineKeys(quickRows(rows));
  const headline = (at: number) => grantHeadline(record, index, keys, at, { charLevel, synergyPoints });
  return { record, index, config, inputs, synergyPoints, results, rows, tableOptions, headline };
}

/** The scaling tags (About tab) */
function scalingTags(record: SkillCalcSkill): FactTag[] {
  const tags: FactTag[] = [];
  if (record.scalesWithCharLevel === true)
    tags.push({ label: 'Scales with character level', title: 'Some values grow with the character level, not only the skill level' });
  if (record.scalesWithHardPointsOnly === true)
    tags.push({
      label: 'Scales with hard points only',
      title: 'Part of the effect grows only with points you put into the skill: +skills from items do not raise that part',
    });
  return tags;
}

/**
 * Everything the files say about one skill, in three tabs: Values (the level bar pinned under the tabs, synergies,
 * the lines at the level), Items (what grants it) and About (facts, requirements, notes).
 */
export function SkillDetailCard({ view, skill, mythicals, onSelect, onClose, className, children, levels }: SkillDetailCardProps) {
  const unlocks = dependents(view, skill.id);
  const calc = useSkillCalc();
  const articleRef = useRef<HTMLElement>(null);
  const record = levels === undefined ? undefined : calc.index?.record(skill.id);
  const active =
    levels !== undefined && calc.index !== undefined && record !== undefined && record.lines.length > 0
      ? evaluateCalc(record, calc.index, levels)
      : null;
  const synergyValues = active === null || skill.synergies === undefined ? [] : synergyTexts(skill.synergies, active.results);
  const unlisted = active === null ? [] : active.inputs.filter((input) => input.listed === false);
  const lineInputs = active === null || skill.synergies === undefined ? [] : synergyLineInputs(skill.synergies, active.inputs);
  const calcPending = levels !== undefined && calc.status !== 'ready';
  const hasValues = active !== null || calcPending || skill.lines !== undefined || skill.synergies !== undefined;
  const grants = skill.grantedBy ?? [];

  const [tab, setTab] = useState<CardTab>('values');
  const shownTab: CardTab = tab === 'values' && !hasValues ? 'items' : tab;
  const [jump, setJump] = useState<GrantJump | null>(null);
  // Once the picked level is shown, a level picked elsewhere ends the "from <item>" link (adjusted during render, no
  // effect; the page's level arrives a render after the pick, through the URL)
  if (jump !== null && active !== null) {
    const shownLevel = active.config.state.level;
    if (!jump.reached && shownLevel === jump.level) setJump({ ...jump, reached: true });
    else if (jump.reached && shownLevel !== jump.level) setJump(null);
  }
  // The Items tab's scroll position to restore once it is shown again ("Back to items")
  const restore = useRef<SavedScroll | null>(null);
  useEffect(() => {
    if (shownTab !== 'items' || restore.current === null) return;
    restoreScroll(restore.current);
    restore.current = null;
  }, [shownTab]);

  const pickLevel =
    active === null
      ? undefined
      : (level: number, from: string) => {
          const article = articleRef.current;
          setJump({ name: from, level, scroll: article === null ? null : saveScroll(article), reached: false });
          active.config.onChange({ level });
          setTab('values');
          if (article !== null) scrollToTop(article);
        };
  const backToItems = (target: GrantJump) => {
    restore.current = target.scroll;
    setJump(null);
    setTab('items');
  };

  const synergyPointsInput = (input: SynergyInput, name: string) =>
    active === null ? null : (
      <LevelStepper
        label={`hard points in ${name}`}
        aria-label={`Hard points in ${name} (0 to ${String(input.max)})`}
        value={active.synergyPoints[input.id] ?? 0}
        min={0}
        max={input.max}
        inputClassName="w-10"
        onCommit={(points) => {
          active.config.onChange({
            synergy: withSynergyPoints(active.inputs, active.config.state.synergy, input.id, points),
          });
        }}
      />
    );
  const skillButton = (id: string, name: string) => {
    const target = view.byId.get(id);
    return target === undefined ? (
      <span className="font-medium">{name}</span>
    ) : (
      <button
        type="button"
        className={LINK}
        onClick={() => {
          onSelect(target.id);
        }}
      >
        {name}
      </button>
    );
  };
  const synergyRows =
    skill.synergies === undefined && unlisted.length === 0 ? null : (
      <div className="space-y-1.5">
        {skill.synergies !== undefined && (
          <ul className="space-y-1">
            {keyed(
              skill.synergies.map((synergy, i) => ({ synergy, text: synergyValues[i] ?? synergy.text, input: lineInputs[i] })),
              ({ synergy }) => `${synergy.name}:${synergy.text ?? ''}`
            ).map(({ key, value: { synergy, text, input } }) => (
              <li key={key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1 leading-snug">
                  {skillButton(synergy.id ?? synergy.name, synergy.name)}
                  {text !== undefined && <span className="text-muted-foreground">: {text}</span>}
                </div>
                {input !== undefined && synergyPointsInput(input, synergy.name)}
              </li>
            ))}
          </ul>
        )}
        {unlisted.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {skill.synergies === undefined
                ? 'Not listed in the tooltip: the formulas read these skills\u2019 hard points.'
                : 'Also affected by (not listed in the tooltip):'}
            </p>
            <ul className="space-y-1">
              {unlisted.map((input) => {
                const name = view.byId.get(input.id)?.name ?? input.id;
                return (
                  <li key={input.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">{skillButton(input.id, name)}</div>
                    {synergyPointsInput(input, name)}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    );

  const facts = [
    skill.cls === null ? null : `Req ${String(skill.reqLevel)}`,
    `Max ${String(skill.maxLevel)}`,
    skill.mana === undefined ? null : `Mana ${formatMana(skill.mana)}`,
    skill.element ?? null,
    skill.type === 'aura' ? 'Aura' : skill.type === 'passive' ? 'Passive' : null,
  ].filter((fact) => fact !== null);
  const jumpNote =
    jump?.reached === true ? (
      <p className="text-xs text-muted-foreground">
        Level {jump.level} from {jump.name} ·{' '}
        <button
          type="button"
          className={LINK}
          onClick={() => {
            backToItems(jump);
          }}
        >
          Back to items
        </button>
      </p>
    ) : undefined;
  const levelBar =
    shownTab === 'values' && active !== null ? (
      <SkillLevelBar config={active.config} showLevel={varyingRows(quickRows(active.rows)).length > 0} extra={jumpNote} />
    ) : null;

  return (
    <article ref={articleRef} aria-label={skill.name} className={cn('space-y-3 rounded-lg border bg-card p-4 text-sm', className)}>
      <header className="flex items-start gap-3">
        <SkillIcon icon={skill.icon} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold">{skill.name}</h2>
          <p className="text-xs text-muted-foreground">{skillContext(view, skill)}</p>
          <p className="text-xs text-muted-foreground">{facts.join(' · ')}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close skill details"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      {children}

      {skill.description.length > 0 && (
        <div className="space-y-0.5">
          {keyed(descriptionParagraphs(skill.description), String).map(({ key, value }) => (
            <p key={key}>{value}</p>
          ))}
        </div>
      )}
      {skill.infoPage !== undefined && skill.description.length === 0 && <InfoPageText info={skill.infoPage} name={skill.name} main />}

      <Tabs
        value={shownTab}
        onValueChange={(value) => {
          if (isCardTab(value)) setTab(value);
        }}
        className="gap-3"
      >
        {/* The tabs and the level bar stay in view while the tab scrolls (the detail column from lg, the page below) */}
        <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b bg-card px-4 py-2">
          <TabsList className="w-full">
            {hasValues && <TabsTrigger value="values">Values</TabsTrigger>}
            <TabsTrigger value="items">
              Items <span className="text-xs font-normal text-muted-foreground tabular-nums">{grants.length}</span>
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
          </TabsList>
          {levelBar}
        </div>

        {hasValues && (
          <TabsContent value="values" className="space-y-3">
            {calcPending && calc.status === 'loading' && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Spinner className="size-3" />
                Loading the values per level…
              </p>
            )}
            {calcPending && calc.status === 'error' && (
              <p className="text-xs text-muted-foreground">The values per level could not be loaded; reload the page to try again.</p>
            )}
            {active !== null ? (
              <SkillLevelValues
                config={active.config}
                record={active.record}
                index={active.index}
                results={active.results}
                rows={active.rows}
                tableOptions={active.tableOptions}
                skillName={skill.name}
                synergies={synergyRows}
                hasSynergyInputs={active.inputs.length > 0}
              />
            ) : (
              <>
                {skill.lines !== undefined && (
                  <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
                    {keyed(skill.lines, String).map(({ key, value }) => (
                      <li key={key} className="whitespace-pre-line">
                        {value}
                      </li>
                    ))}
                  </ul>
                )}
                {synergyRows !== null && (
                  <section className="space-y-1.5">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Receives bonuses from</h3>
                    {synergyRows}
                  </section>
                )}
              </>
            )}
          </TabsContent>
        )}

        {/* Kept mounted while hidden: its "Show all" groups and scroll position survive a visit to Values */}
        <TabsContent value="items" forceMount className="space-y-3 data-[state=inactive]:hidden">
          {record !== undefined && <ProcNote record={record} />}
          <GrantedBy
            view={view}
            grants={grants}
            mythicals={mythicals}
            headline={active?.headline}
            onPickLevel={pickLevel}
            minPickLevel={active?.config.minPickLevel}
          />
        </TabsContent>

        <TabsContent value="about" className="space-y-3">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5">
            <AboutFact label="Skill">{skillContext(view, skill)}</AboutFact>
            {skill.cls !== null && <AboutFact label="Required level">{skill.reqLevel}</AboutFact>}
            <AboutFact label="Max level">{skill.maxLevel}</AboutFact>
            {skill.mana !== undefined && <AboutFact label="Mana">{formatMana(skill.mana)}</AboutFact>}
            {skill.element !== undefined && <AboutFact label="Damage">{skill.element}</AboutFact>}
            {skill.type === 'aura' && <AboutFact label="Type">Aura</AboutFact>}
            {skill.type === 'passive' && <AboutFact label="Type">Passive</AboutFact>}
            {skill.reqSkills !== undefined && (
              <AboutFact label="Requires">
                <SkillLinks view={view} ids={skill.reqSkills} onSelect={onSelect} />
              </AboutFact>
            )}
            {unlocks.length > 0 && (
              <AboutFact label="Unlocks">
                <SkillLinks view={view} ids={unlocks.map((entry) => entry.id)} onSelect={onSelect} />
              </AboutFact>
            )}
            {skill.id !== skill.name && <AboutFact label="skills.txt">{skill.id}</AboutFact>}
          </dl>
          {record !== undefined && scalingTags(record).length > 0 && (
            <ul className="space-y-0.5">
              {scalingTags(record).map((tag) => (
                <li key={tag.label}>
                  <span className="font-medium">{tag.label}</span>
                  <span className="text-muted-foreground">: {tag.title}</span>
                </li>
              ))}
            </ul>
          )}
          {skill.infoPage !== undefined && skill.description.length > 0 && (
            <InfoPageText info={skill.infoPage} name={skill.name} main={false} />
          )}
          {skill.mercenaries !== undefined && <Mercenaries mercenaries={skill.mercenaries} />}
          {skill.notes !== undefined && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {keyed(skill.notes, String).map(({ key, value }) => (
                <li key={key} className="whitespace-pre-line">
                  {value}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </article>
  );
}

function AboutFact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** Whether chance-to-cast items can cast the skill (skills.txt ItemEffect) */
function ProcNote({ record }: { readonly record: SkillCalcSkill }) {
  const trigger = itemTriggerInfo(record);
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">
        {trigger.value === 'yes' ? 'Item procs can cast this skill.' : 'Unknown whether item procs can cast this skill.'}
      </span>{' '}
      {trigger.reason}.
    </p>
  );
}

const INFO_LINK = 'inline-flex items-center gap-0.5 text-primary hover:underline';

/**
 * The skill's entry of ESR's skill information page: the main description when the game files have none, else a
 * labelled block under it. The entry's heading is shown when it names more skills than this one.
 */
function InfoPageText({ info, name, main }: { readonly info: SkillInfoText; readonly name: string; readonly main: boolean }) {
  const source = (
    <>
      <ExternalLink href={`${ESR_SKILL_INFO_URL}#oskills`} className={INFO_LINK} iconClassName="size-3">
        ESR skill information page
      </ExternalLink>
      {comparableName(info.heading) !== comparableName(name) && <> · {info.heading}</>}
    </>
  );
  const paragraphs = keyed(info.text, String).map(({ key, value }) => <p key={key}>{value}</p>);
  if (main) {
    return (
      <div className="space-y-1">
        <div className="space-y-0.5">{paragraphs}</div>
        <p className="text-xs text-muted-foreground">From the {source}</p>
      </div>
    );
  }
  return (
    <div className="space-y-0.5 border-l-2 pl-3">
      <p className="text-xs text-muted-foreground">{source}</p>
      {paragraphs}
    </div>
  );
}

/** A heading that differs from the skill name only by case or spacing ("Super Nova" / Supernova) is not shown */
function comparableName(name: string): string {
  return name.replace(/\s+/g, '').toLowerCase();
}

/** "Used by mercenaries": the hirelings that use the skill (ESR's skill information page) */
function Mercenaries({ mercenaries }: { readonly mercenaries: readonly SkillMercenary[] }) {
  return (
    <p>
      <span className="text-muted-foreground">Used by mercenaries: </span>
      {mercenaryGroups(mercenaries).map(({ hireling, subtypes }, i) => (
        <span key={hireling}>
          {i > 0 && ', '}
          {hireling}
          {subtypes.length > 0 && <span className="text-muted-foreground"> ({subtypes.join(', ')})</span>}
        </span>
      ))}{' '}
      <ExternalLink href={`${ESR_SKILL_INFO_URL}#mercenaries`} className={cn(INFO_LINK, 'text-xs')} iconClassName="size-3">
        Source
      </ExternalLink>
    </p>
  );
}

function SkillLinks({
  view,
  ids,
  onSelect,
}: {
  readonly view: SkillsView;
  readonly ids: readonly string[];
  readonly onSelect: (id: string) => void;
}) {
  return (
    <>
      {ids.map((id, i) => {
        const target = view.byId.get(id);
        return (
          <span key={id}>
            {i > 0 && ', '}
            {target === undefined ? (
              id
            ) : (
              <button
                type="button"
                className={LINK}
                onClick={() => {
                  onSelect(id);
                }}
              >
                {target.name}
              </button>
            )}
          </span>
        );
      })}
    </>
  );
}

interface GrantValuesProps {
  /** The skill's headline values at a level (the calculator); omitted while it is not available */
  readonly headline?: (level: number) => GrantHeadline;
  /** Sets the calculator's level (and names the item it came from) */
  readonly onPickLevel?: (level: number, from: string) => void;
  /** Levels below this are not offered as buttons (builds: the allocated points) */
  readonly minPickLevel?: number;
}

function GrantedBy({
  view,
  grants,
  mythicals,
  headline,
  onPickLevel,
  minPickLevel,
}: {
  readonly view: SkillsView;
  readonly grants: readonly SkillGrant[];
  readonly mythicals: ReadonlySet<string>;
} & GrantValuesProps) {
  if (grants.length === 0) {
    return <p className="text-xs text-muted-foreground">No unique, set item or runeword grants this skill.</p>;
  }
  return (
    <section aria-label="Granted by" className="space-y-3">
      {GRANT_GROUPS.map((group) => {
        const hows: readonly string[] = group.hows;
        const entries = grants.filter((grant) => hows.includes(grant.how));
        if (entries.length === 0) return null;
        return (
          <GrantGroup
            key={group.key}
            label={group.label}
            view={view}
            grants={entries}
            mythicals={mythicals}
            headline={headline}
            onPickLevel={onPickLevel}
            minPickLevel={minPickLevel}
          />
        );
      })}
    </section>
  );
}

function GrantGroup({
  label,
  view,
  grants,
  mythicals,
  headline,
  onPickLevel,
  minPickLevel,
}: {
  readonly label: string;
  readonly view: SkillsView;
  readonly grants: readonly SkillGrant[];
  readonly mythicals: ReadonlySet<string>;
} & GrantValuesProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? grants : grants.slice(0, GRANTS_SHOWN);
  // Many grants share a level: each level is evaluated once, from the current inputs (no cache across renders: the
  // values follow the synergy points and character level)
  const headlines = grantHeadlines(
    shown.flatMap((grant) => grantLevel(grant) ?? []),
    headline
  );
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label} ({String(grants.length)})
      </h4>
      <ul className="space-y-1">
        {keyed(shown, (grant) => JSON.stringify(grant)).map(({ key, value: grant }) => {
          const item = view.items.at(grant.item);
          if (item === undefined) return null;
          return (
            <li key={key} className="leading-snug">
              <Link
                to={itemPageUrl(item, mythicals)}
                className={cn('font-medium underline-offset-2 hover:underline', KIND_CLASS[item.kind])}
              >
                {item.name}
              </Link>
              <span className="text-xs text-muted-foreground"> · {ITEM_KIND_LABELS[item.kind]}</span>
              <div className="text-xs">{grantText(grant)}</div>
              <GrantValues
                grant={grant}
                headlines={headlines}
                onPickLevel={
                  onPickLevel === undefined
                    ? undefined
                    : (level) => {
                        onPickLevel(level, item.name);
                      }
                }
                minPickLevel={minPickLevel}
              />
            </li>
          );
        })}
      </ul>
      {grants.length > GRANTS_SHOWN && (
        <button
          type="button"
          className={cn(LINK, 'text-xs')}
          onClick={() => {
            setExpanded((value) => !value);
          }}
        >
          {expanded ? 'Show fewer' : `Show all ${String(grants.length)}`}
        </button>
      )}
    </div>
  );
}

/** The skill's headline values at a grant's level, with the level as a button that sets the calculator */
function GrantValues({
  grant,
  headlines,
  onPickLevel,
  minPickLevel,
}: {
  readonly grant: SkillGrant;
  readonly headlines: ReadonlyMap<number, GrantHeadline>;
  readonly onPickLevel?: (level: number) => void;
  readonly minPickLevel?: number;
}) {
  const level = grantLevel(grant);
  if (level === null) return null;
  const values = headlines.get(level);
  if (values === undefined || values.texts.length === 0) return null;
  const { texts, noHardPoints } = values;
  const belowBuild = minPickLevel !== undefined && level < minPickLevel;
  const suffix = noHardPoints ? ' (no hard points)' : '';
  return (
    <div className="text-xs text-muted-foreground">
      {onPickLevel === undefined || belowBuild ? (
        <span title={belowBuild ? `Below this build's ${String(minPickLevel)} points` : undefined}>Lvl {level}</span>
      ) : (
        <button
          type="button"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          title={`Show the values at level ${String(level)}${noHardPoints ? ' (the inline values here use no hard points)' : ''}`}
          onClick={() => {
            onPickLevel(level);
          }}
        >
          Lvl {level}
        </button>
      )}
      {' – '}
      {texts.join(' · ')}
      {suffix}
    </div>
  );
}
