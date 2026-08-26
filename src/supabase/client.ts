import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * The URL and publishable key are safe to ship in the bundle — they identify
 * the project, they do not grant access. Row Level Security is what actually
 * protects the data, and it is enforced server-side for every request.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? extra.supabaseKey;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_KEY, or expo.extra.supabaseUrl / supabaseKey in app.json.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    // Sessions live in AsyncStorage on device and localStorage on web, so a
    // signed-in user stays signed in across restarts.
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only the web build can read a session back out of a redirect URL.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
