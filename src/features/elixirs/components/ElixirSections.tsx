import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/SectionHeader';
import { CellIcon } from '@/features/game-data/components/CellIcon';
import type { ElixirPerk, ElixirsBundle } from '@/features/game-data/engine/schema';
import { cubeFamilyHref } from '@/features/game-data/utils/materials';
import { ELIXIRS_GUIDE_NOTE, materialsHref, oddsText } from '../utils/elixirsView';
import { PerkLink } from './ElixirCard';

const LINK = 'font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary';

/** How elixirs drop: the potion picks that become one, by area, and who gets which */
export function DropsPanel({ bundle, perks }: { readonly bundle: ElixirsBundle; readonly perks: ReadonlyMap<string, ElixirPerk> }) {
  const plain = bundle.drops.sources.filter((source) => source.perk === undefined);
  const perkRoutes = bundle.drops.sources.filter((source) => source.perk !== undefined);
  const counts = {
    everyone: bundle.elixirs.filter((elixir) => elixir.dropPerks?.length === 0).length,
  };
  const gatedGroups = new Map<string, string[]>();
  for (const elixir of bundle.elixirs) {
    if (elixir.dropPerks === undefined || elixir.dropPerks.length === 0) continue;
    const key = elixir.dropPerks.join('+');
    gatedGroups.set(key, [...(gatedGroups.get(key) ?? []), elixir.name]);
  }
  const noOdds = bundle.drops.odds[0]?.chances ?? {};
  const oneRegular = Object.values(noOdds).at(0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="gap-3 px-4 py-4 text-sm">
        <h2 className="font-semibold">How elixirs drop</h2>
        <p className="text-muted-foreground">
          A potion drop is sometimes an elixir instead. The chance grows through the game (treasure classes{' '}
          <code className="text-xs">Potion 1 Single</code> … <code className="text-xs">Potion 8 Single</code>):
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Where</th>
              <th className="py-1 text-right font-normal">Potion picks that become an elixir</th>
            </tr>
          </thead>
          <tbody>
            {plain.map((source) => (
              <tr key={source.tc} className="border-t">
                <td className="py-1" title={source.tc}>
                  {source.label}
                </td>
                <td className="py-1 text-right tabular-nums">{source.chance}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {perkRoutes.length > 0 && (
          <p className="text-muted-foreground">
            {perkRoutes.map((source, index) => {
              const perk = source.perk === undefined ? undefined : perks.get(source.perk);
              return (
                <span key={source.tc}>
                  {index > 0 && ' '}
                  {source.chance}% of {source.label} drops too, with {perk === undefined ? 'a perk' : <PerkLink perk={perk} />}.
                </span>
              );
            })}
          </p>
        )}
      </Card>

      <Card className="gap-3 px-4 py-4 text-sm">
        <h2 className="font-semibold">Who finds which</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            {counts.everyone} elixirs drop for every character
            {oneRegular === undefined ? '' : `: without perks each is ${oddsText(oneRegular)} of the elixir drops`}.
          </li>
          {[...gatedGroups].map(([key, names]) => {
            const list = key.split('+').flatMap((perk) => perks.get(perk) ?? []);
            return (
              <li key={key}>
                {names.length} {names.length === 1 ? 'elixir drops' : 'elixirs drop'} only for a killer with{' '}
                {list.map((perk, index) => (
                  <span key={perk.key}>
                    {index > 0 && ' and '}
                    <PerkLink perk={perk} />
                  </span>
                ))}
                {names.length <= 4 && `: ${names.join(', ')}`}.
              </li>
            );
          })}
          {bundle.elixirs
            .filter((elixir) => elixir.perk !== undefined)
            .map((elixir) => {
              const perk = elixir.perk === undefined ? undefined : perks.get(elixir.perk);
              return (
                <li key={elixir.code}>
                  The {elixir.name} comes with the perk {perk === undefined ? '' : <PerkLink perk={perk} />}
                  {elixir.dropPerks === undefined && elixir.recipes === undefined && ' and never drops'}.
                </li>
              );
            })}
        </ul>
        <p className="text-muted-foreground">The odds on the cards follow the perks you switch on above.</p>
      </Card>
    </div>
  );
}

/** The Alchemist perks that change elixirs, with what the game files do with each */
export function PerksSection({ perks }: { readonly perks: readonly ElixirPerk[] }) {
  return (
    <section aria-labelledby="elixir-perks" className="space-y-3">
      <SectionHeader id="elixir-perks" title="Alchemist perks" />
      <div className="grid gap-3 md:grid-cols-2 @8xl/page:grid-cols-3">
        {perks.map((perk) => (
          <Card key={perk.key} className="gap-2 px-4 py-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold">
                <PerkLink perk={perk} />
              </h3>
              <span className="text-xs text-muted-foreground">
                {perk.tree}, row {perk.row}
              </span>
            </div>
            <p className="text-muted-foreground italic">{perk.description}</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">
              {perk.facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </section>
  );
}

/** The cube recipes that make elixirs */
export function RecipesSection({ recipes }: { readonly recipes: ElixirsBundle['recipes'] }) {
  if (recipes.length === 0) return null;
  return (
    <section aria-labelledby="elixir-recipes" className="space-y-3">
      <SectionHeader id="elixir-recipes" title="Cube recipes" />
      <Card className="gap-0 divide-y py-0 text-sm">
        {recipes.map((recipe) => (
          <div key={recipe.id} className="space-y-1 px-4 py-3">
            <p className="flex flex-wrap items-center gap-1.5">
              {recipe.inputs.map((input, index) => (
                <span key={`${input.text}-${String(index)}`} className="inline-flex items-center gap-1">
                  {index > 0 && <span className="text-muted-foreground">+</span>}
                  <CellIcon item={input.code === undefined ? null : { kind: input.type === true ? 'type' : 'item', code: input.code }} />
                  {input.qty > 1 && `${String(input.qty)}× `}
                  {input.text}
                </span>
              ))}
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{recipe.outputs.map((output) => output.text).join(', ')}</span>
            </p>
            {recipe.conditions.length > 0 && <p className="text-xs text-muted-foreground">{recipe.conditions.join(' · ')}</p>}
          </div>
        ))}
      </Card>
      <p className="text-xs text-muted-foreground">
        The game tries the rows in order, so with Alchemical Excellence the greater row comes first. All potion recipes are on the{' '}
        <Link to={cubeFamilyHref('potions')} className={LINK}>
          Cube Recipes page
        </Link>
        .
      </p>
    </section>
  );
}

/** Other items called Elixir */
export function NameClashNote({ otherUtilityPotions }: { readonly otherUtilityPotions: readonly string[] }) {
  return (
    <Card className="gap-2 px-4 py-3 text-sm">
      <h2 className="font-semibold">Not these elixirs</h2>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          The plain{' '}
          <Link to={materialsHref('Elixir')} className={LINK}>
            Elixir
          </Link>{' '}
          is a cube ingredient made by Secret Recipe 1, not a drink (
          <Link to="/guide/secret-recipes" className={LINK}>
            Secret recipes
          </Link>
          ).
        </li>
        <li>
          The Elixir of Skill in your starting inventory gives a permanent skill point (
          <Link to="/guide/starter-pack" className={LINK}>
            Starter pack
          </Link>
          ); the Elixir of Skill that drops is the utility elixir below.
        </li>
        {otherUtilityPotions.length > 0 && (
          <li>
            {otherUtilityPotions.join(', ')} are utility potions too: Utility Potion Effectiveness and Duration and the utility potion perks
            act on them as well.
          </li>
        )}
      </ul>
      <p className="text-xs">
        <Link to={ELIXIRS_GUIDE_NOTE} className={LINK}>
          Elixirs in the guide
        </Link>
      </p>
    </Card>
  );
}
