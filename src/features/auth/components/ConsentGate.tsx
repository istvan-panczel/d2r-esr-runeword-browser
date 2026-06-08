import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { acceptConsentRequested, selectAuthIsBusy, selectDisplayName } from '../store';
import { DISPLAY_NAME_MAX_LENGTH } from '../utils/profile';

// The privacy policy lives at the repo root (PRIVACY_POLICY.md). This links to it on the
// default branch; the link resolves once the build-sharing branch is merged to master.
const PRIVACY_POLICY_URL = 'https://github.com/istvan-panczel/d2r-esr-runeword-browser/blob/master/PRIVACY_POLICY.md';

/**
 * Full-page, non-dismissible consent gate shown after first login
 * (privacy_policy_accepted_at IS NULL). The parent only mounts this when consent
 * is required, so the display name is pre-filled correctly from the loaded profile.
 */
export function ConsentGate() {
  const dispatch = useDispatch();
  const busy = useSelector(selectAuthIsBusy);
  const initialName = useSelector(selectDisplayName) ?? '';
  const [name, setName] = useState(initialName);
  const [accepted, setAccepted] = useState(false);

  const trimmed = name.trim();
  const nameValid = trimmed.length > 0 && trimmed.length <= DISPLAY_NAME_MAX_LENGTH;
  const canSubmit = accepted && nameValid && !busy;

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    dispatch(acceptConsentRequested({ displayName: trimmed }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-bold">Welcome — one quick step</h2>
        <p className="mt-1 text-sm text-muted-foreground">Set your public display name and accept the privacy policy to continue.</p>

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="consent-display-name">Display name</Label>
            <Input
              id="consent-display-name"
              value={name}
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              Shown publicly as <span className="font-medium text-foreground">{trimmed.length > 0 ? trimmed : 'Name'}#1234</span> — a random
              4-digit tag is added automatically.
            </p>
          </div>

          <div className="flex items-start gap-2">
            <Checkbox
              id="consent-accept"
              checked={accepted}
              disabled={busy}
              onCheckedChange={(checked) => {
                setAccepted(checked === true);
              }}
            />
            <Label htmlFor="consent-accept" className="text-sm font-normal leading-snug">
              I have read and accept the{' '}
              <a href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
                Privacy Policy
              </a>
              .
            </Label>
          </div>

          <Button type="submit" disabled={!canSubmit} className="w-full">
            Continue
          </Button>
        </form>
      </div>
    </div>
  );
}
