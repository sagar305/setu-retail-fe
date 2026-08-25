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
import { clearData, loadData, saveData } from '@/storage/storage';
import type { AppData, Chore, Member } from '@/types';
import { Action, initialData, reducer } from './reducer';

const MEMBER_COLORS = ['#5B7CFA', '#F2994A', '#27AE60', '#EB5757', '#9B51E0', '#00B8D9'];

interface ChoresContextValue {
  data: AppData;
  /** False until persisted state has been read, so screens can hold off. */
  ready: boolean;
  addMember: (name: string) => Member;
  updateMember: (id: string, changes: Partial<Member>) => void;
  removeMember: (id: string) => void;
  addChore: (chore: Omit<Chore, 'id' | 'createdAt' | 'archived'>) => Chore;
  updateChore: (id: string, changes: Partial<Chore>) => void;
  removeChore: (id: string) => void;
  /** Marks the chore's occurrence on `dueDate` as done. */
  completeChore: (choreId: string, dueDate: string, memberId?: string | null) => void;
  /** Undoes a completion for that occurrence, if one exists. */
  uncompleteChore: (choreId: string, dueDate: string) => void;
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
    return {
      data,
      ready,

      addMember: (name) => {
        const member: Member = {
          id: createId('m_'),
          name: name.trim(),
          color: MEMBER_COLORS[Math.floor(Math.random() * MEMBER_COLORS.length)],
          createdAt: new Date().toISOString(),
        };
        run({ type: 'addMember', member });
        return member;
      },

      updateMember: (id, changes) => run({ type: 'updateMember', id, changes }),
      removeMember: (id) => run({ type: 'removeMember', id }),

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

      completeChore: (choreId, dueDate, memberId) => {
        const existing = data.completions.find(
          (c) => c.choreId === choreId && c.dueDate === dueDate,
        );
        if (existing) return;
        run({
          type: 'addCompletion',
          completion: {
            id: createId('done_'),
            choreId,
            dueDate,
            memberId: memberId ?? null,
            completedAt: new Date().toISOString(),
          },
        });
      },

      uncompleteChore: (choreId, dueDate) => {
        const existing = data.completions.find(
          (c) => c.choreId === choreId && c.dueDate === dueDate,
        );
        if (existing) run({ type: 'removeCompletion', id: existing.id });
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
export function useToday(): string {
  return todayKey();
}
