import { Platform } from 'react-native';
import { strings } from '@/i18n/strings';
import { addDays, todayKey, toLocalDateTime } from '@/lib/dates';
import { isDueOn } from '@/lib/schedule';
import type { AppData, ChoreId, DateKey } from '@/types';

/**
 * Reminders are device-local notifications, so they only exist on iOS and
 * Android — `expo-notifications` ships no scheduler for web. Every entry point
 * here no-ops on web, and the module is required lazily so the web bundle never
 * pulls in the native module at all.
 */
export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export const CHORE_CATEGORY = 'chore-reminder';
export const ACTION_DONE = 'chore-done';
export const ACTION_SNOOZE = 'chore-snooze';

/** How far ahead reminders are scheduled. */
const LOOKAHEAD_DAYS = 14;
/** iOS caps pending local notifications at 64; stay comfortably under it. */
const MAX_SCHEDULED = 60;

type NotificationsModule = typeof import('expo-notifications');

function getNotifications(): NotificationsModule | undefined {
  if (!remindersSupported) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}

export interface ReminderPayload extends Record<string, unknown> {
  choreId: ChoreId;
  dueDate: DateKey;
}

/** Sets the foreground behaviour and registers the snooze/done action buttons. */
export async function configureNotifications(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  await Notifications.setNotificationCategoryAsync(CHORE_CATEGORY, [
    {
      identifier: ACTION_DONE,
      buttonTitle: strings.notification.categoryDone,
      options: { opensAppToForeground: false },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: strings.notification.categorySnooze,
      options: { opensAppToForeground: false },
    },
  ]);

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chores', {
      name: 'Kaam ke reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

/** Returns true when the OS allows us to post notifications. */
export async function ensurePermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

interface PlannedReminder {
  fireAt: Date;
  choreId: ChoreId;
  dueDate: DateKey;
  title: string;
  body: string;
}

/**
 * Works out every reminder that should be pending right now: one per unsettled
 * occurrence in the lookahead window, using the snoozed time when there is one.
 */
export function planReminders(data: AppData, now: Date = new Date()): PlannedReminder[] {
  const start = todayKey();
  const planned: PlannedReminder[] = [];

  for (const chore of data.chores) {
    if (chore.archived) continue;

    for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset += 1) {
      const dueDate = addDays(start, offset);
      if (!isDueOn(chore, dueDate)) continue;

      const matches = <T extends { choreId: string; dueDate: string }>(item: T) =>
        item.choreId === chore.id && item.dueDate === dueDate;

      // Settled occurrences have nothing left to nag about.
      if (data.completions.some(matches) || data.skips.some(matches)) continue;

      const snooze = data.snoozes.find(matches);
      const fireAt = snooze
        ? new Date(snooze.remindAt)
        : toLocalDateTime(dueDate, chore.reminderTime);

      if (fireAt.getTime() <= now.getTime()) continue;

      planned.push({
        fireAt,
        choreId: chore.id,
        dueDate,
        title: strings.notification.title(chore.title),
        body: strings.notification.body(chore.room),
      });
    }
  }

  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, MAX_SCHEDULED);
}

/**
 * Rewrites the device's pending reminders to match current state. Cancelling
 * and re-scheduling keeps this idempotent — far simpler than tracking which
 * notification id belongs to which occurrence across edits.
 */
export async function syncReminders(data: AppData): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of planReminders(data)) {
    const payload: ReminderPayload = { choreId: reminder.choreId, dueDate: reminder.dueDate };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        categoryIdentifier: CHORE_CATEGORY,
        data: payload,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireAt,
        channelId: Platform.OS === 'android' ? 'chores' : undefined,
      },
    });
  }
}

/** Subscribes to notification taps and action buttons. Returns an unsubscribe. */
export function addResponseListener(
  handler: (payload: ReminderPayload, actionIdentifier: string) => void,
): () => void {
  const Notifications = getNotifications();
  if (!Notifications) return () => {};

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const payload = response.notification.request.content.data as unknown as ReminderPayload;
    if (!payload?.choreId || !payload?.dueDate) return;
    handler(payload, response.actionIdentifier);
  });

  return () => subscription.remove();
}
