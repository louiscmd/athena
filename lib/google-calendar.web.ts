// Google Calendar integration — web only.
// Uses Google Identity Services (Token model / implicit flow) — no backend needed.
// Metro auto-resolves .web.ts over .ts on the web platform.

// All Google scopes requested at once — Calendar + Gmail
const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');
const TOKEN_KEY = 'gcal_access_token';
const TOKEN_EXPIRY_KEY = 'gcal_token_expiry';
const BASE = 'https://www.googleapis.com/calendar/v3';

// ── Load GIS script ───────────────────────────────────────────────────────────

let gisLoaded = false;

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (gisLoaded || (window as any).google?.accounts?.oauth2) {
      gisLoaded = true;
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => { gisLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ── OAuth connect / disconnect ─────────────────────────────────────────────────

export async function connectGoogleCalendar(clientId: string): Promise<boolean> {
  if (!clientId.trim()) {
    console.warn('Google Client ID is empty');
    return false;
  }
  try {
    await loadGIS();
  } catch {
    console.error('Could not load GIS script');
    return false;
  }

  return new Promise((resolve) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response: { access_token?: string; expires_in?: number; error?: string }) => {
        if (response.access_token) {
          localStorage.setItem(TOKEN_KEY, response.access_token);
          const expiry = Date.now() + (response.expires_in ?? 3600) * 1000;
          localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiry));
          resolve(true);
        } else {
          console.error('Google OAuth error:', response.error);
          resolve(false);
        }
      },
    });
    client.requestAccessToken();
  });
}

export function isGoogleCalendarConnected(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(TOKEN_EXPIRY_KEY) ?? '0', 10);
  return !!token && Date.now() < expiry;
}

export function disconnectGoogleCalendar(): void {
  // Clear stored token — Athena is disconnected immediately.
  // The token naturally expires on Google's side; no revoke call needed.
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
    timeMin: new Date(from).toISOString(),
    timeMax: new Date(to).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  try {
    const res = await fetch(`${BASE}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 401) {
      // Token expired — clear it
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

  const body = {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: { dateTime: new Date(event.startTime).toISOString() },
    end: { dateTime: new Date(event.endTime).toISOString() },
  };

  try {
    const res = await fetch(`${BASE}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
  const endRaw: string = ev.end?.dateTime ?? ev.end?.date ?? '';
  return {
    id: ev.id as string,
    title: (ev.summary as string | undefined) ?? '(no title)',
    startTime: new Date(startRaw).getTime(),
    endTime: new Date(endRaw).getTime(),
    description: ev.description as string | undefined,
    location: ev.location as string | undefined,
    color: GOOGLE_COLORS[(ev.colorId as string | undefined) ?? ''] ?? '#cc1500',
    source: 'google',
  };
}

// Google calendar event color palette
const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb',
  '2': '#33b679',
  '3': '#8e24aa',
  '4': '#e67c73',
  '5': '#f6c026',
  '6': '#f5511d',
  '7': '#039be5',
  '8': '#616161',
  '9': '#3f51b5',
  '10': '#0b8043',
  '11': '#d60000',
};
