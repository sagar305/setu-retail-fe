import type { AppData, Chore, Completion, Member, Skip, Snooze } from '@/types';

export type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'addMember'; member: Member }
  | { type: 'updateMember'; id: string; changes: Partial<Member> }
  | { type: 'removeMember'; id: string }
  | { type: 'addChore'; chore: Chore }
  | { type: 'updateChore'; id: string; changes: Partial<Chore> }
  | { type: 'removeChore'; id: string }
  | { type: 'addCompletion'; completion: Completion }
  | { type: 'removeCompletion'; id: string }
  | { type: 'addSkip'; skip: Skip }
  | { type: 'removeSkip'; id: string }
  | { type: 'upsertSnooze'; snooze: Snooze }
  | { type: 'removeSnooze'; id: string }
  | { type: 'reset' };

export const initialData: AppData = {
  members: [],
  chores: [],
  completions: [],
  skips: [],
  snoozes: [],
};

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'hydrate':
      return action.data;

    case 'addMember':
      return { ...state, members: [...state.members, action.member] };

    case 'updateMember':
      return {
        ...state,
        members: state.members.map((m) =>
          m.id === action.id ? { ...m, ...action.changes } : m,
        ),
      };

    case 'removeMember':
      // Every chore must keep a valid assignee, so callers are expected to
      // reassign first. The guard in ChoresProvider enforces that.
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.id),
      };

    case 'addChore':
      return { ...state, chores: [...state.chores, action.chore] };

    case 'updateChore':
      return {
        ...state,
        chores: state.chores.map((c) =>
          c.id === action.id ? { ...c, ...action.changes } : c,
        ),
      };

    case 'removeChore':
      return {
        ...state,
        chores: state.chores.filter((c) => c.id !== action.id),
        completions: state.completions.filter((c) => c.choreId !== action.id),
        skips: state.skips.filter((s) => s.choreId !== action.id),
        snoozes: state.snoozes.filter((s) => s.choreId !== action.id),
      };

    case 'addCompletion':
      return { ...state, completions: [...state.completions, action.completion] };

    case 'removeCompletion':
      return {
        ...state,
        completions: state.completions.filter((c) => c.id !== action.id),
      };

    case 'addSkip':
      return { ...state, skips: [...state.skips, action.skip] };

    case 'removeSkip':
      return { ...state, skips: state.skips.filter((s) => s.id !== action.id) };

    case 'upsertSnooze':
      return {
        ...state,
        snoozes: [
          ...state.snoozes.filter(
            (s) =>
              !(s.choreId === action.snooze.choreId && s.dueDate === action.snooze.dueDate),
          ),
          action.snooze,
        ],
      };

    case 'removeSnooze':
      return { ...state, snoozes: state.snoozes.filter((s) => s.id !== action.id) };

    case 'reset':
      return initialData;

    default:
      return state;
  }
}
