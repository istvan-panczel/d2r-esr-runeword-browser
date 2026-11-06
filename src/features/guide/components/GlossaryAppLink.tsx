import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { AppLinkIcon } from './AppLinkIcon';
import { LINK_CLASS } from './styles';

interface GlossaryAppLinkProps {
  /** GlossaryEntry.link: an app path such as `/modifiers?kind=deadly-strike` */
  readonly href: string;
  readonly className?: string;
}

/** The app page a glossary term points at (the `link:` key of _glossary.yml), in the glossary list and the term peek. */
export function GlossaryAppLink({ href, className }: GlossaryAppLinkProps) {
  return (
    <Link to={href} className={cn(LINK_CLASS, 'inline-block text-xs', className)}>
      <AppLinkIcon href={href} className="mr-0.5 inline size-[0.9em] align-[-0.1em]" />
      {href.startsWith('/modifiers') ? 'Modifier details' : 'Open in the app'}
    </Link>
  );
}
