// Cloud sync — pushes/pulls all user data to Supabase
import { supabase, isSupabaseConfigured } from './supabase';

// Keys mirrored from database.web.ts
const DATA_KEYS = ['tasks', 'events', 'habits', 'goals', 'notes', 'finance', 'messages', 'settings'] as const;

// ─── Push all localStorage to Supabase ───────────────────────────────────────

export async function syncToCloud(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const payload: Record<string, unknown> = { id: user.id, updated_at: new Date().toISOString() };
  for (const key of DATA_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      payload[key] = raw ? JSON.parse(raw) : (key === 'settings' ? {} : []);
    } catch {
      payload[key] = key === 'settings' ? {} : [];
    }
  }

  await supabase.from('user_data').upsert(payload, { onConflict: 'id' });
}

// ─── Pull from Supabase into localStorage ────────────────────────────────────

export async function syncFromCloud(): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase.from('user_data').select('*').eq('id', user.id).single();
  if (error || !data) return false;

  for (const key of DATA_KEYS) {
    if (data[key] !== null && data[key] !== undefined) {
      localStorage.setItem(key, JSON.stringify(data[key]));
    }
  }
  return true;
}

// ─── Debounced sync (call after any write) ────────────────────────────────────

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleSyncToCloud(): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    syncToCloud().catch(err => console.warn('Sync failed:', err));
    debounceTimer = null;
  }, 1500);
}
