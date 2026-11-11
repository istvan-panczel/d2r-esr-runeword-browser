import { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** "Copy as text": the sheet's plain-text summary to the clipboard (for a chat), confirmed in place for two seconds */
export function CopySheetButton({ text }: { readonly text: () => string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(
    () => () => {
      clearTimeout(timer.current);
    },
    []
  );
  const copy = () => {
    navigator.clipboard.writeText(text()).then(
      () => {
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      (error: unknown) => {
        console.error('Failed to copy the character sheet:', error);
        toast.error('Could not copy the sheet to the clipboard');
      }
    );
  };
  return (
    <Button type="button" variant="outline" onClick={copy}>
      {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy as text'}</span>
    </Button>
  );
}
