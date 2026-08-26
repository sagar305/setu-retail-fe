import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/supabase/client';

export interface AuthResult {
  ok: boolean;
  /** Present when ok is false — already translated for display. */
  error?: string;
  /** True when sign-up succeeded but the address still needs confirming. */
  needsEmailConfirmation?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  /** False until the stored session has been read back. */
  ready: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Supabase messages are in English and fairly technical; show Hinglish. */
function translateError(message: string): string {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'Email ya password galat hai';
  if (text.includes('email not confirmed')) return 'Pehle email confirm karein';
  if (text.includes('user already registered')) return 'Ye email pehle se registered hai';
  if (text.includes('password should be at least')) return 'Password kam se kam 6 characters ka rakhein';
  if (text.includes('unable to validate email')) return 'Email address sahi nahi lag raha';
  if (text.includes('rate limit') || text.includes('too many')) return 'Thodi der baad dobara koshish karein';
  if (text.includes('network') || text.includes('fetch')) return 'Internet nahi mil raha';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setReady(true);
    });

    // Fires on sign-in, sign-out, and silent token refreshes.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, fullName: string): Promise<AuthResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });

      if (error) return { ok: false, error: translateError(error.message) };

      // With confirmations on, Supabase returns a user but no session until
      // the address is verified.
      return { ok: true, needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: translateError(error.message) };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return { ok: false, error: translateError(error.message) };
    return { ok: true };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      ready,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
    }),
    [session, ready, signUp, signIn, signOut, sendPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
