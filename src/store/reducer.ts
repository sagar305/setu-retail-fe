import type { AppData, Chore, Completion, Member } from '@/types';

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
  | { type: 'reset' };

export const initialData: AppData = { members: [], chores: [], completions: [] };

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
      // Unassign the member's chores rather than deleting them.
      return {
        ...state,
        members: state.members.filter((m) => m.id !== action.id),
        chores: state.chores.map((c) =>
          c.assigneeId === action.id ? { ...c, assigneeId: null } : c,
        ),
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
      };

    case 'addCompletion':
      return { ...state, completions: [...state.completions, action.completion] };

    case 'removeCompletion':
      return {
        ...state,
        completions: state.completions.filter((c) => c.id !== action.id),
      };

    case 'reset':
      return initialData;

    default:
      return state;
  }
}
