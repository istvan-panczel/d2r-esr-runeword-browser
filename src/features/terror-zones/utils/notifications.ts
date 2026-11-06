import type { TerrorZoneSlot } from '../engine/schedule';

/** The browser's notification state: unsupported (no Notification API, e.g. iOS Safari outside a home-screen app) or the permission. */
export type NotificationSupport = 'unsupported' | NotificationPermission;

export function notificationSupport(): NotificationSupport {
  return typeof window === 'undefined' || !('Notification' in window) ? 'unsupported' : Notification.permission;
}

/** Asks for permission (call from a click handler only); resolves with the resulting state. */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationSupport();
  }
}

/**
 * Shows "Watched terror zone started" for a watched group that just started. The tag is the slot's start time, so two
 * open tabs that both get here show one notification (the second replaces the first silently).
 */
export function showTerrorZoneNotification(slot: TerrorZoneSlot, endsAt: string): void {
  if (notificationSupport() !== 'granted') return;
  try {
    new Notification('Watched terror zone started', {
      body: `${slot.zone.labels.join(', ')}\nUntil ${endsAt}`,
      tag: `terror-zone-${String(slot.start)}`,
    });
  } catch (error: unknown) {
    // Android Chrome only allows notifications from a service worker; nothing to fall back to
    console.warn('Terror zone notification failed:', error);
  }
}

/**
 * The confirmation shown when the user turns notifications on. false when the page cannot construct a notification:
 * Android Chrome (and home-screen apps) throw "Illegal constructor" outside a service worker; treat that as unsupported.
 */
export function showTestNotification(): boolean {
  try {
    new Notification('Terror zone notifications are on', {
      body: 'You will get one when a watched zone group starts, while a tab of this site is open.',
      tag: 'terror-zone-test',
    });
    return true;
  } catch (error: unknown) {
    console.warn('Terror zone notifications unavailable:', error);
    return false;
  }
}
