import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createId } from '@/lib/id';
import { todayKey } from '@/lib/dates';
import { snoozeMinutes } from '@/lib/schedule';
import { clearData, loadData, saveData } from '@/storage/storage';
import type { AppData, Chore, DateKey, Member, SnoozeSetting } from '@/types';
import { Action, initialData, reducer } from './reducer';

const MEMBER_COLORS = ['#5B7CFA', '#F2994A', '#27AE60', '#EB5757', '#9B51E0', '#00B8D9'];

interface ChoresContextValue {
  data: AppData;
  /** False until persisted state has been read, so screens can hold off. */
  ready: boolean;
  addMember: (name: string) => Member;
  updateMember: (id: string, changes: Partial<Member>) => void;
  /** Refuses while the member still owns chores, since assignee is mandatory. */
  removeMember: (id: string) => { ok: true } | { ok: false; choreCount: number };
  addChore: (chore: Omit<Chore, 'id' | 'createdAt' | 'archived'>) => Chore;
  updateChore: (id: string, changes: Partial<Chore>) => void;
  removeChore: (id: string) => void;
  completeChore: (choreId: string, dueDate: DateKey) => void;
  uncompleteChore: (choreId: string, dueDate: DateKey) => void;
  skipChore: (choreId: string, dueDate: DateKey) => void;
  unskipChore: (choreId: string, dueDate: DateKey) => void;
  /** Defers this occurrence's reminder. The chore stays due. */
  snoozeChore: (choreId: string, dueDate: DateKey, setting: SnoozeSetting) => void;
  resetAll: () => Promise<void>;
}

const ChoresContext = createContext<ChoresContextValue | undefined>(undefined);

export function ChoresProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, initialData);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    let cancelled = false;
    loadData().then((loaded) => {
      if (cancelled) return;
      dispatch({ type: 'hydrate', data: loaded });
      hydrated.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on every change, but never before hydration — otherwise the
  // initial empty state would overwrite what's on disk.
  useEffect(() => {
    if (!hydrated.current) return;
    void saveData(data);
  }, [data]);

  const run = useCallback((action: Action) => dispatch(action), []);

  const value = useMemo<ChoresContextValue>(() => {
    const findOccurrence = <T extends { choreId: string; dueDate: string }>(
      list: T[],
      choreId: string,
      dueDate: string,
    ) => list.find((item) => item.choreId === choreId && item.dueDate === dueDate);

    return {
      data,
      ready,

      addMember: (name) => {
        const member: Member = {
          id: createId('m_'),
          name: name.trim(),
          color: MEMBER_COLORS[data.members.length % MEMBER_COLORS.length],
          createdAt: new Date().toISOString(),
        };
        run({ type: 'addMember', member });
        return member;
      },

      updateMember: (id, changes) => run({ type: 'updateMember', id, changes }),

      removeMember: (id) => {
        // TODO: needs input — what should happen to a removed member's chores?
        // Assignee is mandatory (A16), so for now removal is blocked while they
        // still own chores. Alternatives: reassign to someone else, or delete.
        const owned = data.chores.filter((c) => c.assigneeId === id && !c.archived);
        if (owned.length > 0) return { ok: false, choreCount: owned.length };
        run({ type: 'removeMember', id });
        return { ok: true };
      },

      addChore: (input) => {
        const chore: Chore = {
          ...input,
          id: createId('c_'),
          archived: false,
          createdAt: new Date().toISOString(),
        };
        run({ type: 'addChore', chore });
        return chore;
      },

      updateChore: (id, changes) => run({ type: 'updateChore', id, changes }),
      removeChore: (id) => run({ type: 'removeChore', id }),

      completeChore: (choreId, dueDate) => {
        if (findOccurrence(data.completions, choreId, dueDate)) return;
        const chore = data.chores.find((c) => c.id === choreId);
        if (!chore) return;

        run({
          type: 'addCompletion',
          completion: {
            id: createId('done_'),
            choreId,
            dueDate,
            memberId: chore.assigneeId,
            completedAt: new Date().toISOString(),
          },
        });

        // A finished occurrence has nothing left to remind about.
        const snooze = findOccurrence(data.snoozes, choreId, dueDate);
        if (snooze) run({ type: 'removeSnooze', id: snooze.id });
      },

      uncompleteChore: (choreId, dueDate) => {
        const existing = findOccurrence(data.completions, choreId, dueDate);
        if (existing) run({ type: 'removeCompletion', id: existing.id });
      },

      skipChore: (choreId, dueDate) => {
        if (findOccurrence(data.skips, choreId, dueDate)) return;
        run({
          type: 'addSkip',
          skip: { id: createId('skip_'), choreId, dueDate, skippedAt: new Date().toISOString() },
        });
        const snooze = findOccurrence(data.snoozes, choreId, dueDate);
        if (snooze) run({ type: 'removeSnooze', id: snooze.id });
      },

      unskipChore: (choreId, dueDate) => {
        const existing = findOccurrence(data.skips, choreId, dueDate);
        if (existing) run({ type: 'removeSkip', id: existing.id });
      },

      snoozeChore: (choreId, dueDate, setting) => {
        const existing = findOccurrence(data.snoozes, choreId, dueDate);
        const remindAt = new Date(Date.now() + snoozeMinutes(setting) * 60_000);
        run({
          type: 'upsertSnooze',
          snooze: {
            id: existing?.id ?? createId('snz_'),
            choreId,
            dueDate,
            remindAt: remindAt.toISOString(),
            count: (existing?.count ?? 0) + 1,
          },
        });
      },

      resetAll: async () => {
        await clearData();
        run({ type: 'reset' });
      },
    };
  }, [data, ready, run]);

  return <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>;
}

export function useChores(): ChoresContextValue {
  const context = useContext(ChoresContext);
  if (!context) throw new Error('useChores must be used inside a ChoresProvider');
  return context;
}

/** Convenience hook: the day the app currently treats as "today". */
export function useToday(): DateKey {
  return todayKey();
}
