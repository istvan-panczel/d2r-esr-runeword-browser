import { Info, TriangleAlert } from 'lucide-react';
import { DevNotice } from '@/core/components/DevNotice';
import type { SaveNotice } from '../engine/notices';

/** The page's banners: a warning in the amber notice, information as a quiet line. */
export function SaveNotices({ notices }: { readonly notices: readonly SaveNotice[] }) {
  if (notices.length === 0) return null;
  return (
    <div className="space-y-2">
      {notices.map((notice) =>
        notice.tone === 'warning' ? (
          <DevNotice key={notice.key} icon={TriangleAlert} title={notice.title}>
            {notice.text}
          </DevNotice>
        ) : (
          <p key={notice.key} className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{notice.title}</span> {notice.text}
            </span>
          </p>
        )
      )}
    </div>
  );
}
