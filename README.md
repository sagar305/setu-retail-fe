# Chorely

Ghar ke kaam manage karne ke liye ek React Native (Expo) app — kaun karega, kitni
baar, aur kya baaki hai.

The app's UI copy is Hinglish; the code and docs are English.

## Running it

```bash
npm install
npm start           # scan the QR code with a dev build
npm run android     # or ios / web
npm run typecheck
npm run test:schedule   # recurrence + snooze assertions
npm run build:web       # static web bundle for hosting
```

Reminders use local notifications, which need a **development build** — Android
push was removed from Expo Go in SDK 53. Everything else runs in Expo Go.

## Builds

`eas.json` defines four profiles:

| Profile | Use | Output |
|---|---|---|
| `development` | Day-to-day dev on a real device; needed for reminders | APK / installable iOS build |
| `simulator` | iOS Simulator (needs a Mac to run, not to build) | `.app` for the simulator |
| `preview` | Share a test build with the family | APK / ad-hoc iOS |
| `production` | Store submission | AAB / IPA |

```bash
eas build --profile development --platform android
eas build --profile development --platform ios
eas build --profile development --platform all
```

iOS builds run on EAS's Mac machines, so a Mac is not required to *build* —
only to run the simulator. A paid Apple Developer account is required for any
build that runs on a physical iPhone.

### Trying it on an iPhone for free

No Mac and no Apple Developer account needed:

```bash
npm run start:go     # forces Expo Go rather than a dev build
```

Install Expo Go from the App Store and scan the QR code. Local reminders — the
ones for your own chores — work there: `scheduleNotificationAsync` has no Expo
Go restriction on either platform.

What Expo Go cannot do is receive the *server* push that reminds a different
household member. On Android, `getExpoPushTokenAsync` throws outright in Expo
Go since SDK 53; on iOS it only warns, and the token belongs to Expo Go rather
than to this app. Testing that path properly needs a development build, which
needs the paid account.

## Setup

The Supabase URL and publishable key are already in `app.json`. Two things are
not, and reminders to *other* people stay off until both are done:

1. Run `supabase/schedule-reminders.sql` in the Supabase SQL editor (paste your
   service role key in first). This starts the cron that sends push reminders.
2. Add your EAS project id to `app.json` under `expo.extra.eas.projectId`, then
   build a development build. Without it the app cannot get a push token.

See [`supabase/README.md`](./supabase/README.md) for the backend details.

## What works today

**Frequency** — every chore picks one of nine rules, chosen from a bottom sheet:

| Preset | Meaning |
|---|---|
| Ek baar | One-off, on the start date |
| Roz | Every day |
| Ek din chhod kar | Every 2 days |
| Somvar se Shanivar | Mon–Sat (Sunday off) |
| Sirf Ravivar | Every Sunday |
| Har 2 hafte | Every 2 weeks on a chosen weekday |
| Har 4 hafte | Every 4 weeks on a chosen weekday |
| Ek Ravivar chhod kar | Every other Sunday |
| Apni marzi se | Every N days / weeks (+ weekdays) / months (+ dates) |

**Reminders** — a per-chore time, fired as a local notification with `Ho gaya`
and `Baad mein` buttons. Tapping the notification opens the app to pick a
different snooze.

**Snooze** — 6 hours, 12 hours, 1 day, 1 week, or a custom number of
hours/days. Each chore stores a default, overridable when the reminder fires.
Snoozing defers only the reminder: the chore stays due, and later occurrences
are untouched.

**Skip** — `Chhod dein` settles an occurrence without completing it, so it
stops nagging and stops counting as overdue.

**Assignee** — exactly one member per chore, mandatory. They get the reminder.

**Screens** — Aaj (today + overdue + progress), Kaam (all chores, filterable),
Ghar (members and 30-day stats).

**Accounts** — email sign-up, sign-in and password reset. Email confirmation is
required before the first sign-in.

**Households** — every household has an 8-character invite code, drawn from an
alphabet with no `0`/`O` or `1`/`I` confusion. Share it and the other person
sees the same chores after signing up. Owners can rotate the code to revoke it.
One account can belong to several households.

**Sync** — the local cache renders first, so the app opens instantly and works
offline; the server load then replaces it. Writes apply immediately and are
queued on disk if they fail, draining oldest-first when the connection returns.
Realtime subscriptions pull in changes other people make.

**Reminders across devices** — a phone can only schedule local notifications
for itself, so reminding someone else runs through a server job
(`supabase/functions/send-reminders`) that pushes to each assignee in their own
timezone. Local notifications still cover your own chores with no server round
trip.

## Layout

```
app/                    Screens (expo-router file-based routing)
  _layout.tsx           Root stack, providers, reminder wiring
  (tabs)/               Aaj / Kaam / Ghar
  chore/edit.tsx        Add & edit form (modal)
src/
  components/           Reusable UI (ChoreCard, Sheet, TimeField, …)
  i18n/strings.ts       All user-facing copy, in one place
  lib/dates.ts          YYYY-MM-DD date maths, timezone-safe
  lib/schedule.ts       Recurrence engine + snooze durations
  notifications/        Local reminder scheduling (mobile only)
  store/                Context + reducer + selectors
  storage/              AsyncStorage persistence
  theme/                Colours, spacing, typography tokens
  types/                Domain types
scripts/                Assertion suite for the schedule engine
```

### How recurrence works

Dates are `YYYY-MM-DD` strings with all arithmetic in UTC, so "due today" means
the same thing regardless of timezone or DST. A chore stores a *rule*, not a
list of dates, and `isDueOn(chore, date)` resolves it on demand.

Week-based presets anchor to the chore's **first real occurrence**, not to the
calendar week containing its start date — otherwise a chore created on Monday
that repeats on alternate Sundays would skip its own first Sunday.

`Har 4 hafte` and `Har 2 hafte` are deliberately week-based rather than
calendar-month based, which sidesteps the "31st of February" problem entirely.

Completions, skips and snoozes are all keyed on a `(choreId, dueDate)` pair, so
history stays correct when a rule changes later, and the same completion
arriving twice merges instead of duplicating.

### Web

The app runs on web (`npm run web`, or `npm run build:web` for a static
bundle). Reminders are the one thing that does not: `expo-notifications`
declares `platforms: ["apple", "android"]` and ships no scheduler for web, so
`src/notifications/reminders.ts` no-ops there and the rest of the app behaves
normally.
