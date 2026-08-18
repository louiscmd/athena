// Gmail integration — web only.
// Reuses the same OAuth token stored by google-calendar.web.ts.
// Metro auto-resolves .web.ts over .ts on the web platform.

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';
const TOKEN_KEY = 'gcal_access_token';
const EXPIRY_KEY = 'gcal_token_expiry';

// ── Auth check ────────────────────────────────────────────────────────────────

export function isGmailConnected(): boolean {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = parseInt(localStorage.getItem(EXPIRY_KEY) ?? '0', 10);
  return !!token && Date.now() < expiry;
}

function token(): string | null {
  return isGmailConnected() ? localStorage.getItem(TOKEN_KEY) : null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string;
  subject: string;
  snippet: string;
  date: number;
  unread: boolean;
}

// ── List messages ─────────────────────────────────────────────────────────────

export async function getInboxMessages(
  maxResults = 25,
  query = 'in:inbox',
): Promise<GmailMessage[]> {
  const tok = token();
  if (!tok) return [];

  try {
    const params = new URLSearchParams({ q: query, maxResults: String(maxResults) });
    const listRes = await fetch(`${BASE}/messages?${params}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!listRes.ok) { handleError(listRes.status); return []; }

    const listData = await listRes.json() as { messages?: { id: string }[] };
    const ids = (listData.messages ?? []).map(m => m.id);

    const messages = await Promise.all(ids.map(id => fetchMessageMeta(id, tok)));
    return messages.filter(Boolean) as GmailMessage[];
  } catch {
    return [];
  }
}

export async function getUnreadCount(): Promise<number> {
  const tok = token();
  if (!tok) return 0;
  try {
    const res = await fetch(`${BASE}/labels/INBOX`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return 0;
    const data = await res.json() as { messagesUnread?: number };
    return data.messagesUnread ?? 0;
  } catch { return 0; }
}

async function fetchMessageMeta(id: string, tok: string): Promise<GmailMessage | null> {
  try {
    const res = await fetch(
      `${BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${tok}` } },
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      id: string; threadId: string; snippet?: string;
      internalDate?: string; labelIds?: string[];
      payload?: { headers?: { name: string; value: string }[] };
    };

    const headers = data.payload?.headers ?? [];
    const get = (name: string) => headers.find(h => h.name === name)?.value ?? '';
    const fromRaw = get('From');
    const { name: fromName, email: fromEmail } = parseFrom(fromRaw);

    return {
      id,
      threadId: data.threadId,
      from: fromEmail,
      fromName,
      subject: get('Subject') || '(no subject)',
      snippet: data.snippet ?? '',
      date: parseInt(data.internalDate ?? '0', 10),
      unread: (data.labelIds ?? []).includes('UNREAD'),
    };
  } catch { return null; }
}

// ── Get full message body ─────────────────────────────────────────────────────

export async function getMessageBody(id: string): Promise<string> {
  const tok = token();
  if (!tok) return '';
  try {
    const res = await fetch(`${BASE}/messages/${id}?format=full`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (!res.ok) return '';
    const data = await res.json() as { payload?: unknown };
    return extractPlainText(data.payload);
  } catch { return ''; }
}

// ── Send email ────────────────────────────────────────────────────────────────

export async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const tok = token();
  if (!tok) return false;

  const raw = buildRfc2822({ to, subject, body });
  const encoded = base64url(raw);

  try {
    const res = await fetch(`${BASE}/messages/send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: encoded }),
    });
    return res.ok;
  } catch { return false; }
}

// ── Save draft ────────────────────────────────────────────────────────────────

export async function saveDraft(to: string, subject: string, body: string): Promise<string | null> {
  const tok = token();
  if (!tok) return null;

  const raw = buildRfc2822({ to, subject, body });
  const encoded = base64url(raw);

  try {
    const res = await fetch(`${BASE}/drafts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { raw: encoded } }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { id?: string };
    return data.id ?? null;
  } catch { return null; }
}

// ── Mark as read ──────────────────────────────────────────────────────────────

export async function markAsRead(id: string): Promise<void> {
  const tok = token();
  if (!tok) return;
  try {
    await fetch(`${BASE}/messages/${id}/modify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
    });
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFrom(raw: string): { name: string; email: string } {
  const match = raw.match(/^"?([^"<]*)"?\s*<?([^>]*)>?$/);
  if (match) {
    const name = match[1].trim() || match[2].trim();
    const email = match[2].trim() || match[1].trim();
    return { name, email };
  }
  return { name: raw, email: raw };
}

function extractPlainText(payload: unknown): string {
  const p = payload as Record<string, unknown> | null;
  if (!p) return '';

  const body = p.body as { data?: string } | undefined;
  if (body?.data) return decodeBase64url(body.data);

  const parts = p.parts as unknown[] | undefined;
  if (parts) {
    for (const part of parts) {
      const pt = part as Record<string, unknown>;
      if (pt.mimeType === 'text/plain') {
        const b = pt.body as { data?: string } | undefined;
        if (b?.data) return decodeBase64url(b.data);
      }
    }
    // Fallback: strip HTML
    for (const part of parts) {
      const pt = part as Record<string, unknown>;
      if (pt.mimeType === 'text/html') {
        const b = pt.body as { data?: string } | undefined;
        if (b?.data) {
          const html = decodeBase64url(b.data);
          return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }
    }
  }
  return '';
}

function decodeBase64url(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  try { return decodeURIComponent(escape(atob(b64))); } catch { return atob(b64); }
}

function base64url(text: string): string {
  const b64 = btoa(unescape(encodeURIComponent(text)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildRfc2822({ to, subject, body }: { to: string; subject: string; body: string }): string {
  return [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    btoa(unescape(encodeURIComponent(body))),
  ].join('\r\n');
}

function handleError(status: number) {
  if (status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRY_KEY);
  }
}
