import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

/*
 * Sends chore reminders as Expo push notifications.
 *
 * A phone can only schedule local notifications for itself, so reminding a
 * different family member has to come from the server. This runs on a cron and
 * pushes whatever `due_reminders()` says is outstanding, in each assignee's own
 * timezone.
 *
 * Every send is recorded in reminder_deliveries before being considered done,
 * so a retry after a partial failure never double-notifies.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/* Expo accepts up to 100 messages per request. */
const BATCH_SIZE = 100;

interface DueReminder {
  chore_id: string;
  due_date: string;
  snooze_count: number;
  title: string;
  room: string | null;
  push_token: string;
  assignee_id: string;
}

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

function buildMessage(reminder: DueReminder) {
  return {
    to: reminder.push_token,
    title: `${reminder.title} ka time ho gaya`,
    body: reminder.room ? `${reminder.room} me karna hai` : 'Aaj karna hai',
    sound: 'default',
    channelId: 'chores',
    categoryId: 'chore-reminder',
    data: {
      choreId: reminder.chore_id,
      dueDate: reminder.due_date,
    },
  };
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size));
  return batches;
}

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    // The service role key bypasses RLS, which this job needs: it sends on
    // behalf of every household, not one signed-in user.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data, error } = await supabase.rpc('due_reminders');
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const reminders = (data ?? []) as DueReminder[];
  if (reminders.length === 0) {
    return new Response(JSON.stringify({ sent: 0, failed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const batch of chunk(reminders, BATCH_SIZE)) {
    let tickets: ExpoTicket[] = [];

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(batch.map(buildMessage)),
      });

      const payload = await response.json();
      tickets = (payload.data ?? []) as ExpoTicket[];
    } catch (caught) {
      // The whole batch failed to reach Expo. Leave it unmarked so the next
      // run retries it rather than silently dropping the reminders.
      failures.push(`batch failed: ${(caught as Error).message}`);
      continue;
    }

    for (const [index, reminder] of batch.entries()) {
      const ticket = tickets[index];

      if (ticket?.status === 'ok') {
        await supabase.rpc('mark_reminder_sent', {
          target_chore: reminder.chore_id,
          target_due: reminder.due_date,
          target_snooze_count: reminder.snooze_count,
        });
        sent += 1;
        continue;
      }

      const reason = ticket?.details?.error ?? ticket?.message ?? 'unknown';
      failures.push(`${reminder.chore_id}: ${reason}`);

      // A token that is no longer registered will never work again, so stop
      // retrying it and clear it from the profile.
      if (reason === 'DeviceNotRegistered') {
        await supabase
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', reminder.assignee_id);

        await supabase.rpc('mark_reminder_sent', {
          target_chore: reminder.chore_id,
          target_due: reminder.due_date,
          target_snooze_count: reminder.snooze_count,
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ sent, failed: failures.length, failures: failures.slice(0, 20) }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});
