import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { savePushToken, saveTimezone } from '@/data/api';
import { useChores } from '@/store/ChoresProvider';
import {
  ACTION_DONE,
  ACTION_SNOOZE,
  addResponseListener,
  configureNotifications,
  ensurePermission,
  getPushToken,
  remindersSupported,
  syncReminders,
} from './reminders';

/**
 * Keeps this device's scheduled reminders in step with the store, applies the
 * Done / Baad mein buttons tapped from a notification, and registers the push
 * token the server needs to reach this user on other devices.
 *
 * Mount once, inside both providers. No-ops on web, which has no local
 * notification scheduler.
 */
export function useReminders(): void {
  const { user } = useAuth();
  const { data, ready, completeChore, snoozeChore } = useChores();
  const userId = user?.id ?? null;

  // The response listener is registered once, so it reads through a ref rather
  // than re-subscribing on every state change.
  const latest = useRef({ completeChore, snoozeChore, data, userId });
  latest.current = { completeChore, snoozeChore, data, userId };

  useEffect(() => {
    if (!remindersSupported) return;
    void (async () => {
      await configureNotifications();
      await ensurePermission();
    })();
  }, []);

  // Register this device for push, and record the timezone reminders fire in.
  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const token = await getPushToken();
      if (token) await savePushToken(userId, token).catch(() => undefined);

      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) await saveTimezone(userId, timezone).catch(() => undefined);
    })();
  }, [userId]);

  useEffect(() => {
    if (!remindersSupported || !ready) return;
    void syncReminders(data, userId);
  }, [data, ready, userId]);

  // A reminder can fire while the app is backgrounded; re-sync on return so
  // anything already delivered stops being counted as pending.
  useEffect(() => {
    if (!remindersSupported) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncReminders(latest.current.data, latest.current.userId);
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!remindersSupported) return;
    return addResponseListener(({ choreId, dueDate }, actionIdentifier) => {
      const current = latest.current;

      if (actionIdentifier === ACTION_DONE) {
        current.completeChore(choreId, dueDate);
        return;
      }
      if (actionIdentifier === ACTION_SNOOZE) {
        const chore = current.data.chores.find((c) => c.id === choreId);
        if (chore) current.snoozeChore(choreId, dueDate, chore.defaultSnooze);
      }
    });
  }, []);
}
