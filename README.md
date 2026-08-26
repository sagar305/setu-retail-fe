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

## What works today (phase 1)

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

Data is stored on the device with AsyncStorage. No accounts, no sync yet.

## Not built yet (phases 2–5)

Email auth, remote database, household invite codes, and offline sync. These
need a Supabase project before they can start.

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
