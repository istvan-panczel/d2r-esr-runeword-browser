import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/ui/spinner';

/**
 * Screen-only additions to a report page (they are A4 print layouts with no margin of their own). The reports set
 * their own light colours, so the sheet stays white in dark mode too: a printed page on the desk.
 */
const SHEET_STYLE = '@media screen { html { overflow: hidden; } body { padding: 24px 28px 32px; } }';

interface ReportSheetProps {
  readonly src: string;
  readonly title: string;
}

/**
 * One of our HTML reports in a sandboxed frame (no scripts; same origin so the page can read its height). The frame
 * takes the report's full height, so the page scrolls instead of a box inside it. Give it `key={src}` so a new report
 * starts with a fresh frame and height.
 */
export function ReportSheet({ src, title }: ReportSheetProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (frame === null) return;
    let loaded = false;
    const measure = () => {
      // Before the load the frame holds about:blank, whose height would collapse it
      if (!loaded) return;
      const body = frame.contentDocument?.body;
      if (body !== undefined) setHeight(Math.ceil(body.getBoundingClientRect().height));
    };
    const onLoad = () => {
      const doc = frame.contentDocument;
      if (doc === null) return;
      const style = doc.createElement('style');
      style.textContent = SHEET_STYLE;
      doc.head.append(style);
      loaded = true;
      measure();
    };
    // The report reflows when the page width changes
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    frame.addEventListener('load', onLoad);
    // Loaded before the listener was attached (a cached report)
    const doc = frame.contentDocument;
    if (doc?.readyState === 'complete' && doc.URL !== 'about:blank') onLoad();
    return () => {
      observer.disconnect();
      frame.removeEventListener('load', onLoad);
    };
  }, [src]);

  return (
    // The reports are table layouts for A4 paper: below ~46rem they scroll sideways instead of squeezing their columns
    <div className="relative overflow-x-auto overflow-y-hidden rounded-lg border bg-white shadow-sm dark:border-white/10 dark:shadow-black/40">
      {height === null && (
        <div className="absolute inset-0 flex items-start justify-center pt-24 text-sm text-neutral-500">
          <Spinner className="size-6" />
        </div>
      )}
      <iframe
        ref={frameRef}
        src={src}
        title={title}
        sandbox="allow-same-origin"
        className="block w-full min-w-[46rem]"
        style={{ height: height ?? '70vh' }}
      />
    </div>
  );
}
