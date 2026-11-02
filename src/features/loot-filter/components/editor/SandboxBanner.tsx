import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Copy, Eye, Heart, Undo2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { isSupabaseConfigured } from '@/core/supabase/config';
import { avatarInitials, openSignInDialog, selectIsAuthenticated } from '@/features/auth';
import {
  selectLikePendingFilterIdSet,
  selectSharedFilterDetailLiked,
  toggleSharedFilterLikeRequested,
  type SharedFilterDetail,
} from '../../sharing';
import { discardChanges } from '../../store/lootFilterSlice';
import type { EditorTarget } from '../../store/types';
import { authorLabelOf } from '../../utils/editorRoute';
import { SULLYS_QOL_TEMPLATE, bundledTemplate } from '../../utils/template';

interface SandboxBannerProps {
  readonly target: Extract<EditorTarget, { kind: 'sandbox' }>;
  /** The shared filter shown (null for a bundled template, or while it loads). */
  readonly detail: SharedFilterDetail | null;
  /** Edited since it opened. */
  readonly dirty: boolean;
  readonly onCopy: () => void;
}

/**
 * The sandbox: someone else's filter (or a bundled template) on a temporary copy. Says that nothing is saved and
 * offers Copy to my filters, Like (shared filters), the author, what it is based on and its latest change note.
 */
export function SandboxBanner({ target, detail, dirty, onCopy }: SandboxBannerProps) {
  const dispatch = useDispatch();
  const signedIn = useSelector(selectIsAuthenticated);
  const liked = useSelector(selectSharedFilterDetailLiked);
  const pending = useSelector(selectLikePendingFilterIdSet);
  const author = detail?.profiles ?? null;
  const template = bundledTemplate(target.basedOn?.template) ?? SULLYS_QOL_TEMPLATE;

  const handleLike = () => {
    if (detail === null) return;
    if (!signedIn) {
      dispatch(openSignInDialog());
      return;
    }
    dispatch(toggleSharedFilterLikeRequested(detail.id));
  };

  return (
    <div role="note" className="space-y-3 rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2.5 text-sm">
      <div className="flex items-start gap-2">
        <Eye className="mt-0.5 size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <p className="flex-1">
          You are viewing{' '}
          {target.savedId === null ? (
            <span className="font-semibold">
              {template.name} v{template.version}
            </span>
          ) : (
            <>
              <span className="font-semibold">{target.name}</span> by{' '}
              {detail === null ? (
                'its author'
              ) : (
                <Link to={`/user/${detail.user_id}`} className="font-medium underline-offset-4 hover:underline">
                  {authorLabelOf(author)}
                </Link>
              )}
            </>
          )}{' '}
          — changes are not saved. <span className="font-medium">Copy to my filters</span> to keep them.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <Button size="sm" onClick={onCopy}>
          <Copy />
          Copy to my filters
        </Button>
        {isSupabaseConfigured && detail !== null && (
          <Button
            size="sm"
            variant={liked ? 'default' : 'outline'}
            disabled={pending.has(detail.id)}
            onClick={handleLike}
            aria-pressed={liked}
            aria-label={`Like this filter (${String(detail.likes_count)} ${detail.likes_count === 1 ? 'like' : 'likes'})`}
          >
            <Heart className={liked ? 'fill-current' : undefined} />
            {detail.likes_count}
          </Button>
        )}
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              dispatch(discardChanges());
            }}
          >
            <Undo2 />
            Undo my changes
          </Button>
        )}
        {author !== null && detail !== null && (
          <Link to={`/user/${detail.user_id}`} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <Avatar className="size-5">
              {author.avatar_url !== null && <AvatarImage src={author.avatar_url} alt="" />}
              <AvatarFallback className="text-[10px]">{avatarInitials(author.display_name)}</AvatarFallback>
            </Avatar>
            More by {author.display_name}
          </Link>
        )}
      </div>
      {detail !== null && (detail.description !== null || detail.based_on_label !== null || detail.change_note !== null) && (
        <div className="space-y-1 pl-6 text-muted-foreground">
          {detail.description !== null && <p className="whitespace-pre-wrap text-foreground/90">{detail.description}</p>}
          {detail.based_on_label !== null && <p>Based on {detail.based_on_label}</p>}
          {detail.change_note !== null && (
            <p>
              Latest change: <span className="italic">{detail.change_note}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
