# Supabase backend

Project: `beujbhpsmapqbwfupkyw` (region `ap-northeast-2`).

This is a **separate project** from the household-services app. That one has
live users and untouched data; nothing here writes to it.

## What is already deployed

- **Tables** — `profiles`, `households`, `household_members`, `chores`,
  `chore_completions`, `chore_skips`, `chore_snoozes`, `reminder_deliveries`
- **RLS** — every table is scoped to household membership
- **RPCs** — `create_household`, `join_household`, `rotate_invite_code`,
  `remove_household_member`
- **Recurrence in SQL** — `chore_is_due_on`, mirroring `src/lib/schedule.ts`
- **Edge Function** — `send-reminders`, which pushes what `due_reminders()`
  reports as outstanding

## What still needs doing by hand

1. Run [`schedule-reminders.sql`](./schedule-reminders.sql) in the SQL editor,
   after pasting in your service role key. This starts the 5-minute cron that
   drives push notifications.
2. Set an EAS `projectId` in `app.json` (`expo.extra.eas.projectId`). Without
   it the app cannot obtain an Expo push token, so `profiles.expo_push_token`
   stays null and the sender has nobody to push to.

## Regenerating

```bash
# Pull the live schema into local migration files
npx supabase link --project-ref beujbhpsmapqbwfupkyw
npx supabase db pull

# Regenerate the client row types after any schema change
npx supabase gen types typescript --project-id beujbhpsmapqbwfupkyw
```

## Why some things are SECURITY DEFINER

- `is_household_member` / `is_household_owner` — RLS policies call these. They
  must read `household_members` without re-entering that table's own policy,
  which would recurse infinitely.
- `join_household` — resolves an invite code for a household the caller cannot
  yet see, so it has to run above RLS. It only ever adds the caller.
- `create_household` — creates the household and the owner's membership
  together, so a half-failure cannot leave an ownerless household.

Each checks `auth.uid()` itself, and `EXECUTE` is granted to `authenticated`
only — never to `anon`.
