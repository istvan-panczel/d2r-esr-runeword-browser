import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { setNotifyEnabled } from '../store/preferences';
import { notificationSupport, requestNotificationPermission, showTestNotification, type NotificationSupport } from '../utils/notifications';

interface NotificationToggleProps {
  readonly enabled: boolean;
  readonly watchedCount: number;
}

const HINTS: Readonly<Record<NotificationSupport, string | null>> = {
  unsupported: 'This browser cannot show notifications from a web page (Android Chrome, home-screen apps, iPhone Safari).',
  denied: 'Notifications are blocked for this site: allow them in the browser’s site settings, then turn this on again.',
  default: null,
  granted: null,
};

/**
 * The notification permission, kept current when it changes outside the page (site settings): through
 * `navigator.permissions` where the browser reports it, and re-read whenever the tab becomes visible again.
 */
function useNotificationPermission(): [NotificationSupport, () => void] {
  const [support, setSupport] = useState<NotificationSupport>(notificationSupport);
  useEffect(() => {
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const refresh = () => {
      setSupport(notificationSupport());
    };
    const ignore = () => {
      // No Permissions API for notifications (older Safari): the visibility re-read below still applies
    };
    try {
      navigator.permissions
        .query({ name: 'notifications' })
        .then((result) => {
          if (cancelled) return;
          status = result;
          status.addEventListener('change', refresh);
        })
        .catch(ignore);
    } catch {
      ignore();
    }
    document.addEventListener('visibilitychange', refresh);
    return () => {
      cancelled = true;
      status?.removeEventListener('change', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return [
    support,
    () => {
      setSupport(notificationSupport());
    },
  ];
}

/**
 * Opt-in browser notification when a watched group starts. Permission is asked only from this button's click, then a
 * confirmation notification is shown (a browser that cannot construct one counts as unsupported). The notifications
 * come only while a tab of the app is open and awake (no push service).
 */
export function NotificationToggle({ enabled, watchedCount }: NotificationToggleProps) {
  const [permission, refreshPermission] = useNotificationPermission();
  // Set when the confirmation notification could not be constructed
  const [cannotNotify, setCannotNotify] = useState(false);
  const support: NotificationSupport = cannotNotify ? 'unsupported' : permission;
  const active = enabled && support === 'granted';

  const toggle = async () => {
    if (active) {
      setNotifyEnabled(false);
      return;
    }
    const result = support === 'granted' ? support : await requestNotificationPermission();
    refreshPermission();
    if (result !== 'granted') {
      setNotifyEnabled(false);
      return;
    }
    const shown = showTestNotification();
    setCannotNotify(!shown);
    setNotifyEnabled(shown);
  };

  const hint = HINTS[support];
  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant={active ? 'default' : 'outline'}
        size="sm"
        aria-pressed={active}
        disabled={support === 'unsupported'}
        onClick={() => {
          void toggle();
        }}
      >
        {active ? <Bell className="size-4" /> : <BellOff className="size-4" />}
        Notify when a watched zone starts
      </Button>
      {hint !== null && <p className="text-xs text-muted-foreground">{hint}</p>}
      {active && watchedCount === 0 && <p className="text-xs text-muted-foreground">Star a zone group below to get notified.</p>}
      {active && (
        <p className="text-xs text-muted-foreground">
          Only while a tab of this site is open: a closed, sleeping or frozen tab does not notify (and a notification more than 5 minutes
          late is skipped).
        </p>
      )}
    </div>
  );
}
