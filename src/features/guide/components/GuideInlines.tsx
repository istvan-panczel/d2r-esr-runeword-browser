/* eslint-disable react-x/no-array-index-key -- the body is a static generated tree that never reorders, so positional keys are stable */
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { findNote } from '../engine/notes';
import type { GuideInline } from '../engine/schema';
import { useHoverPopover } from '@/components/useHoverPopover';
import { useLoadedGuide } from '../hooks/useLoadedGuide';
import { AppLinkIcon } from './AppLinkIcon';
import { GlossaryAppLink } from './GlossaryAppLink';
import { ExternalLink } from '@/components/ExternalLink';
import { PeekPopover, PeekText } from '@/components/PeekPopover';
import { GUIDE_PROSE_FONT, LINK_CLASS } from './styles';

interface NoteLinkProps {
  readonly slug: string;
  readonly children: readonly GuideInline[];
}

function NoteLink({ slug, children }: NoteLinkProps) {
  const { bundle } = useLoadedGuide();
  const target = findNote(bundle, slug);
  const peek = useHoverPopover();

  return (
    <PeekPopover
      peek={peek}
      className={GUIDE_PROSE_FONT}
      enabled={target !== undefined}
      trigger={
        <Link to={`/guide/${slug}`} className={LINK_CLASS} {...peek.triggerProps}>
          <GuideInlines nodes={children} />
        </Link>
      }
    >
      {target && <PeekText title={target.title} text={target.summary} />}
    </PeekPopover>
  );
}

interface TermProps {
  readonly term: string;
  readonly children: readonly GuideInline[];
}

function Term({ term, children }: TermProps) {
  const { bundle } = useLoadedGuide();
  const entry = bundle.glossary.find((g) => g.term === term);
  const peek = useHoverPopover();

  if (entry === undefined) return <GuideInlines nodes={children} />;

  return (
    <PeekPopover
      peek={peek}
      className={GUIDE_PROSE_FONT}
      trigger={
        // A tap (touch) opens it too; tapping outside closes it.
        <button
          type="button"
          className="cursor-help underline decoration-dotted decoration-muted-foreground underline-offset-4"
          aria-label={`${term}: show definition`}
          onClick={() => {
            peek.setOpen(true);
          }}
          {...peek.triggerProps}
        >
          <GuideInlines nodes={children} />
        </button>
      }
    >
      <PeekText title={entry.term} text={entry.definition} />
      {(entry.note !== null || entry.link !== undefined) && (
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {entry.note !== null && (
            <Link to={`/guide/${entry.note}`} className={cn(LINK_CLASS, 'inline-block text-xs')}>
              Read more
            </Link>
          )}
          {entry.link !== undefined && <GlossaryAppLink href={entry.link} />}
        </p>
      )}
    </PeekPopover>
  );
}

interface GuideInlineViewProps {
  readonly node: GuideInline;
}

function GuideInlineView({ node }: GuideInlineViewProps) {
  switch (node.type) {
    case 'text':
      return node.value;
    case 'strong':
      return (
        <strong className="font-semibold text-card-foreground">
          <GuideInlines nodes={node.children} />
        </strong>
      );
    case 'emphasis':
      return (
        <em>
          <GuideInlines nodes={node.children} />
        </em>
      );
    case 'code':
      return <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{node.value}</code>;
    case 'break':
      return <br />;
    case 'term':
      return <Term term={node.term}>{node.children}</Term>;
    case 'link': {
      if (node.kind === 'note') return <NoteLink slug={node.href}>{node.children}</NoteLink>;
      if (node.kind === 'app') {
        return (
          <Link to={node.href} className={LINK_CLASS}>
            <AppLinkIcon href={node.href} className="mr-0.5 inline size-[0.9em] align-[-0.1em]" />
            <GuideInlines nodes={node.children} />
          </Link>
        );
      }
      return (
        <ExternalLink href={node.href} className={LINK_CLASS} iconClassName="ml-0.5 inline size-[0.9em] align-[-0.1em]">
          <GuideInlines nodes={node.children} />
        </ExternalLink>
      );
    }
  }
}

interface GuideInlinesProps {
  readonly nodes: readonly GuideInline[];
}

/** Renders resolved inline nodes (text, emphasis, code, note/app/external links, glossary terms). */
export function GuideInlines({ nodes }: GuideInlinesProps) {
  return nodes.map((node, i) => <GuideInlineView key={i} node={node} />);
}
