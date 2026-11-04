import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CampaignSection } from '../engine/types';
import { FactSourceLabel } from './FactSourceLabel';
import { WARNING_BOX_CLASS } from './mapStyles';

interface SectionNotesProps {
  readonly section: CampaignSection;
  /** Hint under the notes (what to click) */
  readonly hint: string;
}

/** The side column while no area is selected: the section's notes (the official page's act notes, removed levels…). */
export function SectionNotes({ section, hint }: SectionNotesProps) {
  const headingId = `campaign-notes-${section.key}`;
  return (
    <section aria-labelledby={headingId} className="space-y-3 rounded-lg border bg-card p-4 text-sm shadow-xs">
      <h2 id={headingId} className="font-semibold">
        {section.title}
      </h2>
      {section.notes.length > 0 && (
        <ul className="space-y-2">
          {section.notes.map((note) => (
            <li
              key={note.text}
              className={note.warning === true ? cn('flex gap-2 rounded-md border px-2 py-1.5', WARNING_BOX_CLASS) : undefined}
            >
              {note.warning === true && (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              )}
              {note.spoiler === true ? (
                <details>
                  <summary className="cursor-pointer text-muted-foreground">Show the official hint</summary>
                  <p className="mt-1">
                    {note.text}
                    <FactSourceLabel source={note.source} verify={note.verify} />
                  </p>
                </details>
              ) : (
                <p>
                  {note.text}
                  <FactSourceLabel source={note.source} verify={note.verify} />
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}
