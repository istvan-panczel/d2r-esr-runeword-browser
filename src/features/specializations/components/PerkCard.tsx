import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { gameDataUrl } from '@/features/game-data/engine/browser/loadGameData';
import type { SpecializationPageDiff, SpecializationPerk, SpecializationTree } from '@/features/game-data/engine/schema';
import { enhanceTabHref } from '@/features/game-data/utils/cube';
import { MASTERY_GUIDE_PATH, WEAPON_MASTERIES_PATH } from '@/features/game-data/utils/masteries';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { LINK_CLASS } from '@/features/ascendancies/components/styles';
import { elixirHref } from '@/features/elixirs/utils/elixirsView';
import { specializationSlug } from '@/features/game-data/engine/specializationLinks';
import { perkAnchor, percentText, settingText, specializationsParams } from '../utils/specializationsView';

const COLUMN_NAMES = ['left', 'middle', 'right'];
/** Formula item names shown before "and N more" */
const ITEMS_SHOWN = 6;

interface PerkIconProps {
  /** specializations.json `icon` key; undefined renders the empty frame */
  readonly icon: string | undefined;
  readonly size: number;
  readonly className?: string;
}

/** The perk's HD icon (icons/specializations/<key>.webp, a round socket), or an empty circle when it has none or fails */
export function PerkIcon({ icon, size, className }: PerkIconProps) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = icon !== undefined && failed !== icon;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted', className)}
      style={{ width: size, height: size }}
    >
      {show && (
        <img
          src={gameDataUrl(`icons/specializations/${icon}.webp`)}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          alt=""
          draggable={false}
          className="size-full"
          onError={() => {
            setFailed(icon);
          }}
        />
      )}
    </span>
  );
}

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <li>
      <span className="text-muted-foreground">{label}: </span>
      {children}
    </li>
  );
}

/** An item name; an elixir links to its card on the Elixirs page (`/elixirs?name=<kebab name>`) */
function ItemName({ name }: { readonly name: string }) {
  if (!/^(Greater )?Elixir of /.test(name)) return name;
  return (
    <Link to={elixirHref(specializationSlug(name))} className={LINK_CLASS}>
      {name}
    </Link>
  );
}

function itemList(names: readonly string[]): ReactNode[] {
  return names.flatMap((name, i) => [...(i === 0 ? [] : [', ']), <ItemName key={name} name={name} />]);
}

function joined(parts: readonly ReactNode[]): ReactNode[] {
  return parts.flatMap((part, i) => (i === 0 ? [part] : ['; ', part]));
}

interface PerkCardProps {
  readonly tree: SpecializationTree;
  readonly perk: SpecializationPerk;
  readonly focused: boolean;
  /** The official page's differences about this perk */
  readonly diffs: readonly SpecializationPageDiff[];
}

/**
 * One perk: icon, title (a link to the perk's own URL), row and column, the description from the game strings, then
 * what the files say about it: plugin settings, cube recipes, drops behind the perk, formulas, Enhance and weapon
 * mastery links, notes, and where the official page reads differently.
 */
export function PerkCard({ tree, perk, focused, diffs }: PerkCardProps) {
  const href = `?${specializationsParams(tree.slug, perk.slug).toString()}`;
  const items = perk.items ?? [];
  const facts: ReactNode[] = [];
  if (perk.plugin !== undefined) {
    facts.push(
      <Fact key="plugin" label="Plugin">
        <code className="text-xs">{perk.plugin.file}</code> <code className="text-xs">[{perk.plugin.section}]</code>
        {perk.plugin.values.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1">
            {perk.plugin.values.map((value) => (
              <code key={value.key} className="rounded border bg-muted/50 px-1.5 py-0.5 text-[11px]">
                {settingText(value)}
              </code>
            ))}
          </span>
        )}
      </Fact>
    );
  }
  if (perk.cube !== undefined) {
    facts.push(
      <Fact key="cube" label="Cube recipes">
        {joined(
          perk.cube.map((link) => (
            <span key={`${link.family}-${String(link.has)}`}>
              <Link to={cubeFamilyHref(link.family)} className={LINK_CLASS}>
                {link.label}
              </Link>{' '}
              ({link.rows} {link.rows === 1 ? 'row' : 'rows'}
              {link.has ? '' : ', only without the perk'})
            </span>
          ))
        )}
      </Fact>
    );
  }
  if (perk.drops !== undefined) {
    facts.push(
      <Fact key="drops" label="Drops only with the perk">
        <ul className="mt-0.5 list-disc space-y-0.5 pl-4">
          {perk.drops.map((drop) => (
            <li key={drop.tc}>
              <span className="font-medium">{drop.tc}</span>
              {drop.shares !== undefined && <> ({drop.shares.map(percentText).join(' / ')} of the picks)</>}
              {drop.picks > 1 && <>, {drop.picks} picks</>}: {itemList(drop.items)}
            </li>
          ))}
        </ul>
      </Fact>
    );
  }
  if (items.length > 0) {
    const more = items.length - ITEMS_SHOWN;
    facts.push(
      <Fact key="items" label="Read by the formulas of">
        {itemList(items.slice(0, ITEMS_SHOWN))}
        {more > 0 && ` and ${String(more)} more`}
      </Fact>
    );
  }
  if (perk.skillRows !== undefined) {
    facts.push(
      <Fact key="skills" label="Also read by">
        {perk.skillRows} skills.txt {perk.skillRows === 1 ? 'row' : 'rows'} (item auras and passives)
      </Fact>
    );
  }
  for (const link of perk.enhance ?? []) {
    facts.push(
      <Fact key={`enhance-${link.tab}`} label="Enhance">
        <Link to={enhanceTabHref(link.tab)} className={LINK_CLASS}>
          {link.text}
        </Link>
      </Fact>
    );
  }
  if (perk.anyWeaponMastery === true) {
    facts.push(
      <Fact key="mastery" label="Weapon mastery">
        any weapon takes any mastery (
        <Link to={MASTERY_GUIDE_PATH} className={LINK_CLASS}>
          guide
        </Link>
        ,{' '}
        <Link to={WEAPON_MASTERIES_PATH} className={LINK_CLASS}>
          all masteries
        </Link>
        )
      </Fact>
    );
  }

  return (
    <article
      id={perkAnchor(perk.slug)}
      aria-current={focused ? 'true' : undefined}
      className={cn(
        'flex h-full scroll-mt-24 flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm transition-shadow',
        focused && 'ring-2 ring-primary'
      )}
    >
      <header className="flex items-center gap-3">
        <PerkIcon icon={perk.icon} size={48} />
        <div className="min-w-0">
          <h3 className="font-semibold">
            <Link to={href} replace preventScrollReset className="hover:underline">
              {perk.title}
            </Link>
          </h3>
          <p className="text-xs text-muted-foreground">
            Row {perk.row} · {COLUMN_NAMES.at(perk.column - 1) ?? `column ${String(perk.column)}`}
          </p>
        </div>
      </header>
      <p className="text-sm">{perk.description}</p>
      {facts.length > 0 && <ul className="space-y-1 border-t pt-2 text-xs">{facts}</ul>}
      {(perk.notes ?? []).map((note) => (
        <p key={note} className="rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-xs">
          {note}
        </p>
      ))}
      {diffs.map((diff) => (
        <p key={diff.subject} className="rounded-md border border-amber-600/40 bg-amber-500/10 px-2 py-1 text-xs">
          The official page reads differently ({diff.subject.replace(`${tree.name} › `, '')}): &ldquo;{diff.page}&rdquo;. The game files:
          &ldquo;
          {diff.files}&rdquo;.
        </p>
      ))}
    </article>
  );
}
