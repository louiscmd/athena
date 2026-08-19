// Google Calendar + Gmail integration — web only.
// Uses OAuth2 implicit flow (redirect, not popup) — no backend needed.
// Redirect URI: https://athena-pied-one.vercel.app  (must be in Authorized redirect URIs)

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

const TOKEN_KEY        = 'gcal_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';
const CLIENT_ID_KEY    = 'gcal_client_id';
const REDIRECT_URI     = 'https://athena-pied-one.vercel.app';
const BASE             = 'https://www.googleapis.com/calendar/v3';

// ── OAuth connect ─────────────────────────────────────────────────────────────

export function connectGoogleCalendar(clientId: string): Promise<boolean> {
  // Save client ID so we can restore it after redirect
  localStorage.setItem(CLIENT_ID_KEY, clientId);

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  REDIRECT_URI,
    response_type: 'token',
    scope:         SCOPES,
    include_granted_scopes: 'true',
    state:         'gcal_oauth',
  });

  // Redirect away — token arrives in the URL hash on return
  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;

  // Resolves never (page navigates away); caller can ignore the promise
  return new Promise(() => {});
}

// ── Handle redirect callback (call on every app load) ─────────────────────────

export function handleGoogleCallback(): boolean {
  if (typeof window === 'undefined') return false;
  const hash = window.location.hash;
  if (!hash || !hash.includes('access_token')) return false;

  // Only process if this is a Google OAuth callback
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const state = params.get('state');
  if (state !== 'gcal_oauth') return false;

  const token     = params.get('access_token');
  const expiresIn = parseInt(params.get('expires_in') ?? '3600', 10);

  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
    // Clean the hash from the URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  return false;
}

// ── Status / disconnect ───────────────────────────────────────────────────────

export function isGoogleCalendarConnected(): boolean {
  const token  = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
  return !!token && Date.now() < expiry;
}

export function disconnectGoogleCalendar(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

// ── Fetch events ──────────────────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  startTime: number;
  endTime: number;
  description?: string;
  location?: string;
  color: string;
  source: 'google';
}

export async function getGoogleCalendarEvents(
  from: number,
  to: number,
): Promise<GoogleCalendarEvent[]> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !isGoogleCalendarConnected()) return [];

  const params = new URLSearchParams({
    timeMin:      new Date(from).toISOString(),
    timeMax:      new Date(to).toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '50',
  });

  try {
    const res = await fetch(`${BASE}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json() as { items?: unknown[] };
    return (data.items ?? []).map(parseGoogleEvent);
  } catch {
    return [];
  }
}

// ── Create event ──────────────────────────────────────────────────────────────

export async function createGoogleCalendarEvent(event: {
  title: string;
  startTime: number;
  endTime: number;
  description?: string;
  location?: string;
}): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !isGoogleCalendarConnected()) return false;

  try {
    const res = await fetch(`${BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary:     event.title,
        description: event.description,
        location:    event.location,
        start: { dateTime: new Date(event.startTime).toISOString() },
        end:   { dateTime: new Date(event.endTime).toISOString() },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Delete event ──────────────────────────────────────────────────────────────

export async function deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !isGoogleCalendarConnected()) return false;

  try {
    const res = await fetch(`${BASE}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

// ── Parse helper ──────────────────────────────────────────────────────────────

function parseGoogleEvent(item: unknown): GoogleCalendarEvent {
  const ev = item as Record<string, any>;
  const startRaw: string = ev.start?.dateTime ?? ev.start?.date ?? '';
  const endRaw:   string = ev.end?.dateTime   ?? ev.end?.date   ?? '';
  return {
    id:          ev.id as string,
    title:       (ev.summary as string | undefined) ?? '(no title)',
    startTime:   new Date(startRaw).getTime(),
    endTime:     new Date(endRaw).getTime(),
    description: ev.description as string | undefined,
    location:    ev.location as string | undefined,
    color:       GOOGLE_COLORS[(ev.colorId as string | undefined) ?? ''] ?? '#cc1500',
    source:      'google',
  };
}

const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
};
