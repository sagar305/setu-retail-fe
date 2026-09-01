/**
 * Generated from the Supabase schema. Regenerate after any migration with:
 *   npx supabase gen types typescript --project-id beujbhpsmapqbwfupkyw
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  color: string;
  expo_push_token: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface HouseholdMemberRow {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  joined_at: string;
}

export interface ChoreRow {
  id: string;
  household_id: string;
  title: string;
  notes: string | null;
  room: string | null;
  assignee_id: string;
  recurrence: Json;
  start_date: string;
  schedule_mode: 'fixed' | 'rolling';
  next_due_date: string | null;
  reminder_time: string;
  default_snooze: Json;
  points: number;
  archived: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChoreCompletionRow {
  id: string;
  chore_id: string;
  household_id: string;
  member_id: string | null;
  due_date: string;
  completed_at: string;
}

export interface ChoreSkipRow {
  id: string;
  chore_id: string;
  household_id: string;
  due_date: string;
  skipped_at: string;
}

export interface ChoreSnoozeRow {
  id: string;
  chore_id: string;
  household_id: string;
  due_date: string;
  remind_at: string;
  count: number;
  notified_at: string | null;
}
