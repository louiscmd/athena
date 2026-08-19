// Buffer API integration — web only
// Docs: https://buffer.com/developers/api

const API = 'https://api.bufferapp.com/1';

export interface BufferProfile {
  id: string;
  service: string;       // 'twitter' | 'instagram' | 'facebook' | 'linkedin' | ...
  service_username: string;
  formatted_username: string;
}

export interface BufferUpdate {
  id: string;
  text: string;
  status: string;
  scheduled_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function token(): string {
  try { return localStorage.getItem('athena_buffer_token') ?? ''; } catch { return ''; }
}

async function get<T>(path: string): Promise<T> {
  const t = token();
  if (!t) throw new Error('No Buffer access token');
  const res = await fetch(`${API}${path}?access_token=${encodeURIComponent(t)}`);
  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function post<T>(path: string, body: Record<string, string | string[]>): Promise<T> {
  const t = token();
  if (!t) throw new Error('No Buffer access token');
  const params = new URLSearchParams();
  params.append('access_token', t);
  for (const [k, v] of Object.entries(body)) {
    if (Array.isArray(v)) v.forEach(val => params.append(`${k}[]`, val));
    else params.append(k, v);
  }
  const res = await fetch(`${API}${path}.json`, {
    method: 'POST',
    body: params,
  });
  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${await res.text()}`);
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns all connected social profiles */
export async function getBufferProfiles(): Promise<BufferProfile[]> {
  const profiles = await get<BufferProfile[]>('/profiles.json');
  return profiles;
}

/**
 * Schedule a post on one or more profiles.
 * @param text        The post text
 * @param profileIds  Array of Buffer profile IDs to post to
 * @param scheduledAt Optional ISO timestamp; omit to add to queue at next slot
 */
export async function schedulePost(
  text: string,
  profileIds: string[],
  scheduledAt?: string,
): Promise<BufferUpdate[]> {
  const body: Record<string, string | string[]> = {
    text,
    profile_ids: profileIds,
    shorten: 'false',
  };
  if (scheduledAt) {
    body.scheduled_at = scheduledAt;
    body.now = 'false';
  }
  const result = await post<{ updates: BufferUpdate[] }>('/updates/create', body);
  return result.updates ?? [];
}

/**
 * Convenience: schedule a post mentioning a service by name.
 * Looks up profiles and picks the first match for that service.
 */
export async function schedulePostByService(
  text: string,
  service: string,   // e.g. "instagram", "twitter", "linkedin"
  scheduledAt?: string,
): Promise<string> {
  const profiles = await getBufferProfiles();
  const matched  = profiles.filter(p =>
    p.service.toLowerCase().includes(service.toLowerCase()),
  );
  if (matched.length === 0) {
    return `No ${service} account connected in Buffer.`;
  }
  const ids = matched.map(p => p.id);
  await schedulePost(text, ids, scheduledAt);
  const names = matched.map(p => p.formatted_username).join(', ');
  return scheduledAt
    ? `Scheduled for ${service} (${names}) at ${scheduledAt}.`
    : `Added to Buffer queue for ${service} (${names}).`;
}

/** Verify the token works — returns the authenticated user */
export async function verifyBufferToken(accessToken: string): Promise<{ id: string; name: string } | null> {
  try {
    const res = await fetch(`${API}/user.json?access_token=${encodeURIComponent(accessToken)}`);
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export function isBufferConnected(): boolean {
  try { return !!localStorage.getItem('athena_buffer_token'); } catch { return false; }
}

export function saveBufferToken(token: string): void {
  try { localStorage.setItem('athena_buffer_token', token); } catch {}
}

export function disconnectBuffer(): void {
  try { localStorage.removeItem('athena_buffer_token'); } catch {}
}
