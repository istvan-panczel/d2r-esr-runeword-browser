import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BaseItem, ItemTypeInfo, TypesBundle } from '../engine/schema';
import { GAME_DATA_URL_PARAM_KEYS } from '../constants/urlParams';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import { buildTypeTree, type TypeTree } from '../utils/typeTree';

const TYPES_FILES = ['types', 'bases'] as const;

export function ItemTypesScreen() {
  const gameData = useGameData(TYPES_FILES);
  const [searchParams] = useSearchParams();
  const focus = searchParams.get(GAME_DATA_URL_PARAM_KEYS.TYPE);

  if (gameData.status === 'loading') return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  // Re-mount when the focused type changes so the expansion is recomputed
  return <ItemTypesBrowser key={focus ?? ''} typesBundle={gameData.data.types} bases={gameData.data.bases.bases} focus={focus} />;
}

interface ItemTypesBrowserProps {
  readonly typesBundle: TypesBundle;
  readonly bases: readonly BaseItem[];
  readonly focus: string | null;
}

function basesLink(code: string): string {
  return `/bases?${GAME_DATA_URL_PARAM_KEYS.TYPE}=${encodeURIComponent(code)}`;
}

function socketsLabel(type: ItemTypeInfo): string {
  const [s1, s2, s3] = type.sockets;
  const [t1, t2] = type.thresholds;
  return `${String(s1)} (ilvl ≤ ${String(t1)}) / ${String(s2)} (≤ ${String(t2)}) / ${String(s3)}`;
}

function ItemTypesBrowser({ typesBundle, bases, focus }: ItemTypesBrowserProps) {
  const { types, classes } = typesBundle;
  const typeByCode = new Map(types.map((type) => [type.code, type]));
  const classNames = new Map<string, string>(classes.map((cls) => [cls.code, cls.name]));
  const tree = buildTypeTree(types, bases);
  const focusType = focus === null ? undefined : typeByCode.get(focus);

  // Expansion is keyed by code: expanding a type opens it everywhere it appears in the tree
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(focusType ? focusType.ancestors.filter((code) => code !== focusType.code) : [])
  );

  useEffect(() => {
    if (focusType === undefined) return;
    document.querySelector(`[data-type-node="${focusType.code}"]`)?.scrollIntoView({ block: 'center' });
  }, [focusType]);

  const toggle = (code: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const typesWithBases = types.filter((type) => (tree.directCounts.get(type.code) ?? 0) > 0).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Card className="gap-3">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Item type tree</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpanded(new Set(tree.children.keys()));
                }}
              >
                Expand all
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setExpanded(new Set());
                }}
              >
                Collapse all
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            The Equiv hierarchy from itemtypes.txt. A type with two parents appears under both. Sockets are the max sockets per item level
            band.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="space-y-0.5">
            {tree.roots.map((type) => (
              <TypeNode
                key={type.code}
                type={type}
                tree={tree}
                path={[]}
                expanded={expanded}
                onToggle={toggle}
                focus={focusType?.code ?? null}
                classNames={classNames}
              />
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="gap-3">
        <CardHeader>
          <CardTitle>Socket caps</CardTitle>
          <p className="text-sm text-muted-foreground">
            Max sockets of every type that has bases. A base's own cap is the lower of this and its own socket limit.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Type</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 pr-4 text-right font-medium">Bases</th>
                <th className="py-2 pr-4 text-right font-medium">Low ilvl</th>
                <th className="py-2 pr-4 text-right font-medium">Mid ilvl</th>
                <th className="py-2 pr-4 text-right font-medium">High ilvl</th>
                <th className="py-2 font-medium">Thresholds</th>
              </tr>
            </thead>
            <tbody>
              {typesWithBases.map((type) => (
                <tr key={type.code} className="border-b last:border-0">
                  <td className="py-1.5 pr-4">
                    <Link to={basesLink(type.code)} className="text-primary underline-offset-2 hover:underline">
                      {type.name}
                    </Link>
                  </td>
                  <td className="py-1.5 pr-4 font-mono text-xs">{type.code}</td>
                  <td className="py-1.5 pr-4 text-right">{tree.directCounts.get(type.code) ?? 0}</td>
                  <td className="py-1.5 pr-4 text-right">{type.sockets[0]}</td>
                  <td className="py-1.5 pr-4 text-right">{type.sockets[1]}</td>
                  <td className="py-1.5 pr-4 text-right">{type.sockets[2]}</td>
                  <td className="py-1.5 text-muted-foreground">
                    ≤ {type.thresholds[0]} / ≤ {type.thresholds[1]} / higher
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

interface TypeNodeProps {
  readonly type: ItemTypeInfo;
  readonly tree: TypeTree;
  /** Codes from the root down to the parent; guards against Equiv cycles */
  readonly path: readonly string[];
  readonly expanded: ReadonlySet<string>;
  readonly onToggle: (code: string) => void;
  readonly focus: string | null;
  readonly classNames: ReadonlyMap<string, string>;
}

function TypeNode({ type, tree, path, expanded, onToggle, focus, classNames }: TypeNodeProps) {
  const children = (tree.children.get(type.code) ?? []).filter((child) => !path.includes(child.code) && child.code !== type.code);
  const isOpen = expanded.has(type.code);
  const direct = tree.directCounts.get(type.code) ?? 0;
  const total = tree.totalCounts.get(type.code) ?? 0;
  const childPath = [...path, type.code];

  return (
    <li>
      <div
        data-type-node={type.code}
        className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 py-1 text-sm',
          focus === type.code && 'bg-amber-500/15 ring-1 ring-amber-500/50'
        )}
      >
        {children.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="size-6"
            onClick={() => {
              onToggle(type.code);
            }}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${type.name}`}
          >
            {isOpen ? <ChevronDown /> : <ChevronRight />}
          </Button>
        ) : (
          <span className="inline-block size-6" aria-hidden />
        )}
        <span className="font-medium">{type.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{type.code}</span>
        {type.cls !== null && <Badge variant="secondary">{classNames.get(type.cls) ?? type.cls}</Badge>}
        {type.ui !== null && (
          <Badge variant="outline" title="UICategory">
            {type.ui}
          </Badge>
        )}
        {type.rwCats.map((cat) => (
          <Badge key={cat} variant="outline" title="Runeword category">
            {cat}
          </Badge>
        ))}
        {type.sockets.some((n) => n > 0) && <span className="text-xs text-muted-foreground">Sockets {socketsLabel(type)}</span>}
        {total > 0 && (
          <Link to={basesLink(type.code)} className="text-xs text-primary underline-offset-2 hover:underline">
            {direct} {direct === 1 ? 'base' : 'bases'}
            {total !== direct && ` (${String(total)} incl. subtypes)`}
          </Link>
        )}
      </div>
      {isOpen && children.length > 0 && (
        <ul className="ml-3 space-y-0.5 border-l pl-3">
          {children.map((child) => (
            <TypeNode
              key={child.code}
              type={child}
              tree={tree}
              path={childPath}
              expanded={expanded}
              onToggle={onToggle}
              focus={focus}
              classNames={classNames}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
