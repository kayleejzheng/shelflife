// Local reminders (work in Expo Go): a daily "expiring soon" nudge and a weekly stock check-in.
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Returns false if the user denied permission
export async function setReminders(on: boolean): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!on) return true;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return false;

  await Notifications.scheduleNotificationAsync({
    content: { title: 'ShelfLife', body: "Check what's expiring in your pantry before dinner.", data: { screen: 'pantry' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 17, minute: 30 },
  });
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Time for a quick check-in', body: 'Swipe through your pantry so it stays up to date. It takes a minute.', data: { screen: 'checkin' } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 11, minute: 0 }, // Sundays
  });
  return true;
}

// Tapping a reminder opens the matching screen
export function onReminderTap(handler: (screen: string) => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const screen = response.notification.request.content.data?.screen;
    if (typeof screen === 'string') handler(screen);
  });
  return () => sub.remove();
}
