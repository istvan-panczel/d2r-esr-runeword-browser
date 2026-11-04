import { AvatarImage } from '@/components/ui/avatar';
import { safeAvatarUrl } from '@/core/supabase/avatar';

/** A profile's avatar image inside an `Avatar`; renders nothing (the fallback shows) unless it is a Discord CDN image. */
export function ProfileAvatarImage({ url }: { readonly url: string | null }) {
  const src = safeAvatarUrl(url);
  return src === null ? null : <AvatarImage src={src} alt="" />;
}
