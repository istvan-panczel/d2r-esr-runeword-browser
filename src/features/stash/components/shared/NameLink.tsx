import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CopyTextButton } from '../CopyTextButton';
import { UNIQUE_NAME_CLASS } from './classes';

interface NameLinkProps {
  readonly name: string;
  /** The page of the item (`/uniques?name=…`); null renders the name as plain text */
  readonly to: string | null;
  /** Colour classes (text + underline decoration); default the unique colour */
  readonly className?: string;
  /** Copy button label; default `Copy "<name>" for the in-game stash search` */
  readonly copyLabel?: string;
}

/** An item's name as a link to its page, plus the copy button for the in-game stash search */
export function NameLink({ name, to, className = UNIQUE_NAME_CLASS, copyLabel }: NameLinkProps) {
  const classes = cn('min-w-0 font-medium underline underline-offset-2', className);
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      {to === null ? (
        <span className={cn(classes, 'no-underline')}>{name}</span>
      ) : (
        <Link to={to} className={classes}>
          {name}
        </Link>
      )}
      <CopyTextButton text={name} label={copyLabel ?? `Copy "${name}" for the in-game stash search`} />
    </span>
  );
}
