import { cn } from '@/lib/utils';
import type { Affix, BonusPool, ColumnBonusPools, SocketableBonusGroup, SocketableBonuses } from '@/core/db/models';
import { getCategoryLabel, type BonusCategory } from '@/core/utils/itemCategoryMapping';
import { firstNonEmptyPools, hasColumnDifferences, hasPoolColumnDifferences } from '@/core/utils/columnAffixes';
import type { BonusTextsByCategory } from '@/core/utils/socketableLookup';
import { SkillRefText } from '@/features/skills/components/SkillRefText';
import type { SkillRefItem } from '@/features/skills/utils/skillRefs';

interface RecipeAffixesProps {
  readonly affixes: readonly Affix[];
  /** Per-column affixes; undefined for old cached data */
  readonly columnAffixes: SocketableBonuses | undefined;
  /** Per-column random bonus pools (gemwords); undefined for runewords and old cached data */
  readonly columnBonusPools?: ColumnBonusPools;
  readonly allowedItems: readonly string[];
  readonly categories: readonly BonusCategory[];
  /** The runeword / gemword (its skill lines link to the skill it grants) */
  readonly skillItem?: SkillRefItem;
}

/** A recipe's own bonuses (then its random bonus pools): one list, or one column per category when they differ. */
export function RecipeAffixes({ affixes, columnAffixes, columnBonusPools, allowedItems, categories, skillItem }: RecipeAffixesProps) {
  if (affixes.length === 0) return null;

  return (
    <div className="text-center">
      <p className="font-medium text-muted-foreground mb-1">Bonuses:</p>
      {columnAffixes && hasColumnDifferences(columnAffixes, categories) ? (
        <BonusColumns
          allowedItems={allowedItems}
          categories={categories}
          linesFor={(category) => columnAffixes[category].map((affix) => affix.rawText)}
          skillItem={skillItem}
        />
      ) : (
        <BonusList lines={affixes.map((affix) => affix.rawText)} skillItem={skillItem} />
      )}
      {columnBonusPools && (
        <RecipeBonusPools columnBonusPools={columnBonusPools} allowedItems={allowedItems} categories={categories} skillItem={skillItem} />
      )}
    </div>
  );
}

interface RecipeBonusPoolsProps {
  readonly columnBonusPools: ColumnBonusPools;
  readonly allowedItems: readonly string[];
  readonly categories: readonly BonusCategory[];
  readonly skillItem: SkillRefItem | undefined;
}

/** Random bonus pools ("1-2 of the following:"): shown once, or per category when they differ. */
function RecipeBonusPools({ columnBonusPools, allowedItems, categories, skillItem }: RecipeBonusPoolsProps) {
  if (hasPoolColumnDifferences(columnBonusPools, categories)) {
    return (
      <div className="mt-3 grid grid-cols-2 gap-3">
        {categories.map((category) => {
          const pools = columnBonusPools[category];
          if (pools.length === 0) return null;
          return (
            <div key={category}>
              <p className="font-medium text-muted-foreground text-xs mb-1">{getCategoryLabel(allowedItems, category)}:</p>
              <BonusPoolList pools={pools} skillItem={skillItem} />
            </div>
          );
        })}
      </div>
    );
  }

  const pools = firstNonEmptyPools(columnBonusPools);
  if (pools.length === 0) return null;
  return <BonusPoolList pools={pools} className="mt-3" skillItem={skillItem} />;
}

interface BonusPoolListProps {
  readonly pools: readonly BonusPool[];
  readonly className?: string;
  readonly skillItem: SkillRefItem | undefined;
}

function BonusPoolList({ pools, className, skillItem }: BonusPoolListProps) {
  return (
    <div className={cn('space-y-2 text-xs', className)}>
      {pools.map((pool, index) => (
        <div key={`${String(index)}-${pool.label}`} className="rounded-md border border-dashed px-2 py-1.5">
          <p className="italic text-muted-foreground mb-0.5">{pool.label}</p>
          <ul className="space-y-0.5 text-[#8080E6]">
            {pool.affixes.map((affix, lineIndex) => (
              <li key={`${String(lineIndex)}-${affix.rawText}`}>
                <SkillRefText line={affix.rawText} item={skillItem} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface SocketableBonusesSectionProps {
  readonly title: string;
  readonly bonuses: BonusTextsByCategory | undefined;
  readonly allowedItems: readonly string[];
  readonly categories: readonly BonusCategory[];
}

/** Aggregated bonuses of the recipe's socketables (runes/gems), per relevant category. */
export function SocketableBonusesSection({ title, bonuses, allowedItems, categories }: SocketableBonusesSectionProps) {
  if (!bonuses || !categories.some((category) => bonuses[category].length > 0)) return null;

  return (
    <div className="border-t pt-3">
      <p className="font-medium text-muted-foreground mb-2 text-center">{title}</p>
      {categories.length === 1 ? (
        <BonusList lines={bonuses[categories[0]]} className="text-center" />
      ) : (
        <BonusColumns allowedItems={allowedItems} categories={categories} linesFor={(category) => bonuses[category]} />
      )}
    </div>
  );
}

interface SocketableBonusGroupsSectionProps {
  readonly title: string;
  /** The page's socketable bonus groups (ESR 3.3+) */
  readonly groups: readonly SocketableBonusGroup[];
  /** Indexes of the groups to show (a build slot or base); all when omitted */
  readonly shown?: readonly number[];
}

/**
 * The recipe's socketable (rune / gem) bonuses as the ESR page lists them: one list when one group applies (labelled
 * when it has a label), else one labelled list per item-type group.
 */
export function SocketableBonusGroupsSection({ title, groups, shown }: SocketableBonusGroupsSectionProps) {
  const visible = groups.filter((group, index) => group.affixes.length > 0 && (shown === undefined || shown.includes(index)));
  if (visible.length === 0) return null;

  const [only] = visible;
  return (
    <div className="border-t pt-3">
      <p className="font-medium text-muted-foreground mb-2 text-center">{title}</p>
      {visible.length === 1 ? (
        <div className="text-center">
          {only.label && <p className="font-medium text-muted-foreground text-xs mb-1">{only.label}:</p>}
          <BonusList lines={only.affixes.map((affix) => affix.rawText)} />
        </div>
      ) : (
        <LabelledColumns
          columns={visible.map((group, index) => ({
            key: `${String(index)}-${group.label}`,
            label: group.label,
            lines: group.affixes.map((affix) => affix.rawText),
          }))}
        />
      )}
    </div>
  );
}

interface BonusListProps {
  readonly lines: readonly string[];
  readonly className?: string;
  /** The recipe the lines belong to; omitted for socketable bonuses */
  readonly skillItem?: SkillRefItem;
}

function BonusList({ lines, className, skillItem }: BonusListProps) {
  return (
    <ul className={cn('space-y-0.5 text-[#8080E6]', className)}>
      {lines.map((line, index) => (
        <li key={`${String(index)}-${line}`}>
          <SkillRefText line={line} item={skillItem} />
        </li>
      ))}
    </ul>
  );
}

interface BonusColumnsProps {
  readonly allowedItems: readonly string[];
  readonly categories: readonly BonusCategory[];
  readonly linesFor: (category: BonusCategory) => readonly string[];
  readonly skillItem?: SkillRefItem;
}

/** Two-column grid with one labelled list per category; empty categories are skipped. */
function BonusColumns({ allowedItems, categories, linesFor, skillItem }: BonusColumnsProps) {
  return (
    <LabelledColumns
      columns={categories.map((category) => ({
        key: category,
        label: getCategoryLabel(allowedItems, category),
        lines: linesFor(category),
      }))}
      skillItem={skillItem}
    />
  );
}

interface LabelledColumn {
  readonly key: string;
  readonly label: string;
  readonly lines: readonly string[];
}

interface LabelledColumnsProps {
  readonly columns: readonly LabelledColumn[];
  readonly skillItem?: SkillRefItem;
}

/** Two-column grid with one labelled list per column; empty columns are skipped. */
function LabelledColumns({ columns, skillItem }: LabelledColumnsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      {columns.map(({ key, label, lines }) => {
        if (lines.length === 0) return null;
        return (
          <div key={key}>
            <p className="font-medium text-muted-foreground text-xs mb-1">{label}:</p>
            <ul className="space-y-0.5 text-[#8080E6] text-xs">
              {lines.map((line, index) => (
                <li key={`${String(index)}-${line}`}>
                  <SkillRefText line={line} item={skillItem} />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
