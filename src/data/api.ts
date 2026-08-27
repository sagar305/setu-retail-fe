import { supabase } from '@/supabase/client';
import type {
  ChoreCompletionRow,
  ChoreRow,
  ChoreSkipRow,
  ChoreSnoozeRow,
  HouseholdMemberRow,
  HouseholdRow,
  ProfileRow,
} from '@/supabase/types';
import type { AppData, Chore, DateKey, SnoozeSetting } from '@/types';
import {
  choreFromRow,
  choreToRow,
  completionFromRow,
  memberFromProfile,
  skipFromRow,
  snoozeFromRow,
} from './mappers';

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
}

function toHousehold(row: HouseholdRow): Household {
  return {
    id: row.id,
    name: row.name,
    inviteCode: row.invite_code,
    ownerId: row.owner_id,
  };
}

/** Households the signed-in user belongs to, oldest first. */
export async function fetchHouseholds(): Promise<Household[]> {
  const { data, error } = await supabase
    .from('households')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as HouseholdRow[]).map(toHousehold);
}

export async function createHousehold(name: string): Promise<Household> {
  const { data, error } = await supabase.rpc('create_household', { household_name: name });
  if (error) throw error;
  return toHousehold(data as HouseholdRow);
}

export async function joinHousehold(code: string): Promise<Household> {
  const { data, error } = await supabase.rpc('join_household', { code });
  if (error) throw error;
  return toHousehold(data as HouseholdRow);
}

export async function rotateInviteCode(householdId: string): Promise<string> {
  const { data, error } = await supabase.rpc('rotate_invite_code', {
    target_household: householdId,
  });
  if (error) throw error;
  return data as string;
}

export async function removeMember(householdId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_household_member', {
    target_household: householdId,
    target_user: userId,
  });
  if (error) throw error;
}

/**
 * One round trip per table rather than a nested select: the occurrence tables
 * are filtered by household_id directly, so no joins are needed and each query
 * stays index-friendly.
 */
export async function fetchHouseholdData(householdId: string): Promise<AppData> {
  const [membersResult, choresResult, completionsResult, skipsResult, snoozesResult] =
    await Promise.all([
      supabase
        .from('household_members')
        .select('user_id, profiles:user_id (*)')
        .eq('household_id', householdId),
      supabase.from('chores').select('*').eq('household_id', householdId),
      supabase.from('chore_completions').select('*').eq('household_id', householdId),
      supabase.from('chore_skips').select('*').eq('household_id', householdId),
      supabase.from('chore_snoozes').select('*').eq('household_id', householdId),
    ]);

  for (const result of [membersResult, choresResult, completionsResult, skipsResult, snoozesResult]) {
    if (result.error) throw result.error;
  }

  type MemberJoin = Pick<HouseholdMemberRow, 'user_id'> & { profiles: ProfileRow | null };

  const members = (membersResult.data as unknown as MemberJoin[])
    .map((row) => row.profiles)
    .filter((profile): profile is ProfileRow => Boolean(profile))
    .map(memberFromProfile)
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    members,
    chores: (choresResult.data as ChoreRow[]).map(choreFromRow),
    completions: (completionsResult.data as ChoreCompletionRow[]).map(completionFromRow),
    skips: (skipsResult.data as ChoreSkipRow[]).map(skipFromRow),
    snoozes: (snoozesResult.data as ChoreSnoozeRow[]).map(snoozeFromRow),
  };
}

export async function upsertChore(
  chore: Chore,
  householdId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('chores')
    .upsert(choreToRow(chore, householdId, userId));
  if (error) throw error;
}

export async function deleteChore(choreId: string): Promise<void> {
  const { error } = await supabase.from('chores').delete().eq('id', choreId);
  if (error) throw error;
}

/*
 * Occurrence writes are keyed on (chore_id, due_date), so a replayed offline
 * write merges rather than duplicating.
 */
export async function markComplete(
  choreId: string,
  householdId: string,
  memberId: string,
  dueDate: DateKey,
): Promise<void> {
  const { error } = await supabase
    .from('chore_completions')
    .upsert(
      { chore_id: choreId, household_id: householdId, member_id: memberId, due_date: dueDate },
      { onConflict: 'chore_id,due_date' },
    );
  if (error) throw error;
}

export async function clearComplete(choreId: string, dueDate: DateKey): Promise<void> {
  const { error } = await supabase
    .from('chore_completions')
    .delete()
    .eq('chore_id', choreId)
    .eq('due_date', dueDate);
  if (error) throw error;
}

export async function markSkipped(
  choreId: string,
  householdId: string,
  dueDate: DateKey,
): Promise<void> {
  const { error } = await supabase
    .from('chore_skips')
    .upsert(
      { chore_id: choreId, household_id: householdId, due_date: dueDate },
      { onConflict: 'chore_id,due_date' },
    );
  if (error) throw error;
}

export async function clearSkipped(choreId: string, dueDate: DateKey): Promise<void> {
  const { error } = await supabase
    .from('chore_skips')
    .delete()
    .eq('chore_id', choreId)
    .eq('due_date', dueDate);
  if (error) throw error;
}

export async function saveSnooze(
  choreId: string,
  householdId: string,
  dueDate: DateKey,
  remindAt: string,
  count: number,
): Promise<void> {
  const { error } = await supabase
    .from('chore_snoozes')
    .upsert(
      {
        chore_id: choreId,
        household_id: householdId,
        due_date: dueDate,
        remind_at: remindAt,
        count,
        // A fresh snooze has not been delivered yet.
        notified_at: null,
      },
      { onConflict: 'chore_id,due_date' },
    );
  if (error) throw error;
}

export async function clearSnooze(choreId: string, dueDate: DateKey): Promise<void> {
  const { error } = await supabase
    .from('chore_snoozes')
    .delete()
    .eq('chore_id', choreId)
    .eq('due_date', dueDate);
  if (error) throw error;
}

/** Stores the device's push token so the server can reach this user. */
export async function savePushToken(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ expo_push_token: token })
    .eq('id', userId);
  if (error) throw error;
}

export async function saveTimezone(userId: string, timezone: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ timezone }).eq('id', userId);
  if (error) throw error;
}

export type { SnoozeSetting };
