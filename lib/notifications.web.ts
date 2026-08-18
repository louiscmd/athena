// Web stubs for notifications — uses browser Notification API where available

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function scheduleTaskNotification(
  taskId: string,
  title: string,
  dueDate: number,
  dueTime?: string,
): Promise<string | null> {
  // Browser can't schedule future notifications — store for reference only
  return `web-${taskId}`;
}

export async function scheduleDailyBriefing(_time: string): Promise<void> {
  // Not supported natively on web without a service worker
}

export async function cancelNotification(_id: string): Promise<void> {}
export async function cancelAllNotifications(): Promise<void> {}
