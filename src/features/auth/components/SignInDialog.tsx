import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { MailCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  closeSignInDialog,
  discordSignInRequested,
  magicLinkRequested,
  selectAuthIsBusy,
  selectMagicLinkSent,
  selectSignInDialogOpen,
} from '../store';
import { storeAuthReturnTo } from '../utils/redirect';

function DiscordIcon({ className }: { readonly className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function SignInDialog() {
  const dispatch = useDispatch();
  const location = useLocation();
  const open = useSelector(selectSignInDialogOpen);
  const busy = useSelector(selectAuthIsBusy);
  const linkSent = useSelector(selectMagicLinkSent);
  const [email, setEmail] = useState('');

  const rememberReturn = () => {
    storeAuthReturnTo(`${location.pathname}${location.search}`);
  };

  const handleDiscord = () => {
    rememberReturn();
    dispatch(discordSignInRequested());
  };

  const handleMagicLink = (event: React.SyntheticEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (trimmed.length === 0) return;
    rememberReturn();
    dispatch(magicLinkRequested(trimmed));
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) dispatch(closeSignInDialog());
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Sign in</DialogTitle>
          <DialogDescription>Sign in to create, like, and share builds.</DialogDescription>
        </DialogHeader>

        {linkSent ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <MailCheck className="size-10 text-primary" />
            <p className="text-sm font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              We sent a magic link to <span className="font-medium text-foreground">{email}</span>. Click it to finish signing in.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Button onClick={handleDiscord} disabled={busy} className="w-full bg-[#5865F2] text-white hover:bg-[#4752c4]">
              <DiscordIcon className="size-5" />
              Sign in with Discord
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleMagicLink} className="flex flex-col gap-2">
              <Label htmlFor="magic-link-email">Email</Label>
              <Input
                id="magic-link-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value);
                }}
              />
              <Button type="submit" variant="outline" disabled={busy || email.trim().length === 0} className="w-full">
                Send magic link
              </Button>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
