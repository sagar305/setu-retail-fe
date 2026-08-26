import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppData } from '@/types';

// v2 added skips, snoozes, reminder times and a mandatory assignee. The shape
// changed incompatibly, so v1 records are not read back.
const STORAGE_KEY = 'chorely:data:v2';

export const emptyData: AppData = {
  members: [],
  chores: [],
  completions: [],
  skips: [],
  snoozes: [],
};

/**
 * Reads persisted state. Anything unreadable (corrupt JSON, an older shape)
 * falls back to empty data rather than crashing the app on launch.
 */
export async function loadData(): Promise<AppData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;

    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      members: Array.isArray(parsed.members) ? parsed.members : [],
      chores: Array.isArray(parsed.chores) ? parsed.chores : [],
      completions: Array.isArray(parsed.completions) ? parsed.completions : [],
      skips: Array.isArray(parsed.skips) ? parsed.skips : [],
      snoozes: Array.isArray(parsed.snoozes) ? parsed.snoozes : [],
    };
  } catch {
    return emptyData;
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export async function clearData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
