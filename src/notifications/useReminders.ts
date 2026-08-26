import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useChores } from '@/store/ChoresProvider';
import {
  ACTION_DONE,
  ACTION_SNOOZE,
  addResponseListener,
  configureNotifications,
  ensurePermission,
  remindersSupported,
  syncReminders,
} from './reminders';

/**
 * Keeps the device's scheduled reminders in step with the store, and applies
 * the Done / Baad mein buttons tapped straight from a notification.
 *
 * Mount once, inside ChoresProvider. No-ops on web, where the platform has no
 * local notification scheduler.
 */
export function useReminders(): void {
  const { data, ready, completeChore, snoozeChore } = useChores();

  // The listener is registered once, so it reads its actions through a ref to
  // avoid re-subscribing on every state change.
  const actions = useRef({ completeChore, snoozeChore, data });
  actions.current = { completeChore, snoozeChore, data };

  useEffect(() => {
    if (!remindersSupported) return;
    void (async () => {
      await configureNotifications();
      await ensurePermission();
    })();
  }, []);

  useEffect(() => {
    if (!remindersSupported || !ready) return;
    void syncReminders(data);
  }, [data, ready]);

  // A reminder can fire while the app is backgrounded; re-sync on return so
  // anything already delivered stops being counted as pending.
  useEffect(() => {
    if (!remindersSupported) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncReminders(actions.current.data);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!remindersSupported) return;
    return addResponseListener(({ choreId, dueDate }, actionIdentifier) => {
      const current = actions.current;
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
