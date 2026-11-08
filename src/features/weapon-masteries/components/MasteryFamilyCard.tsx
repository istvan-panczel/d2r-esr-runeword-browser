import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import { ItemIcon } from '@/features/game-data/components/ItemIcon';
import { MasteryEffectText, MasteryRecipe } from '@/features/game-data/components/MasteryParts';
import type { ClassCode, MasteriesBundle, WeaponMastery } from '@/features/game-data/engine/schema';
import { inputText, masteryBasesUrl } from '@/features/game-data/utils/masteries';
import { diffsForMastery, masteriesParams, masteryAnchor, modLine, optionGem, type MasteryFamily } from '../utils/masteriesView';

const NOTE_CLASS = 'rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-xs';

interface MasteryFamilyCardProps {
  readonly family: MasteryFamily;
  readonly bundle: MasteriesBundle;
  /** The class chip, kept in the card's own link */
  readonly cls: ClassCode | null;
  /** The focused mastery's slug */
  readonly focused: string | null;
}

function OptionBlock({
  family,
  option,
  index,
  bundle,
  cls,
  focused,
}: {
  readonly family: MasteryFamily;
  readonly option: WeaponMastery;
  readonly index: number;
  readonly bundle: MasteriesBundle;
  readonly cls: ClassCode | null;
  readonly focused: boolean;
}) {
  const { names, skillNames } = bundle;
  const many = family.options.length > 1;
  const gem = optionGem(option, family, names);
  const diffs = diffsForMastery(bundle, option.slug);
  const href = `?${masteriesParams(cls, option.slug).toString()}`;
  return (
    <div
      id={masteryAnchor(option.slug)}
      aria-current={focused ? 'true' : undefined}
      className={cn('space-y-1.5 rounded-md', many && 'border-l-2 border-muted pl-2', focused && 'ring-2 ring-primary')}
    >
      {many && (
        <h4 className="text-xs font-medium">
          <Link to={href} replace preventScrollReset className="hover:underline">
            Option {index + 1}
            {gem !== null && <span className="font-normal text-muted-foreground"> · {gem}</span>}
          </Link>
        </h4>
      )}
      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span>Weapon +</span>
        <MasteryRecipe mastery={option} names={names} />
      </div>
      {option.effects.map((effect) => (
        <MasteryEffectText key={effect.heading} effect={effect} skillNames={skillNames} />
      ))}
      {option.mods?.map((mod) => {
        const { text, note } = modLine(mod);
        return (
          <p key={mod} className="text-blue-700 dark:text-blue-400">
            {text}
            {note !== null && <span className="text-xs text-muted-foreground"> (no item line: {note})</span>}
          </p>
        );
      })}
      {option.pageNotes?.map((note) => (
        <p key={note} className="text-xs text-muted-foreground">
          <span className="font-medium">Official page only:</span> {note}.
        </p>
      ))}
      {diffs.map((diff) => (
        <p key={diff.subject} className={NOTE_CLASS}>
          The official page reads differently: &ldquo;{diff.page}&rdquo;. The game files: &ldquo;{diff.files}&rdquo;
        </p>
      ))}
    </div>
  );
}

/**
 * One weapon family: its art and bases, then one block per option (the recipe, what it does, the other mods, what only
 * the official page says, where the page reads differently), then the removal.
 */
export function MasteryFamilyCard({ family, bundle, cls, focused }: MasteryFamilyCardProps) {
  const [first] = family.options;
  const firstBase = first.bases.at(0);
  // Two codes can share a name (Scissors Suwayyah)
  const baseNames = [...new Set(first.bases.map((code) => bundle.baseNames[code] ?? code))];
  const href = `?${masteriesParams(cls, first.slug).toString()}`;
  const remove = first.remove.map((input) => inputText(input, bundle.names)).join(' + ');
  const missing = (key: 'noAwaken' | 'noRemove') => [...new Set(family.options.flatMap((option) => option[key] ?? []))];
  const noAwaken = missing('noAwaken');
  const noRemove = missing('noRemove');
  const nameOfBase = (code: string) => bundle.baseNames[code] ?? code;
  return (
    <article className="flex h-full flex-col gap-2 rounded-xl border bg-card p-3 text-sm shadow-sm">
      <header className="flex items-center gap-3">
        {firstBase !== undefined && <ItemIcon item={{ kind: 'base', code: firstBase }} size={48} />}
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link to={href} replace preventScrollReset className="hover:underline">
              {family.label}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            {baseNames.length} {baseNames.length === 1 ? 'base' : 'bases'}
            {family.options.length > 1 && ` · pick 1 of ${String(family.options.length)}`}
          </p>
        </div>
      </header>
      <p className="text-xs">
        <span className="text-muted-foreground">Bases: </span>
        {baseNames.join(', ')}.{' '}
        <Link to={masteryBasesUrl(first)} className={LINK_CLASS}>
          See them on the Bases page
        </Link>
      </p>
      <div className="space-y-2.5">
        {family.options.map((option, index) => (
          <OptionBlock
            key={option.property}
            family={family}
            option={option}
            index={index}
            bundle={bundle}
            cls={cls}
            focused={focused === option.slug}
          />
        ))}
      </div>
      {remove !== '' && (
        <p className="border-t pt-2 text-xs text-muted-foreground">
          <span className="font-medium">To remove: </span>
          Weapon + {remove} (the token is lost).
        </p>
      )}
      {(noAwaken.length > 0 || noRemove.length > 0) && (
        <p className={NOTE_CLASS}>
          The game files have no {noAwaken.length > 0 && <>awaken recipe for {noAwaken.map(nameOfBase).join(', ')}</>}
          {noAwaken.length > 0 && noRemove.length > 0 && ' or '}
          {noRemove.length > 0 && <>remove recipe for {noRemove.map(nameOfBase).join(', ')}</>} (likely a data slip).
        </p>
      )}
    </article>
  );
}
