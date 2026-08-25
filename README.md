# Chorely

A React Native (Expo) app for managing chores around the house — who does what,
how often, and what's still outstanding.

## Running it

```bash
npm install
npm start          # then scan the QR code with Expo Go
npm run android    # or ios / web
npm run typecheck
```

## What's here today

- **Today** — everything due today plus anything overdue from the last two weeks,
  with a progress bar and one-tap completion.
- **Chores** — the full list, filterable by person, unassigned, or archived.
  Each row shows when it next comes around.
- **Household** — the people who share the chores, with completions, points and
  assignment counts over the last 30 days.
- **Add/edit chore** — title, room, recurrence, assignee, points and notes.

Data is stored locally on the device with AsyncStorage; there is no backend yet.

## Layout

```
app/                    Screens (expo-router file-based routing)
  _layout.tsx           Root stack + providers
  (tabs)/               Today / Chores / Household
  chore/edit.tsx        Add & edit form (modal)
src/
  components/           Reusable UI (ChoreCard, Chip, Button, …)
  lib/dates.ts          YYYY-MM-DD date maths, timezone-safe
  lib/schedule.ts       Recurrence engine — is a chore due on a given day?
  store/                Context + reducer + selectors
  storage/              AsyncStorage persistence
  theme/                Colours, spacing, typography tokens
  types/                Domain types
```

### How recurrence works

Dates are handled as `YYYY-MM-DD` strings with all arithmetic in UTC, so "due
today" means the same thing regardless of timezone or DST. A chore stores a
rule (`once` / `daily` / `weekly` / `monthly`, an interval, and optional
weekdays) rather than a list of dates; `isDueOn(chore, date)` resolves it on
demand. Completions are recorded against a `(choreId, dueDate)` pair, so
history stays correct even if the rule changes later.
