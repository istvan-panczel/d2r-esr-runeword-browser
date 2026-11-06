import { ExternalLink } from '@/components/ExternalLink';
import { DROP_FINDER_URL } from '@/core/navigation/navConfig';
import { findDropFinderTerm } from '../utils/dropFinder';
import { EXTERNAL_ICON_CLASS, LINK_CLASS } from './styles';

/** An item name linking to the official Drop Finder (the plain page: its deep links change with every ESR release) */
export function DropFinderLink({ children }: { readonly children: string }) {
  return (
    <ExternalLink href={DROP_FINDER_URL} className={LINK_CLASS} iconClassName={EXTERNAL_ICON_CLASS}>
      {children}
    </ExternalLink>
  );
}

interface DropFinderTextProps {
  readonly text: string;
  /** Link the first Drop Finder item in the text (one link per tier, like the guide's one per paragraph) */
  readonly link: boolean;
}

/** Parsed page text with its first Drop Finder item linked */
export function DropFinderText({ text, link }: DropFinderTextProps) {
  const match = link ? findDropFinderTerm(text) : null;
  if (match === null) return text;
  return (
    <>
      {text.slice(0, match.index)}
      <DropFinderLink>{match.term}</DropFinderLink>
      {text.slice(match.index + match.term.length)}
    </>
  );
}
