import { createClient } from '@supabase/supabase-js';

// Strip any trailing path (e.g. /rest/v1/) — Supabase client needs just the base origin
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

const rawUrl      = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const supabaseUrl = normalizeUrl(rawUrl);
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'athena_auth',
        detectSessionInUrl: false, // Prevent Supabase from consuming Google's #access_token hash
      },
    })
  : null;
