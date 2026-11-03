import { useRef, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useStash } from '../hooks/useStash';

interface StashFileButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'outline';
  readonly size?: 'default' | 'sm';
}

/** A button opening the file picker for a .d2i file; the picked file goes to the stash upload. */
export function StashFileButton({ children, variant = 'default', size = 'default' }: StashFileButtonProps) {
  const { upload, busy } = useStash();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".d2i"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.item(0) ?? null;
          // Reset, so picking the same file again (after the game saved it) fires a change
          event.target.value = '';
          if (file !== null) void upload(file);
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={busy}
        onClick={() => {
          input.current?.click();
        }}
      >
        {busy ? <Spinner className="size-4" /> : <Upload className="size-4" />}
        {children}
      </Button>
    </>
  );
}
