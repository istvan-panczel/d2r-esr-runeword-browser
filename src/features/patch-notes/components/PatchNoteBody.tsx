/* eslint-disable react-x/no-array-index-key -- the notes are a static generated tree that never reorders, so positional keys are stable */
import { AMBER_HEADING_CLASS } from '@/features/ascendancies/components/styles';
import { cn } from '@/lib/utils';
import type { PatchNoteBlock, PatchNoteListItem, PatchNoteSpan } from '../engine/schema';

function Spans({ spans }: { readonly spans: readonly PatchNoteSpan[] }) {
  return spans.map((span, index) =>
    span.bold === true ? (
      <strong key={index} className="font-semibold text-foreground">
        {span.text}
      </strong>
    ) : (
      <span key={index}>{span.text}</span>
    )
  );
}

function List({ items, nested = false }: { readonly items: readonly PatchNoteListItem[]; readonly nested?: boolean }) {
  return (
    <ul className={cn('list-disc space-y-1.5 pl-5 marker:text-muted-foreground', nested && 'mt-1.5 list-[circle]')}>
      {items.map((item, index) => (
        <li key={index}>
          <Spans spans={item.spans} />
          {item.items !== undefined && <List items={item.items} nested />}
        </li>
      ))}
    </ul>
  );
}

/** The official patch notes of one release (parsed from the author's markdown at generate time). */
export function PatchNoteBody({ blocks }: { readonly blocks: readonly PatchNoteBlock[] }) {
  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">The ESR repository has no patch notes for this release.</p>;
  }
  return (
    <div className="max-w-prose space-y-3 text-sm leading-relaxed text-foreground/90">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'heading':
            return (
              <h3 key={index} className={cn(AMBER_HEADING_CLASS, 'pt-3 text-base first:pt-0')}>
                {block.text}
              </h3>
            );
          case 'list':
            return <List key={index} items={block.items} />;
          case 'paragraph':
            return (
              <p key={index}>
                <Spans spans={block.spans} />
              </p>
            );
        }
      })}
    </div>
  );
}
