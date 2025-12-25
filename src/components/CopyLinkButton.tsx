import { useState } from 'react';
import { Link, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 2000);
      },
      (err: unknown) => {
        // Fallback for older browsers - silently fail
        console.error('Failed to copy link:', err);
      }
    );
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}>
      {copied ? (
        <>
          <Check className="size-4" />
          Copied!
        </>
      ) : (
        <>
          <Link className="size-4" />
          Copy Link
        </>
      )}
    </Button>
  );
}
