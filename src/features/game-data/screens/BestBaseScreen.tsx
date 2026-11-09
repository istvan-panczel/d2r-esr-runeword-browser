import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLiveQuery } from 'dexie-react-hooks';
import { Info, TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CopyLinkButton } from '@/components/CopyLinkButton';
import { CopyLinkHelpButton } from '@/components/CopyLinkHelpButton';
import { FilterPanel } from '@/components/FilterPanel';
import { db } from '@/core/db';
import type { Runeword } from '@/core/db/models';
import type { BaseItem, ItemTypeInfo, SuperiorAffixes, TxtRuneword, TxtRunewordsBundle, TypesBundle } from '../engine/schema';
import { readSuperiorAffixes } from '../engine/superiorAffixes';
import { findEligibleBases, upgradePath, type EligibleBase } from '../engine/bestBase';
import { htmRunewordId, matchRunewords, type RunewordMatchResult } from '../engine/matchRunewords';
import { CharacterForm } from '../components/CharacterForm';
import { ComboPicker, type ComboOption } from '../components/ComboPicker';
import { EligibleBaseCard } from '../components/EligibleBaseCard';
import { GameDataError } from '../components/GameDataError';
import { GameDataLoading } from '../components/GameDataLoading';
import { useGameData } from '../hooks/useGameData';
import { useBestBaseUrlState } from '../hooks/useBestBaseUrlState';
import { useManifest } from '../hooks/useManifest';
import { selectBestBaseOptions, selectCharacter, setBestBaseRuneword, setTxtKeyOverride } from '../store/gameDataSlice';
import {
  buildBaseGroups,
  gameFileStats,
  ingredientSummary,
  resolveTxtSource,
  socketRangeLabel,
  summariseRejections,
  type BaseGroup,
  type RejectionSummary,
  type TxtSource,
} from '../utils/bestBaseResults';

const BEST_BASE_FILES = ['types', 'bases', 'runewords'] as const;
/** Bases shown per type group before "show all" */
const GROUP_PREVIEW_SIZE = 3;

export function BestBaseScreen() {
  const gameData = useGameData(BEST_BASE_FILES);
  const htmRunewords = useLiveQuery(() => db.runewords.toArray(), []);

  if (gameData.status === 'loading' || htmRunewords === undefined) return <GameDataLoading />;
  if (gameData.status === 'error') return <GameDataError error={gameData.error} onRetry={gameData.retry} />;
  return (
    <BestBaseFinder
      typesBundle={gameData.data.types}
      bases={gameData.data.bases.bases}
      superior={readSuperiorAffixes(gameData.data.bases)}
      txtBundle={gameData.data.runewords}
      htmRunewords={htmRunewords}
    />
  );
}

interface BestBaseFinderProps {
  readonly typesBundle: TypesBundle;
  readonly bases: readonly BaseItem[];
  readonly superior: SuperiorAffixes | null;
  readonly txtBundle: TxtRunewordsBundle;
  readonly htmRunewords: readonly Runeword[];
}

function socketsLabel(runeword: Pick<Runeword, 'sockets' | 'socketsMax'>): string {
  return runeword.socketsMax === undefined ? String(runeword.sockets) : `${String(runeword.sockets)}-${String(runeword.socketsMax)}`;
}

function htmOptions(runewords: readonly Runeword[]): ComboOption[] {
  const variantCounts = new Map<string, number>();
  for (const runeword of runewords) variantCounts.set(runeword.name, (variantCounts.get(runeword.name) ?? 0) + 1);
  return [...runewords]
    .sort((a, b) => a.name.localeCompare(b.name) || a.variant - b.variant)
    .map((runeword) => {
      const recipe = ingredientSummary(runeword.ingredients.length > 0 ? runeword.ingredients : runeword.runes);
      const variant = (variantCounts.get(runeword.name) ?? 0) > 1 ? ` (variant ${String(runeword.variant)})` : '';
      return {
        id: htmRunewordId(runeword),
        label: `${runeword.name}${variant}`,
        detail: `${recipe} · ${socketsLabel(runeword)} sockets · ${runeword.allowedItems.join(', ')}`,
        search: `${runeword.name} ${recipe} ${runeword.allowedItems.join(' ')}`.toLowerCase(),
      };
    });
}

function txtOptions(runewords: readonly TxtRuneword[]): ComboOption[] {
  return [...runewords]
    .sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key))
    .map((runeword) => {
      const recipe = ingredientSummary(runeword.rows[0]?.ingredients ?? []);
      return {
        id: runeword.key,
        label: runeword.name,
        detail: `${runeword.key} · ${recipe} · ${socketRangeLabel(runeword.rows)} sockets`,
        search: `${runeword.name} ${runeword.key} ${recipe}`.toLowerCase(),
      };
    });
}

function BestBaseFinder({ typesBundle, bases, superior, txtBundle, htmRunewords }: BestBaseFinderProps) {
  const dispatch = useDispatch();
  const options = useSelector(selectBestBaseOptions);
  const getShareUrl = useBestBaseUrlState();
  const manifest = useManifest();
  const docsVersion = useLiveQuery(async () => (await db.metadata.get('esrVersion'))?.value);

  const typeByCode = new Map(typesBundle.types.map((type) => [type.code, type]));
  const typeNames = new Map(typesBundle.types.map((type) => [type.code, type.name]));
  const classNames = new Map<string, string>(typesBundle.classes.map((cls) => [cls.code, cls.name]));
  const txtByKey = new Map(txtBundle.runewords.map((runeword) => [runeword.key, runeword]));
  const htmById = new Map(htmRunewords.map((runeword) => [htmRunewordId(runeword), runeword]));
  const matchResult = matchRunewords(htmRunewords, txtBundle, { typeNames });

  const selectedId = options.selected === null ? null : htmRunewordId(options.selected);
  const selectedHtm = selectedId === null ? undefined : htmById.get(selectedId);

  return (
    <div>
      <FilterPanel>
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-64 max-w-xl flex-1 space-y-1">
            <Label htmlFor="best-base-runeword" className="text-xs font-normal text-muted-foreground">
              Runeword
            </Label>
            <ComboPicker
              id="best-base-runeword"
              className="w-full"
              options={htmOptions(htmRunewords)}
              selectedId={selectedHtm === undefined ? null : selectedId}
              placeholder={htmRunewords.length === 0 ? 'No runewords loaded yet' : 'Pick a runeword…'}
              searchPlaceholder="Search name, runes or items…"
              onSelect={(id) => {
                const runeword = htmById.get(id);
                if (runeword !== undefined) dispatch(setBestBaseRuneword({ name: runeword.name, variant: runeword.variant }));
              }}
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Share runeword + character.</p>
              <CopyLinkHelpButton />
            </div>
            <CopyLinkButton getShareUrl={getShareUrl} />
          </div>
        </div>
        <CharacterForm classes={typesBundle.classes} />
      </FilterPanel>

      {options.selected === null && (
        <p className="py-8 text-center text-muted-foreground">Pick a runeword to see which bases can hold it.</p>
      )}
      {options.selected !== null && selectedHtm === undefined && (
        <p className="py-8 text-center text-muted-foreground">
          Runeword "{options.selected.name}" (variant {options.selected.variant}) is not in the docs data.
        </p>
      )}
      {selectedHtm !== undefined && (
        <SelectedRuneword
          // Re-mount (and collapse the "show all" groups) when the runeword changes
          key={htmRunewordId(selectedHtm)}
          runeword={selectedHtm}
          source={resolveTxtSource(
            selectedHtm,
            matchResult.byHtm.get(htmRunewordId(selectedHtm)),
            options.txtKeyOverride === null ? undefined : txtByKey.get(options.txtKeyOverride)
          )}
          txtRunewords={txtBundle.runewords}
          bases={bases}
          superior={superior}
          typeByCode={typeByCode}
          classNames={classNames}
          gameVersion={manifest?.esrVersion}
          docsVersion={docsVersion}
        />
      )}

      <DataConsistency result={matchResult} />
    </div>
  );
}

interface SelectedRunewordProps {
  readonly runeword: Runeword;
  readonly source: TxtSource;
  readonly txtRunewords: readonly TxtRuneword[];
  readonly bases: readonly BaseItem[];
  readonly superior: SuperiorAffixes | null;
  readonly typeByCode: ReadonlyMap<string, ItemTypeInfo>;
  readonly classNames: ReadonlyMap<string, string>;
  readonly gameVersion: string | undefined;
  readonly docsVersion: string | undefined;
}

function SelectedRuneword({
  runeword,
  source,
  txtRunewords,
  bases,
  superior,
  typeByCode,
  classNames,
  gameVersion,
  docsVersion,
}: SelectedRunewordProps) {
  const dispatch = useDispatch();
  const character = useSelector(selectCharacter);
  const options = useSelector(selectBestBaseOptions);

  const input = {
    rows: source.rows,
    bases,
    types: typeByCode,
    character,
    options: { includeUnusable: options.includeUnusable, ethereal: options.ethereal },
  };
  const eligible = source.rows.length === 0 ? [] : findEligibleBases(input);
  const groups = buildBaseGroups(eligible, typeByCode);
  const summary = summariseRejections(input);
  const runewordReqLvl = source.rows.length === 0 ? 0 : Math.min(...source.rows.map((row) => row.reqLvl));
  const recipe = ingredientSummary(runeword.ingredients.length > 0 ? runeword.ingredients : runeword.runes);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-amber-700 dark:text-amber-400">{runeword.name}</h2>
          <Badge variant="secondary">{socketsLabel(runeword)} Socket</Badge>
          {source.kind === 'match' && source.quality !== 'exact' && (
            <Badge
              variant="outline"
              className="border-sky-600/50 text-sky-700 dark:text-sky-400"
              title={`Match quality: ${source.quality}`}
            >
              <Info className="size-3" />
              recipe differs in game files
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {recipe} · {runeword.allowedItems.join(', ')}
          {runeword.excludedItems.length > 0 && ` (not ${runeword.excludedItems.join(', ')})`}
        </p>
        <TxtSourceLine source={source} />
      </div>

      <GameFileStats source={source} />

      {(source.kind === 'none' || source.kind === 'override') && (
        <div className="space-y-2 rounded-md border border-amber-600/40 bg-amber-500/5 p-3 text-sm">
          {source.kind === 'none' && (
            <p className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Not in game files (ESR {gameVersion ?? '?'}); docs are ESR {docsVersion ?? '?'}. Pick the matching game-file runeword
                manually:
              </span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <ComboPicker
              id="best-base-txt-runeword"
              className="w-full max-w-md"
              options={txtOptions(txtRunewords)}
              selectedId={source.kind === 'override' ? source.runeword.key : null}
              placeholder="Pick a game-file runeword…"
              searchPlaceholder="Search name, key or runes…"
              onSelect={(key) => dispatch(setTxtKeyOverride(key))}
            />
            {source.kind === 'override' && (
              <Button variant="outline" size="sm" onClick={() => dispatch(setTxtKeyOverride(null))}>
                Clear manual pick
              </Button>
            )}
          </div>
        </div>
      )}

      {runewordReqLvl > character.level && (
        <p className="flex items-center gap-2 rounded-md border border-red-600/40 bg-red-500/5 p-3 text-sm text-red-700 dark:text-red-400">
          <TriangleAlert className="size-4 shrink-0" />
          Runeword requires level {runewordReqLvl} (your character is level {character.level}).
        </p>
      )}

      {source.rows.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {eligible.length} base{eligible.length === 1 ? '' : 's'} {options.includeUnusable ? 'can hold' : 'you can use for'} this
            runeword{options.ethereal && ' (ethereal values are estimates)'}.
          </p>
          {groups.length === 0 ? (
            <EmptyState summary={summary} includeUnusable={options.includeUnusable} />
          ) : (
            groups.map((group) => (
              <BaseGroupSection
                key={group.type}
                group={group}
                bases={bases}
                superior={superior}
                typeByCode={typeByCode}
                classNames={classNames}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}

function TxtSourceLine({ source }: { readonly source: TxtSource }) {
  if (source.kind === 'none') return null;
  const keys = source.kind === 'override' ? [source.runeword.key] : source.match.keys;
  const label = source.kind === 'override' ? 'manual pick' : `${source.quality} match`;
  return (
    <p className="text-xs text-muted-foreground">
      Game files: {keys.join(', ')} ({label}) · {socketRangeLabel(source.rows)} sockets
    </p>
  );
}

function GameFileStats({ source }: { readonly source: TxtSource }) {
  const blocks = gameFileStats(source.rows);
  if (blocks.length === 0) return null;
  return (
    <details className="rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">Game-file stats</summary>
      <div className="mt-2 space-y-3">
        {blocks.map((block) => (
          <div key={block.sockets.join(',')}>
            {blocks.length > 1 && <p className="mb-1 text-xs text-muted-foreground">{block.sockets.join(' / ')} sockets</p>}
            <ul className="space-y-0.5 text-sky-700 dark:text-sky-400">
              {block.lines.map((line, index) => (
                <li key={`${line}-${String(index)}`}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Rendered from the txt files; rune bonuses are not included.</p>
      </div>
    </details>
  );
}

function EmptyState({ summary, includeUnusable }: { readonly summary: RejectionSummary; readonly includeUnusable: boolean }) {
  return (
    <div className="space-y-1 py-6 text-center text-sm text-muted-foreground">
      <p className="text-base">No base qualifies.</p>
      <p>
        Of {summary.total} bases, {summary.typeFit} have a fitting item type, {summary.socketFit} of those can have enough sockets,{' '}
        {summary.classFit} are allowed for your class
        {includeUnusable ? '.' : `, and ${String(summary.usable)} meet your level / Str / Dex.`}
      </p>
      {!includeUnusable && summary.classFit > 0 && <p>Tick "Include bases I can't use yet" to see them with their deficits.</p>}
    </div>
  );
}

interface BaseGroupSectionProps {
  readonly group: BaseGroup;
  readonly bases: readonly BaseItem[];
  readonly superior: SuperiorAffixes | null;
  readonly typeByCode: ReadonlyMap<string, ItemTypeInfo>;
  readonly classNames: ReadonlyMap<string, string>;
}

function BaseGroupSection({ group, bases, superior, typeByCode, classNames }: BaseGroupSectionProps) {
  const [showAll, setShowAll] = useState(false);
  const visible: EligibleBase[] = showAll ? group.results : group.results.slice(0, GROUP_PREVIEW_SIZE);
  const hidden = group.results.length - visible.length;

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">
        {group.name} <span className="font-normal text-muted-foreground">({group.results.length})</span>
      </h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 @8xl/page:grid-cols-4 @9xl/page:grid-cols-5 @10xl/page:grid-cols-6 @11xl/page:grid-cols-7">
        {visible.map((result) => (
          <EligibleBaseCard
            key={result.base.code}
            result={result}
            type={typeByCode.get(result.base.type)}
            classNames={classNames}
            upgrade={upgradePath(result.base, bases)}
            superior={superior}
          />
        ))}
      </div>
      {(hidden > 0 || (showAll && group.results.length > GROUP_PREVIEW_SIZE)) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setShowAll(!showAll);
          }}
        >
          {showAll
            ? `Only show the best ${String(GROUP_PREVIEW_SIZE)}`
            : `Only showing the best ${String(GROUP_PREVIEW_SIZE)}, show all ${String(group.results.length)}`}
        </Button>
      )}
    </section>
  );
}

function DataConsistency({ result }: { readonly result: RunewordMatchResult<Runeword> }) {
  const total = result.unmatchedHtm.length + result.unmatchedTxt.length;
  return (
    <details className="mt-8 rounded-md border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Data consistency ({result.byHtm.size} docs runewords matched, {total} unmatched)
      </summary>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-1 font-medium">In the docs, not in the game files ({result.unmatchedHtm.length})</p>
          <ul className="space-y-0.5 text-muted-foreground">
            {result.unmatchedHtm.map((runeword) => (
              <li key={htmRunewordId(runeword)}>
                {runeword.name} #{runeword.variant}: {ingredientSummary(runeword.ingredients)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-medium">In the game files, not in the docs runewords ({result.unmatchedTxt.length})</p>
          <p className="mb-1 text-xs text-muted-foreground">
            Gem-only recipes are documented on the Gemwords page, which is not matched here.
          </p>
          <ul className="space-y-0.5 text-muted-foreground">
            {result.unmatchedTxt.map((runeword) => (
              <li key={runeword.key}>
                {runeword.name} ({runeword.key}): {ingredientSummary(runeword.rows[0]?.ingredients ?? [])}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
