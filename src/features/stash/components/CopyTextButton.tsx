import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface CopyTextButtonProps {
  readonly text: string;
  /** Accessible name and tooltip ("Copy Hotspur") */
  readonly label: string;
}

/** A small icon button that copies `text` to the clipboard and shows a check for a moment. */
export function CopyTextButton({ text, label }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      clearTimeout(resetTimer.current);
    };
  }, []);

  const copy = () => {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setCopied(false);
        }, 1500);
      },
      (error: unknown) => {
        console.error('Failed to copy:', error);
        toast.error('Could not copy to the clipboard');
      }
    );
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="size-7"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={label}
    >
      {copied ? <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
