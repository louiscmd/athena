// Native stub — Google Calendar OAuth is web-only for now.
// Metro resolves .web.ts on web; this stub prevents import errors on native.

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

export async function connectGoogleCalendar(_clientId: string): Promise<boolean> { return false; }
export function handleGoogleCallback(): boolean { return false; }
export function isGoogleCalendarConnected(): boolean { return false; }
export function disconnectGoogleCalendar(): void {}
export async function getGoogleCalendarEvents(_from: number, _to: number): Promise<GoogleCalendarEvent[]> { return []; }
export async function createGoogleCalendarEvent(_event: unknown): Promise<boolean> { return false; }
export async function deleteGoogleCalendarEvent(_id: string): Promise<boolean> { return false; }
