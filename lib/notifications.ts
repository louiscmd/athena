import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleTaskNotification(
  taskId: string,
  title: string,
  dueDate: number,
  dueTime?: string,
): Promise<string | null> {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return null;

  let triggerDate = new Date(dueDate);

  if (dueTime) {
    const [hours, minutes] = dueTime.split(':').map(Number);
    triggerDate.setHours(hours, minutes, 0, 0);
  } else {
    // Default: notify at 9 AM on the due date
    triggerDate.setHours(9, 0, 0, 0);
  }

  // Subtract 15 minutes for early reminder
  const reminderTime = new Date(triggerDate.getTime() - 15 * 60 * 1000);

  if (reminderTime <= new Date()) return null;

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: '⚡ Athena Reminder',
      body: title,
      data: { taskId, type: 'task' },
      sound: true,
    },
    trigger: {
      date: reminderTime,
    },
  });

  return notificationId;
}

export async function scheduleDailyBriefing(time: string): Promise<void> {
  // Cancel existing briefing
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const existing = scheduled.find(n => n.content.data?.type === 'daily_briefing');
  if (existing) {
    await Notifications.cancelScheduledNotificationAsync(existing.identifier);
  }

  const [hours, minutes] = time.split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌅 Good morning!',
      body: 'Your daily briefing is ready. Tap to hear it.',
      data: { type: 'daily_briefing' },
      sound: true,
    },
    trigger: {
      hour: hours,
      minute: minutes,
      repeats: true,
    },
  });
}

export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
