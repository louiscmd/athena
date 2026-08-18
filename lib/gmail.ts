// Native stub — Gmail is web-only for now.
export interface GmailMessage {
  id: string; threadId: string; from: string; fromName: string;
  subject: string; snippet: string; date: number; unread: boolean;
}
export function isGmailConnected(): boolean { return false; }
export async function getInboxMessages(_max?: number, _q?: string): Promise<GmailMessage[]> { return []; }
export async function getUnreadCount(): Promise<number> { return 0; }
export async function getMessageBody(_id: string): Promise<string> { return ''; }
export async function sendEmail(_to: string, _subject: string, _body: string): Promise<boolean> { return false; }
export async function saveDraft(_to: string, _subject: string, _body: string): Promise<string | null> { return null; }
export async function markAsRead(_id: string): Promise<void> {}
