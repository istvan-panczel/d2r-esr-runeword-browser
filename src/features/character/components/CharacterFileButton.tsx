import { useRef, type ReactNode } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useCharacter } from '../hooks/useCharacter';

interface CharacterFileButtonProps {
  readonly children: ReactNode;
  readonly variant?: 'default' | 'outline';
  readonly size?: 'default' | 'sm';
}

/** A button opening the file picker for any number of .d2s, optionally together with their .d2rl */
export function CharacterFileButton({ children, variant = 'default', size = 'default' }: CharacterFileButtonProps) {
  const { upload, busy } = useCharacter();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".d2s,.d2rl"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Reset, so picking the same file again (after the game saved it) fires a change
          event.target.value = '';
          if (files.length > 0) void upload(files);
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
