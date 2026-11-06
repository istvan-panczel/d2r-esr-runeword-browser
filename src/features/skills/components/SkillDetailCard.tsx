import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { SkillCalcSkill, SkillDetail, SkillGrant } from '@/features/game-data/engine/schema';
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
import { useSkillCalc } from '../hooks/useSkillCalc';
import {
  grantLevel,
  headlineKeys,
  headlineTexts,
  QUICK_LEVELS,
  resolveSynergyPoints,
  synergyTexts,
  withSynergyPoints,
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
  skillContext,
  type SkillsView,
} from '../utils/skills';
import { LevelInput } from './LevelInput';
import { SkillIcon } from './SkillIcon';
import { SkillLevelValues, type SkillLevelsConfig } from './SkillLevelValues';

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
  /** Rendered right after the header (the builds pages' point controls / counter) */
  readonly children?: ReactNode;
  /** The per-level values (skill calculator) and how the page drives them; omitted = only the fixed lines */
  readonly levels?: SkillLevelsConfig;
}

/** A tag chip with an explanation on hover */
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
  readonly rows: readonly SkillTableRow[];
  readonly tableOptions: Omit<SkillCalcOptions, 'level'>;
  /** The skill's headline lines at an item's level (no hard points: items never give any) */
  readonly headline: (level: number) => string[];
}

function evaluateCalc(record: SkillCalcSkill, index: SkillCalcIndex, config: SkillLevelsConfig): CalcResults {
  const { level, charLevel, synergy } = config.state;
  const inputs = synergyInputs(record, index);
  const synergyPoints = resolveSynergyPoints(inputs, synergy);
  const tableOptions = { charLevel, synergyPoints, hardPoints: config.hardPoints };
  const results = evaluateSkill(record, index, defaultContext(record, { ...tableOptions, level }));
  const rows = skillTable(record, index, QUICK_LEVELS, tableOptions);
  const keys = headlineKeys(rows);
  const headline = (at: number) =>
    keys.length === 0
      ? []
      : headlineTexts(evaluateSkill(record, index, defaultContext(record, { level: at, hardPoints: 0, charLevel, synergyPoints })), keys);
  return { record, index, config, inputs, synergyPoints, results, rows, tableOptions, headline };
}

function calcTags(record: SkillCalcSkill): FactTag[] {
  const tags: FactTag[] = [];
  if (record.scalesWithCharLevel === true)
    tags.push({ label: 'Scales with character level', title: 'Some values grow with the character level, not only the skill level' });
  if (record.scalesWithHardPointsOnly === true)
    tags.push({
      label: 'Scales with hard points only',
      title: 'Part of the effect grows only with points you put into the skill: +skills from items do not raise that part',
    });
  const trigger = itemTriggerInfo(record);
  tags.push(
    trigger.value === 'yes'
      ? { label: 'Item procs can cast this', title: trigger.reason }
      : { label: 'Unknown whether item procs can cast this', title: trigger.reason }
  );
  return tags;
}

/** Everything the files say about one skill: scalars, description, synergies and the items that grant it. */
export function SkillDetailCard({ view, skill, mythicals, onSelect, onClose, className, children, levels }: SkillDetailCardProps) {
  const unlocks = dependents(view, skill.id);
  const calc = useSkillCalc();
  const valuesRef = useRef<HTMLElement>(null);
  const record = levels === undefined ? undefined : calc.index?.record(skill.id);
  const active =
    levels !== undefined && calc.index !== undefined && record !== undefined && record.lines.length > 0
      ? evaluateCalc(record, calc.index, levels)
      : null;
  const synergyValues = active === null || skill.synergies === undefined ? [] : synergyTexts(skill.synergies, active.results);
  const pickLevel =
    active === null
      ? undefined
      : (level: number) => {
          active.config.onChange({ level });
          valuesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        };
  const facts = [
    skill.cls === null ? null : `Required level ${String(skill.reqLevel)}`,
    `Max level ${String(skill.maxLevel)}`,
    skill.mana === undefined ? null : `Mana ${formatMana(skill.mana)}`,
    skill.element === undefined ? null : `${skill.element} damage`,
    skill.type === 'aura' ? 'Aura' : skill.type === 'passive' ? 'Passive' : null,
  ].filter((fact) => fact !== null);

  return (
    <article aria-label={skill.name} className={cn('space-y-4 rounded-lg border bg-card p-4 text-sm', className)}>
      <header className="flex items-start gap-3">
        <SkillIcon icon={skill.icon} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-tight font-semibold">{skill.name}</h2>
          <p className="text-xs text-muted-foreground">{skillContext(view, skill)}</p>
          {skill.id !== skill.name && <p className="text-xs text-muted-foreground">skills.txt: {skill.id}</p>}
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

      <ul className="flex flex-wrap gap-1.5">
        {facts.map((fact) => (
          <li key={fact} className="rounded-full border bg-background px-2 py-0.5 text-xs">
            {fact}
          </li>
        ))}
        {record !== undefined &&
          calcTags(record).map((tag) => (
            <li
              key={tag.label}
              title={tag.title}
              className="cursor-help rounded-full border border-dashed bg-background px-2 py-0.5 text-xs"
            >
              {tag.label}
            </li>
          ))}
      </ul>

      {skill.description.length > 0 && (
        <div className="space-y-0.5">
          {keyed(descriptionParagraphs(skill.description), String).map(({ key, value }) => (
            <p key={key}>{value}</p>
          ))}
        </div>
      )}

      {levels !== undefined && calc.status === 'loading' && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Spinner className="size-3" />
          Loading the values per level…
        </p>
      )}
      {levels !== undefined && calc.status === 'error' && (
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
          hasSynergies={active.inputs.length > 0}
          sectionRef={valuesRef}
        />
      ) : (
        skill.lines !== undefined && (
          <ul className="space-y-0.5 text-blue-700 dark:text-blue-300">
            {keyed(skill.lines, String).map(({ key, value }) => (
              <li key={key} className="whitespace-pre-line">
                {value}
              </li>
            ))}
          </ul>
        )
      )}

      {(skill.reqSkills !== undefined || unlocks.length > 0) && (
        <div className="space-y-1">
          {skill.reqSkills !== undefined && (
            <p>
              <span className="text-muted-foreground">Requires: </span>
              <SkillLinks view={view} ids={skill.reqSkills} onSelect={onSelect} />
            </p>
          )}
          {unlocks.length > 0 && (
            <p>
              <span className="text-muted-foreground">Unlocks: </span>
              <SkillLinks view={view} ids={unlocks.map((entry) => entry.id)} onSelect={onSelect} />
            </p>
          )}
        </div>
      )}

      {skill.synergies !== undefined && (
        <section className="space-y-1">
          <h3 className="flex items-baseline justify-between gap-2 font-semibold">
            Receives bonuses from
            {active !== null && active.inputs.length > 0 && <span className="text-xs font-normal text-muted-foreground">Hard points</span>}
          </h3>
          <ul className="space-y-0.5">
            {keyed(
              skill.synergies.map((synergy, i) => ({ synergy, text: synergyValues[i] ?? synergy.text })),
              ({ synergy }) => `${synergy.name}:${synergy.text ?? ''}`
            ).map(({ key, value: { synergy, text } }) => {
              const target = view.byId.get(synergy.id ?? synergy.name);
              const input = active?.inputs.find((entry) => entry.id === (synergy.id ?? synergy.name));
              return (
                <li key={key} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {target === undefined ? (
                      <span className="font-medium">{synergy.name}</span>
                    ) : (
                      <button
                        type="button"
                        className={LINK}
                        onClick={() => {
                          onSelect(target.id);
                        }}
                      >
                        {synergy.name}
                      </button>
                    )}
                    {text !== undefined && <span className="text-muted-foreground">: {text}</span>}
                  </div>
                  {active !== null && input !== undefined && (
                    <LevelInput
                      value={active.synergyPoints[input.id] ?? 0}
                      min={0}
                      max={input.max}
                      aria-label={`Hard points in ${synergy.name} (0 to ${String(input.max)})`}
                      className="h-7 w-14 shrink-0"
                      onCommit={(points) => {
                        active.config.onChange({
                          synergy: withSynergyPoints(active.inputs, active.config.state.synergy, input.id, points),
                        });
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {skill.notes !== undefined && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {keyed(skill.notes, String).map(({ key, value }) => (
            <li key={key} className="whitespace-pre-line">
              {value}
            </li>
          ))}
        </ul>
      )}

      <GrantedBy view={view} grants={skill.grantedBy ?? []} mythicals={mythicals} headline={active?.headline} onPickLevel={pickLevel} />
    </article>
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
  readonly headline?: (level: number) => string[];
  /** Sets the calculator's level */
  readonly onPickLevel?: (level: number) => void;
}

function GrantedBy({
  view,
  grants,
  mythicals,
  headline,
  onPickLevel,
}: {
  readonly view: SkillsView;
  readonly grants: readonly SkillGrant[];
  readonly mythicals: ReadonlySet<string>;
} & GrantValuesProps) {
  if (grants.length === 0) {
    return <p className="text-xs text-muted-foreground">No unique, set item or runeword grants this skill.</p>;
  }
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">
        Granted by <span className="font-normal text-muted-foreground">({String(grants.length)})</span>
      </h3>
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
}: {
  readonly label: string;
  readonly view: SkillsView;
  readonly grants: readonly SkillGrant[];
  readonly mythicals: ReadonlySet<string>;
} & GrantValuesProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? grants : grants.slice(0, GRANTS_SHOWN);
  // Many grants share a level: evaluate each level once per render
  const valuesAt = new Map<number, string[]>();
  const headlineAt = (level: number): string[] => {
    if (headline === undefined) return [];
    let values = valuesAt.get(level);
    if (values === undefined) {
      values = headline(level);
      valuesAt.set(level, values);
    }
    return values;
  };
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
              <GrantValues grant={grant} values={headlineAt} onPickLevel={onPickLevel} />
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
  values,
  onPickLevel,
}: {
  readonly grant: SkillGrant;
  readonly values: (level: number) => string[];
  readonly onPickLevel?: (level: number) => void;
}) {
  const level = grantLevel(grant);
  if (level === null) return null;
  const texts = values(level);
  if (texts.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      {onPickLevel === undefined ? (
        <span>Lvl {level}</span>
      ) : (
        <button
          type="button"
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          title={`Show the values at level ${String(level)}`}
          onClick={() => {
            onPickLevel(level);
          }}
        >
          Lvl {level}
        </button>
      )}
      {' – '}
      {texts.join(' · ')}
    </div>
  );
}
