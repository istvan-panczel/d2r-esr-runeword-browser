import type { MouseEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AreaLinkProps {
  readonly id: number;
  /** The area's URL on this page (`?area=…`), so middle-click and Copy link address work */
  readonly href: string;
  /** A plain click selects instead of navigating */
  readonly onSelect: (id: number) => void;
  readonly className?: string;
  readonly title?: string;
  readonly children: ReactNode;
}

const isPlainClick = (event: MouseEvent) => event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** A link to an area of the map: selects it on a plain click, opens the deep link on a modified click. */
export function AreaLink({ id, href, onSelect, className, title, children }: AreaLinkProps) {
  return (
    <Link
      to={href}
      title={title}
      className={className}
      onClick={(event) => {
        if (!isPlainClick(event)) return;
        event.preventDefault();
        onSelect(id);
      }}
    >
      {children}
    </Link>
  );
}
