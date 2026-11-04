import { Badge } from '@/components/ui/badge';
import { COMMUNITY_TOOL_KIND_LABELS, COMMUNITY_TOOLS } from '@/core/navigation/navConfig';
import { HomeLinkCard } from './HomeLinkCard';

/** "Community tools" block: ESR tools made outside this site (static list from navConfig). */
export function HomeCommunityTools() {
  return (
    <section aria-labelledby="home-community-heading" className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div className="space-y-1">
        <h2 id="home-community-heading" className="text-lg font-semibold">
          Community tools
        </h2>
        <p className="text-sm text-muted-foreground">
          ESR tools made outside this site, mostly by other players. Not affiliated with this site; each project has its own licence and
          support.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COMMUNITY_TOOLS.map((tool) => (
          <HomeLinkCard
            key={tool.key}
            label={tool.label}
            href={tool.href}
            description={tool.description}
            features={tool.features}
            caveat={tool.caveat}
            sourceUrl={tool.sourceUrl}
            meta={
              <>
                <span className="text-xs text-muted-foreground">by {tool.author}</span>
                <Badge variant={tool.kind === 'archive' ? 'secondary' : 'outline'}>{COMMUNITY_TOOL_KIND_LABELS[tool.kind]}</Badge>
              </>
            }
          />
        ))}
      </ul>
    </section>
  );
}
