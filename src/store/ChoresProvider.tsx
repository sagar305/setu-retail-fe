import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { createId } from '@/lib/id';
import { todayKey } from '@/lib/dates';
import { advanceFrom, snoozeMinutes } from '@/lib/schedule';
import { strings } from '@/i18n/strings';
import { supabase } from '@/supabase/client';
import * as api from '@/data/api';
import type { Household } from '@/data/api';
import { enqueue, flushQueue, readQueue } from '@/data/queue';
import type { AppData, Chore, DateKey, SnoozeSetting } from '@/types';

const emptyData: AppData = {
  members: [],
  chores: [],
  completions: [],
  skips: [],
  snoozes: [],
};

// v2: caches written before ids were UUIDs hold records the server never
// accepted, so they are not read back.
const cacheKey = (householdId: string) => `chorely:cache:v2:${householdId}`;
const LAST_HOUSEHOLD_KEY = 'chorely:lastHousehold';

interface ChoresContextValue {
  data: AppData;
  /** False until the cache (or first fetch) has resolved. */
  ready: boolean;
  /** Households the user belongs to. */
  households: Household[];
  household: Household | null;
  selectHousehold: (id: string) => void;
  createHousehold: (name: string) => Promise<Household>;
  joinHousehold: (code: string) => Promise<Household>;
  rotateInviteCode: () => Promise<string>;
  removeMember: (userId: string) => Promise<void>;
  addChore: (chore: Omit<Chore, 'id' | 'createdAt' | 'archived'>) => Chore;
  updateChore: (id: string, changes: Partial<Chore>) => void;
  removeChore: (id: string) => void;
  completeChore: (choreId: string, dueDate: DateKey) => void;
  /**
   * Records a rolling chore as done on `completedOn`, which may be earlier or
   * later than the day it was due, and moves the next occurrence to the
   * recurrence gap measured from that day.
   */
  completeRollingChore: (choreId: string, completedOn: DateKey) => void;
  uncompleteChore: (choreId: string, dueDate: DateKey) => void;
  skipChore: (choreId: string, dueDate: DateKey) => void;
  unskipChore: (choreId: string, dueDate: DateKey) => void;
  snoozeChore: (choreId: string, dueDate: DateKey, setting: SnoozeSetting) => void;
  refresh: () => Promise<void>;
  /** Writes applied locally but not yet accepted by the server. */
  pendingWrites: number;
  syncError: string | null;
}

const ChoresContext = createContext<ChoresContextValue | undefined>(undefined);

export function ChoresProvider({ children }: { children: React.ReactNode }) {
  const { user, ready: authReady } = useAuth();

  const [households, setHouseholds] = useState<Household[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [ready, setReady] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [syncError, setSyncError] = useState<string | null>(null);

  const household = useMemo(
    () => households.find((h) => h.id === householdId) ?? null,
    [households, householdId],
  );

  // Reads its own latest values without re-subscribing listeners.
  const latest = useRef({ householdId, data, userId: user?.id });
  latest.current = { householdId, data, userId: user?.id };

  const refreshPendingCount = useCallback(async () => {
    setPendingWrites((await readQueue()).length);
  }, []);

  /** Applies a local change immediately, then tries to send it. */
  const applyLocally = useCallback(
    (next: AppData) => {
      setData(next);
      const id = latest.current.householdId;
      if (id) void AsyncStorage.setItem(cacheKey(id), JSON.stringify(next));
    },
    [],
  );

  const push = useCallback(
    async (op: Parameters<typeof enqueue>[0]) => {
      const { householdId: id, userId } = latest.current;
      if (!id || !userId) return;

      await enqueue(op, id, userId);
      const result = await flushQueue();
      setPendingWrites(result.remaining);

      if (result.dropped > 0) setSyncError(strings.household.syncDropped(result.dropped));
      else if (result.remaining > 0) setSyncError(strings.household.syncPending);
      else setSyncError(null);
    },
    [],
  );

  // ---- household discovery ----
  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setHouseholds([]);
      setHouseholdId(null);
      setData(emptyData);
      setReady(true);
      return;
    }

    let active = true;
    (async () => {
      try {
        const list = await api.fetchHouseholds();
        if (!active) return;
        setHouseholds(list);

        const remembered = await AsyncStorage.getItem(LAST_HOUSEHOLD_KEY);
        const chosen =
          list.find((h) => h.id === remembered)?.id ?? list[0]?.id ?? null;
        setHouseholdId(chosen);
      } catch (error) {
        if (active) setSyncError((error as Error).message);
      } finally {
        if (active) setReady(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [authReady, user]);

  // ---- load a household: cache first, then server ----
  useEffect(() => {
    if (!householdId) {
      setData(emptyData);
      return;
    }

    let active = true;
    void AsyncStorage.setItem(LAST_HOUSEHOLD_KEY, householdId);

    (async () => {
      // Render whatever was last seen so the app is usable offline instantly.
      try {
        const cached = await AsyncStorage.getItem(cacheKey(householdId));
        if (cached && active) setData(JSON.parse(cached) as AppData);
      } catch {
        // A corrupt cache is not worth surfacing; the fetch below replaces it.
      }

      try {
        // Send anything queued from a previous session before reading, so the
        // fetch reflects our own offline work.
        await flushQueue();
        const fresh = await api.fetchHouseholdData(householdId);
        if (!active) return;
        setData(fresh);
        setSyncError(null);
        await AsyncStorage.setItem(cacheKey(householdId), JSON.stringify(fresh));
      } catch (error) {
        if (active) setSyncError((error as Error).message);
      } finally {
        void refreshPendingCount();
      }
    })();

    return () => {
      active = false;
    };
  }, [householdId, refreshPendingCount]);

  const refresh = useCallback(async () => {
    const id = latest.current.householdId;
    if (!id) return;
    try {
      await flushQueue();
      const fresh = await api.fetchHouseholdData(id);
      setData(fresh);
      setSyncError(null);
      await AsyncStorage.setItem(cacheKey(id), JSON.stringify(fresh));
    } catch (error) {
      setSyncError((error as Error).message);
    } finally {
      void refreshPendingCount();
    }
  }, [refreshPendingCount]);

  // ---- realtime: someone else's change lands here ----
  useEffect(() => {
    if (!householdId) return;

    const filter = `household_id=eq.${householdId}`;
    const channel = supabase.channel(`household:${householdId}`);

    for (const table of ['chores', 'chore_completions', 'chore_skips', 'chore_snoozes']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        void refresh();
      });
    }
    // Membership has no household filter issue but changes who appears.
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'household_members', filter },
      () => void refresh(),
    );

    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [householdId, refresh]);

  // ---- retry queued writes when the app comes back ----
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const result = await flushQueue();
        setPendingWrites(result.remaining);
        if (result.sent > 0) void refresh();
      })();
    });
    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo<ChoresContextValue>(() => {
    const find = <T extends { choreId: string; dueDate: string }>(
      list: T[],
      choreId: string,
      dueDate: string,
    ) => list.find((item) => item.choreId === choreId && item.dueDate === dueDate);

    return {
      data,
      ready,
      households,
      household,
      pendingWrites,
      syncError,
      refresh,

      selectHousehold: (id) => setHouseholdId(id),

      createHousehold: async (name) => {
        const created = await api.createHousehold(name);
        setHouseholds((current) => [...current, created]);
        setHouseholdId(created.id);
        return created;
      },

      joinHousehold: async (code) => {
        const joined = await api.joinHousehold(code);
        setHouseholds((current) =>
          current.some((h) => h.id === joined.id) ? current : [...current, joined],
        );
        setHouseholdId(joined.id);
        return joined;
      },

      rotateInviteCode: async () => {
        const id = latest.current.householdId;
        if (!id) throw new Error('Koi ghar nahi chuna');
        const fresh = await api.rotateInviteCode(id);
        setHouseholds((current) =>
          current.map((h) => (h.id === id ? { ...h, inviteCode: fresh } : h)),
        );
        return fresh;
      },

      removeMember: async (userId) => {
        const id = latest.current.householdId;
        if (!id) return;
        await api.removeMember(id, userId);
        await refresh();
      },

      addChore: (input) => {
        const chore: Chore = {
          ...input,
          id: createId(),
          archived: false,
          createdAt: new Date().toISOString(),
        };
        applyLocally({ ...data, chores: [...data.chores, chore] });
        void push({ kind: 'upsertChore', chore });
        return chore;
      },

      updateChore: (id, changes) => {
        const existing = data.chores.find((c) => c.id === id);
        if (!existing) return;
        const updated = { ...existing, ...changes };
        applyLocally({
          ...data,
          chores: data.chores.map((c) => (c.id === id ? updated : c)),
        });
        void push({ kind: 'upsertChore', chore: updated });
      },

      removeChore: (id) => {
        applyLocally({
          ...data,
          chores: data.chores.filter((c) => c.id !== id),
          completions: data.completions.filter((c) => c.choreId !== id),
          skips: data.skips.filter((s) => s.choreId !== id),
          snoozes: data.snoozes.filter((s) => s.choreId !== id),
        });
        void push({ kind: 'deleteChore', choreId: id });
      },

      completeChore: (choreId, dueDate) => {
        if (find(data.completions, choreId, dueDate)) return;
        const chore = data.chores.find((c) => c.id === choreId);
        if (!chore) return;

        // Ticking a rolling chore on its due day is the same operation as
        // logging it early, just with today's date.
        if (chore.scheduleMode === 'rolling') {
          value.completeRollingChore(choreId, dueDate);
          return;
        }

        const snooze = find(data.snoozes, choreId, dueDate);
        applyLocally({
          ...data,
          completions: [
            ...data.completions,
            {
              id: createId(),
              choreId,
              dueDate,
              memberId: chore.assigneeId,
              completedAt: new Date().toISOString(),
            },
          ],
          // A finished occurrence has nothing left to remind about.
          snoozes: data.snoozes.filter((s) => s !== snooze),
        });

        void push({
          kind: 'complete',
          choreId,
          dueDate,
          memberId: chore.assigneeId,
        });
        if (snooze) void push({ kind: 'clearSnooze', choreId, dueDate });
      },

      completeRollingChore: (choreId, completedOn) => {
        const chore = data.chores.find((c) => c.id === choreId);
        if (!chore || chore.scheduleMode !== 'rolling') return;
        if (find(data.completions, choreId, completedOn)) return;

        const nextDueDate = advanceFrom(chore.recurrence, completedOn) ?? chore.nextDueDate;
        const updated = { ...chore, nextDueDate };

        // Any snooze belonged to the occurrence this completion replaces.
        const snooze = data.snoozes.find((s) => s.choreId === choreId);

        applyLocally({
          ...data,
          chores: data.chores.map((c) => (c.id === choreId ? updated : c)),
          completions: [
            ...data.completions,
            {
              id: createId(),
              choreId,
              dueDate: completedOn,
              memberId: chore.assigneeId,
              completedAt: new Date().toISOString(),
            },
          ],
          snoozes: data.snoozes.filter((s) => s !== snooze),
        });

        void push({ kind: 'complete', choreId, dueDate: completedOn, memberId: chore.assigneeId });
        void push({ kind: 'upsertChore', chore: updated });
        if (snooze) void push({ kind: 'clearSnooze', choreId, dueDate: snooze.dueDate });
      },

      uncompleteChore: (choreId, dueDate) => {
        const existing = find(data.completions, choreId, dueDate);
        if (!existing) return;
        applyLocally({
          ...data,
          completions: data.completions.filter((c) => c.id !== existing.id),
        });
        void push({ kind: 'uncomplete', choreId, dueDate });
      },

      skipChore: (choreId, dueDate) => {
        if (find(data.skips, choreId, dueDate)) return;
        const snooze = find(data.snoozes, choreId, dueDate);
        applyLocally({
          ...data,
          skips: [
            ...data.skips,
            { id: createId(), choreId, dueDate, skippedAt: new Date().toISOString() },
          ],
          snoozes: data.snoozes.filter((s) => s !== snooze),
        });
        void push({ kind: 'skip', choreId, dueDate });
        if (snooze) void push({ kind: 'clearSnooze', choreId, dueDate });
      },

      unskipChore: (choreId, dueDate) => {
        const existing = find(data.skips, choreId, dueDate);
        if (!existing) return;
        applyLocally({ ...data, skips: data.skips.filter((s) => s.id !== existing.id) });
        void push({ kind: 'unskip', choreId, dueDate });
      },

      snoozeChore: (choreId, dueDate, setting) => {
        const existing = find(data.snoozes, choreId, dueDate);
        const remindAt = new Date(Date.now() + snoozeMinutes(setting) * 60_000).toISOString();
        const count = (existing?.count ?? 0) + 1;

        applyLocally({
          ...data,
          snoozes: [
            ...data.snoozes.filter((s) => s !== existing),
            { id: existing?.id ?? createId(), choreId, dueDate, remindAt, count },
          ],
        });
        void push({ kind: 'snooze', choreId, dueDate, remindAt, count });
      },
    };
  }, [data, ready, households, household, pendingWrites, syncError, applyLocally, push, refresh]);

  return <ChoresContext.Provider value={value}>{children}</ChoresContext.Provider>;
}

export function useChores(): ChoresContextValue {
  const context = useContext(ChoresContext);
  if (!context) throw new Error('useChores must be used inside a ChoresProvider');
  return context;
}

export function useToday(): DateKey {
  return todayKey();
}
