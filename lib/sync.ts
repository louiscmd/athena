// Native stub — sync is web/Supabase only
export async function syncToCloud(): Promise<void> {}
export async function syncFromCloud(): Promise<boolean> { return false; }
export function scheduleSyncToCloud(): void {}
