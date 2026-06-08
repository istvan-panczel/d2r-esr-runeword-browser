import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { avatarInitials, formatProfileTag } from '@/features/auth';
import type { BuildWithAuthor } from '../types';
import { classStyle } from '../utils/classStyle';

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

interface BuildCardProps {
  readonly build: BuildWithAuthor;
  readonly currentEsrVersion: string | null;
  /** Whether the signed-in viewer has liked this build (fills the heart). */
  readonly liked?: boolean;
}

export function BuildCard({ build, currentEsrVersion, liked = false }: BuildCardProps) {
  const author = build.profiles;
  // Use the build's most recent ESR version (last edit, else creation) so the badge
  // matches the detail page's "effective version" notion: a build edited onto the
  // current version isn't flagged as outdated.
  const effectiveVersion = build.esr_version_updated ?? build.esr_version;
  const versionMismatch = effectiveVersion !== null && currentEsrVersion !== null && effectiveVersion !== currentEsrVersion;
  const style = classStyle(build.class);

  return (
    <Card className="relative flex flex-col gap-2 p-4 transition-colors hover:bg-accent/40">
      <div className="flex items-start justify-between gap-2">
        {/* Stretched link makes the whole card navigate to the build detail page. */}
        <Link to={`/build/${build.id}`} className="font-semibold leading-tight after:absolute after:inset-0">
          {build.name}
        </Link>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
          <Heart className={liked ? 'size-4 fill-current' : 'size-4'} aria-label={liked ? 'You liked this build' : undefined} />
          {build.likes_count}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={style?.badge}>
          {build.class}
        </Badge>
        {author !== null ? (
          <Link
            to={`/user/${build.user_id}`}
            className="relative z-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Avatar className="size-5">
              {author.avatar_url !== null && <AvatarImage src={author.avatar_url} alt="" />}
              <AvatarFallback className="text-[10px]">{avatarInitials(author.display_name)}</AvatarFallback>
            </Avatar>
            <span className="max-w-[16ch] truncate">{formatProfileTag(author.display_name, author.discriminator)}</span>
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Unknown author</span>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{dateFormatter.format(new Date(build.created_at))}</span>
        <Badge
          variant="outline"
          className={versionMismatch ? 'border-amber-500 text-amber-600 dark:text-amber-400' : undefined}
          title={versionMismatch ? 'Created on a different ESR version than yours' : undefined}
        >
          ESR {effectiveVersion ?? 'Unknown'}
        </Badge>
      </div>
    </Card>
  );
}
