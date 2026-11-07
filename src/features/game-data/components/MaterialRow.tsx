import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MaterialFamilyUse, MaterialItem } from '../engine/schema';
import { formatCount } from '../utils/cube';
import { cubeFamilyHref, enhanceHref, levelText } from '../utils/materials';
import { CellIcon } from './CellIcon';

/** Used-in chips shown before "+N more" */
const USED_IN_SHOWN = 6;

const CHIP = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-tight';
const LINK_CHIP = cn(CHIP, 'bg-background transition-colors hover:bg-accent');

function FamilyChip({ use, label, prefix }: { readonly use: MaterialFamilyUse; readonly label: string; readonly prefix?: string }) {
  return (
    <Link to={cubeFamilyHref(use.family)} className={LINK_CHIP} title={`${formatCount(use.recipes)} cube recipes on the Cube Recipes page`}>
      {prefix}
      {label}
      <span className="text-muted-foreground">{formatCount(use.recipes)}</span>
    </Link>
  );
}

function Line({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-start gap-x-2">
      <dt className="pt-0.5 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap gap-1">{children}</dd>
    </div>
  );
}

interface MaterialRowProps {
  readonly item: MaterialItem;
  readonly familyLabel: (id: string) => string;
  /** Guide notes for the item (slug + title) */
  readonly notes: readonly { slug: string; title: string }[];
}

/** One material: name and code, how to get it, what uses it (cube families, Enhance) and the guide notes about it */
export function MaterialRow({ item, familyLabel, notes }: MaterialRowProps) {
  const [allUses, setAllUses] = useState(false);
  const level = levelText(item);
  const otherSources = item.sources.filter((source) => source.kind !== 'cube');
  const uses = allUses ? item.usedIn : item.usedIn.slice(0, USED_IN_SHOWN);
  const hidden = item.usedIn.length - uses.length;
  const enhance = item.enhance ?? [];

  return (
    <li className="space-y-1.5 px-3 py-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <CellIcon item={{ kind: 'item', code: item.code }} />
          <span className="font-medium">{item.name}</span>
        </span>
        <code className="text-xs text-muted-foreground">{item.code}</code>
        {item.variants !== undefined && (
          <span className="text-xs text-muted-foreground" title="Rows of misc.txt shown as this one">
            {formatCount(item.variants)} variants
          </span>
        )}
        {level !== '' && <span className="ml-auto text-xs text-muted-foreground">{level}</span>}
      </div>
      <dl className="space-y-1 sm:pl-[2.125rem]">
        <Line label="How to get">
          {item.madeBy.map((use) => (
            <FamilyChip key={use.family} use={use} label={familyLabel(use.family)} prefix="Cube: " />
          ))}
          {otherSources.map((source) => (
            <span key={`${source.kind}-${source.text}`} className={cn(CHIP, source.kind === 'unknown' && 'text-muted-foreground')}>
              {source.text}
            </span>
          ))}
        </Line>
        {(item.usedIn.length > 0 || enhance.length > 0) && (
          <Line label="Used in">
            {enhance.map((role) => (
              <Link
                key={`${role.tab}-${role.label}`}
                to={enhanceHref(role)}
                className={cn(LINK_CHIP, 'border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20')}
              >
                {role.label}
              </Link>
            ))}
            {uses.map((use) => (
              <FamilyChip key={use.family} use={use} label={familyLabel(use.family)} />
            ))}
            {hidden > 0 && (
              <button
                type="button"
                className="text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                onClick={() => {
                  setAllUses(true);
                }}
              >
                +{hidden} more
              </button>
            )}
          </Line>
        )}
        {notes.length > 0 && (
          <Line label="Guide">
            {notes.map((note) => (
              <Link
                key={note.slug}
                to={`/guide/${note.slug}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
              >
                <BookOpen className="size-3" aria-hidden />
                {note.title}
              </Link>
            ))}
          </Line>
        )}
      </dl>
    </li>
  );
}
