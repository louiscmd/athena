import { supabase, isSupabaseConfigured } from './supabase';

export interface AthenaUser { id: string; email: string }

function mapUser(u: any): AthenaUser {
  return { id: u.id, email: u.email ?? '' };
}

export async function signUp(email: string, password: string): Promise<AthenaUser> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-up succeeded but no user returned.');
  return mapUser(data.user);
}

export async function signIn(email: string, password: string): Promise<AthenaUser> {
  if (!isSupabaseConfigured || !supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Sign-in failed.');
  return mapUser(data.user);
}

export async function signOut(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  await supabase.auth.signOut();
}

export async function getUser(): Promise<AthenaUser | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user ? mapUser(user) : null;
}

/** Subscribe to auth changes. Returns an unsubscribe function. */
export function onAuthChange(cb: (user: AthenaUser | null) => void): () => void {
  if (!isSupabaseConfigured || !supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session?.user ? mapUser(session.user) : null);
  });
  return () => subscription.unsubscribe();
}
