// Spotify integration — web only, PKCE OAuth flow.
// Metro auto-resolves .web.ts over .ts on the web platform.

const REDIRECT_URI = 'https://athena-pied-one.vercel.app';
const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
const TOKEN_ENDPOINT = 'https://accounts.spotify.com/api/token';
const API_BASE = 'https://api.spotify.com/v1';

const TOKEN_KEY = 'spotify_access_token';
const REFRESH_KEY = 'spotify_refresh_token';
const EXPIRY_KEY = 'spotify_token_expiry';
const VERIFIER_KEY = 'spotify_code_verifier';
const CLIENT_KEY = 'spotify_client_id';

const SCOPES = [
  'streaming',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'user-library-read',
  'user-top-read',
  'user-read-email',
  'user-read-private',
].join(' ');

// ── PKCE helpers ──────────────────────────────────────────────────────────────

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function pkce(): Promise<{ verifier: string; challenge: string }> {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  const verifier = b64url(arr);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: b64url(digest) };
}

// ── Connect (redirect to Spotify) ─────────────────────────────────────────────

export async function connectSpotify(clientId: string): Promise<void> {
  const { verifier, challenge } = await pkce();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(CLIENT_KEY + '_pending', clientId);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: 'spotify_auth',
  });

  window.location.href = `${AUTH_ENDPOINT}?${params}`;
}

// ── Handle OAuth callback (call on app load) ──────────────────────────────────

export async function handleSpotifyCallback(): Promise<boolean> {
  const search = new URLSearchParams(window.location.search);
  const code = search.get('code');
  const state = search.get('state');
  if (!code || state !== 'spotify_auth') return false;

  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const clientId =
    sessionStorage.getItem(CLIENT_KEY + '_pending') ?? localStorage.getItem(CLIENT_KEY);
  if (!verifier || !clientId) return false;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: clientId,
    code_verifier: verifier,
  });

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = await res.json() as {
      access_token: string; expires_in: number; refresh_token?: string;
    };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    localStorage.setItem(CLIENT_KEY, clientId);

    // Clean up URL and session storage
    window.history.replaceState({}, '', '/');
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(CLIENT_KEY + '_pending');
    return true;
  } catch { return false; }
}

// ── Token refresh ─────────────────────────────────────────────────────────────

async function refreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  const clientId = localStorage.getItem(CLIENT_KEY);
  if (!refresh || !clientId) return false;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh,
    client_id: clientId,
  });

  try {
    const res = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!res.ok) return false;
    const data = await res.json() as {
      access_token: string; expires_in: number; refresh_token?: string;
    };
    localStorage.setItem(TOKEN_KEY, data.access_token);
    localStorage.setItem(EXPIRY_KEY, String(Date.now() + data.expires_in * 1000));
    if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
    return true;
  } catch { return false; }
}

// ── Auth status ───────────────────────────────────────────────────────────────

export function isSpotifyConnected(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) ?? '0', 10);
  return !!token && Date.now() < expiry;
}

export function disconnectSpotify(): void {
  [TOKEN_KEY, REFRESH_KEY, EXPIRY_KEY, CLIENT_KEY].forEach(k => localStorage.removeItem(k));
}

async function getToken(): Promise<string | null> {
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) ?? '0', 10);
  if (Date.now() > expiry - 60_000) {
    const ok = await refreshToken();
    if (!ok) return null;
  }
  return localStorage.getItem(TOKEN_KEY);
}

async function apiFetch(path: string, options?: RequestInit): Promise<Response | null> {
  const tok = await getToken();
  if (!tok) return null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${tok}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
  }
  return res;
}

// ── Now Playing ───────────────────────────────────────────────────────────────

export interface NowPlaying {
  isPlaying: boolean;
  trackName: string;
  artists: string;
  albumName: string;
  albumArt: string;
  progressMs: number;
  durationMs: number;
  trackId: string;
  deviceName: string;
}

export async function getNowPlaying(): Promise<NowPlaying | null> {
  try {
    const res = await apiFetch('/me/player/currently-playing');
    if (!res || res.status === 204 || !res.ok) return null;
    const data = await res.json() as Record<string, any>;
    if (!data?.item) return null;
    return {
      isPlaying: data.is_playing,
      trackName: data.item.name,
      artists: data.item.artists.map((a: any) => a.name).join(', '),
      albumName: data.item.album.name,
      albumArt: data.item.album.images?.[0]?.url ?? '',
      progressMs: data.progress_ms ?? 0,
      durationMs: data.item.duration_ms,
      trackId: data.item.id,
      deviceName: data.device?.name ?? '',
    };
  } catch { return null; }
}

// ── Playback controls ─────────────────────────────────────────────────────────

export async function play(contextUri?: string, trackUri?: string): Promise<boolean> {
  const body: Record<string, unknown> = {};
  if (contextUri) body.context_uri = contextUri;
  if (trackUri) body.uris = [trackUri];
  const res = await apiFetch('/me/player/play', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  return !!res?.ok;
}

export async function pause(): Promise<boolean> {
  const res = await apiFetch('/me/player/pause', { method: 'PUT' });
  return !!res?.ok;
}

export async function next(): Promise<boolean> {
  const res = await apiFetch('/me/player/next', { method: 'POST' });
  return !!res?.ok;
}

export async function previous(): Promise<boolean> {
  const res = await apiFetch('/me/player/previous', { method: 'POST' });
  return !!res?.ok;
}

export async function setVolume(pct: number): Promise<boolean> {
  const res = await apiFetch(`/me/player/volume?volume_percent=${Math.round(pct)}`, { method: 'PUT' });
  return !!res?.ok;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string; uri: string; name: string; artists: string; albumArt: string; durationMs: number;
}
export interface SpotifyPlaylist {
  id: string; uri: string; name: string; description: string; art: string; trackCount: number;
}

export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) });
  const res = await apiFetch(`/search?${params}`);
  if (!res?.ok) return [];
  const data = await res.json() as Record<string, any>;
  return (data.tracks?.items ?? []).map((t: any) => ({
    id: t.id, uri: t.uri, name: t.name,
    artists: t.artists.map((a: any) => a.name).join(', '),
    albumArt: t.album.images?.[1]?.url ?? '',
    durationMs: t.duration_ms,
  }));
}

export async function searchPlaylists(query: string, limit = 10): Promise<SpotifyPlaylist[]> {
  const params = new URLSearchParams({ q: query, type: 'playlist', limit: String(limit) });
  const res = await apiFetch(`/search?${params}`);
  if (!res?.ok) return [];
  const data = await res.json() as Record<string, any>;
  return (data.playlists?.items ?? []).filter(Boolean).map((p: any) => ({
    id: p.id, uri: p.uri, name: p.name,
    description: p.description ?? '',
    art: p.images?.[0]?.url ?? '',
    trackCount: p.tracks?.total ?? 0,
  }));
}

// ── User playlists ────────────────────────────────────────────────────────────

export async function getMyPlaylists(limit = 20): Promise<SpotifyPlaylist[]> {
  const res = await apiFetch(`/me/playlists?limit=${limit}`);
  if (!res?.ok) return [];
  const data = await res.json() as Record<string, any>;
  return (data.items ?? []).map((p: any) => ({
    id: p.id, uri: p.uri, name: p.name,
    description: p.description ?? '',
    art: p.images?.[0]?.url ?? '',
    trackCount: p.tracks?.total ?? 0,
  }));
}

// ── Available devices ─────────────────────────────────────────────────────────

export interface SpotifyDevice {
  id: string; name: string; type: string; isActive: boolean; volumePct: number;
}

export async function getDevices(): Promise<SpotifyDevice[]> {
  const res = await apiFetch('/me/player/devices');
  if (!res?.ok) return [];
  const data = await res.json() as Record<string, any>;
  return (data.devices ?? []).map((d: any) => ({
    id: d.id, name: d.name, type: d.type,
    isActive: d.is_active, volumePct: d.volume_percent,
  }));
}
