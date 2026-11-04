import type { ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Download, GitFork, Heart, Lock, MessageSquareText } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProfileAvatarImage } from '@/components/ProfileAvatarImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { avatarInitials, formatProfileTag, openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import { cn } from '@/lib/utils';
import {
  downloadSharedFilterRequested,
  selectDownloadingFilterIdSet,
  selectLikePendingFilterIdSet,
  selectLikedFilterIdSet,
  toggleSharedFilterLikeRequested,
} from '../../sharing/sharingSlice';
import type { SharedFilterSummary } from '../../sharing/types';
import { createdOnLine, levelNames, ruleCountLabel, savedFilterPath, updatedOnLine } from '../../utils/library';

const dateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

interface SharedFilterCardProps {
  readonly filter: SharedFilterSummary;
  /** Extra badges next to the name (My filters: Unsaved changes, Update available). */
  readonly badges?: ReactNode;
  /**
   * The home page block: no version lines, based-on or change note, and the likes as a count (the block does not look
   * up the viewer's likes, so a toggle there could not show their state).
   */
  readonly compact?: boolean;
}

/**
 * A saved filter in a list (Shared tab, My filters, a profile, the home page). Never holds the file: Download fetches it.
 * Imports the sharing slice directly (not the sharing index, which also brings the filter parser) for the home page.
 */
export function SharedFilterCard({ filter, badges, compact = false }: SharedFilterCardProps) {
  const dispatch = useDispatch();
  const signedIn = useSelector(selectIsAuthenticated);
  const liked = useSelector(selectLikedFilterIdSet).has(filter.id);
  const likePending = useSelector(selectLikePendingFilterIdSet).has(filter.id);
  const downloading = useSelector(selectDownloadingFilterIdSet).has(filter.id);

  const author = filter.profiles;
  const path = savedFilterPath(filter.id);
  const levels = levelNames(filter.levels);
  const createdOn = createdOnLine(filter);
  const updatedOn = updatedOnLine(filter);
  // A private filter cannot be liked (RLS); only its owner sees it, so the count is shown without the button.
  const canLike = !compact && !filter.is_private;

  const handleLike = () => {
    if (!signedIn) {
      dispatch(openSignInDialog());
      return;
    }
    dispatch(toggleSharedFilterLikeRequested(filter.id));
  };

  const likeLabel = `${String(filter.likes_count)} ${filter.likes_count === 1 ? 'like' : 'likes'}`;

  return (
    <Card className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <Link to={path} className="min-w-0 font-semibold leading-tight break-words hover:underline">
          {filter.name}
        </Link>
        <div className="flex shrink-0 flex-wrap justify-end gap-1">
          {filter.is_private && (
            <Badge variant="secondary">
              <Lock aria-hidden />
              Private
            </Badge>
          )}
          {badges}
        </div>
      </div>

      {filter.description !== null && filter.description.trim() !== '' && (
        <p className="line-clamp-2 text-sm whitespace-pre-line text-muted-foreground">{filter.description}</p>
      )}

      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {author !== null ? (
          <Link to={`/user/${filter.user_id}`} className="inline-flex min-w-0 items-center gap-1.5 hover:text-foreground">
            <Avatar className="size-5">
              <ProfileAvatarImage url={author.avatar_url} />
              <AvatarFallback className="text-[10px]">{avatarInitials(author.display_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{formatProfileTag(author.display_name, author.discriminator)}</span>
          </Link>
        ) : (
          <span>Unknown author</span>
        )}
        <span className="shrink-0 text-xs">{dateFormatter.format(new Date(filter.created_at))}</span>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          {ruleCountLabel(filter.rule_count)}
          {levels.length > 0 && (
            <>
              {' · '}
              <span title="Filter levels">{levels.join(', ')}</span>
            </>
          )}
        </p>
        {!compact && createdOn !== null && <p>{createdOn}</p>}
        {!compact && updatedOn !== null && <p>{updatedOn}</p>}
        {!compact && filter.based_on_label !== null && (
          <p className="inline-flex items-center gap-1">
            <GitFork className="size-3.5 shrink-0" aria-hidden />
            <span>Based on {filter.based_on_label}</span>
          </p>
        )}
        {!compact && filter.change_note !== null && filter.change_note.trim() !== '' && (
          <p className="flex items-start gap-1">
            <MessageSquareText className="mt-px size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">
              <span className="font-medium text-foreground">Latest change:</span> {filter.change_note}
            </span>
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Button size="sm" asChild>
          <Link to={path}>Open</Link>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={downloading}
          onClick={() => {
            dispatch(downloadSharedFilterRequested(filter.id));
          }}
          title="Downloads the filter, as a .zip with its sounds and icons when it uses bundled ones"
        >
          {downloading ? <Spinner /> : <Download />}
          Download
        </Button>
        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          {canLike ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1 px-2"
              aria-pressed={liked}
              aria-label={liked ? `Unlike (${likeLabel})` : `Like (${likeLabel})`}
              title={signedIn ? undefined : 'Sign in to like filters'}
              disabled={likePending}
              onClick={handleLike}
            >
              <Heart className={cn('size-4', liked && 'fill-current text-rose-500')} aria-hidden />
              {filter.likes_count}
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1" aria-label={likeLabel}>
              <Heart className="size-4" aria-hidden />
              {filter.likes_count}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1"
            aria-label={`${String(filter.download_count)} ${filter.download_count === 1 ? 'download' : 'downloads'}`}
          >
            <Download className="size-4" aria-hidden />
            {filter.download_count}
          </span>
        </div>
      </div>
    </Card>
  );
}
