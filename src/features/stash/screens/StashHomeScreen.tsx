import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { stashCatalog } from '../engine/catalog';
import { collectCoupons } from '../engine/coupons';
import { itemsSummary } from '../engine/items/allItems';
import { StashGate } from '../components/StashGate';
import { useStash } from '../hooks/useStash';
import { STASH_PAGES } from './stashPages';

/** /stash: the upload (or the loaded file) and the stash features with a one-line summary each. */
export function StashHomeScreen() {
  const { state, bundle } = useStash();
  const coupons = state.status === 'ready' ? collectCoupons(state.stash, bundle).summary : null;
  const items = state.status === 'ready' ? itemsSummary(state.stash, stashCatalog(bundle)) : null;
  const summaryOf = (to: string): string | null => {
    if (to === '/stash/coupons' && coupons !== null) {
      return `${String(coupons.total)} coupons of ${String(coupons.distinct)} kinds; ${String(coupons.craftable)} uniques craftable now`;
    }
    if (to === '/stash/items' && items !== null) {
      return `${String(items.total)} items: ${String(items.uniques)} uniques, ${String(items.sets)} set items, ${String(items.runewords)} runewords`;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <StashGate>{() => null}</StashGate>
      <section aria-labelledby="stash-features" className="space-y-3">
        <h2 id="stash-features" className="text-lg font-semibold">
          What the pages show
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {STASH_PAGES.filter((page) => page.to !== '/stash').map((page) => {
            const summary = summaryOf(page.to);
            return (
              <li key={page.to}>
                <Link
                  to={page.to}
                  className="group flex h-full items-start justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm hover:bg-accent/40"
                >
                  <span className="space-y-1">
                    <span className="block font-semibold">{page.label}</span>
                    <span className="block text-sm text-muted-foreground">{page.description}</span>
                    {summary !== null && <span className="block text-sm font-medium">{summary}</span>}
                  </span>
                  <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
