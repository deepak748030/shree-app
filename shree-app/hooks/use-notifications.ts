import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const DAILY_REMINDER_ID = 'naam-jap-daily-reminder';

export function useNotifications() {
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    useEffect(() => {
        registerForPushNotifications();
        scheduleDailyReminder();

        notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
            console.log('Notification received:', notification.request.content.title);
        });

        responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
            console.log('Notification tapped:', response.notification.request.content.title);
        });

        return () => {
            if (notificationListener.current) {
                notificationListener.current.remove();
            }
            if (responseListener.current) {
                responseListener.current.remove();
            }
        };
    }, []);

    return { scheduleDailyReminder, cancelDailyReminder, getExpoPushToken };
}

async function getExpoPushToken(): Promise<string | null> {
    try {
        if (Platform.OS === 'web') return null;
        if (!Device.isDevice) return null;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return null;

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId: '871acfb5-6e9c-44d0-87d3-f5d921051c6d',
        });
        return tokenData.data;
    } catch {
        return null;
    }
}

async function registerForPushNotifications() {
    try {
        if (Platform.OS === 'web') return;

        if (!Device.isDevice) {
            console.log('Push notifications require a physical device');
            return;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Notification permission not granted');
            return;
        }

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('daily-reminder', {
                name: 'Daily Naam Jap Reminder',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFD700',
                sound: 'default',
            });
        }
    } catch (error) {
        console.warn('Failed to register for push notifications:', error);
    }
}

async function scheduleDailyReminder() {
    try {
        if (Platform.OS === 'web') return;

        await cancelDailyReminder();

        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'श्री जी 🙏',
                body: 'जय श्री राधे! आज का नाम जप करना न भूलें। राधा नाम की शक्ति से दिन मंगलमय हो।',
                sound: 'default',
                data: { screen: 'naam-jap-counter' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 7,
                minute: 0,
            },
            identifier: DAILY_REMINDER_ID,
        });

        await Notifications.scheduleNotificationAsync({
            content: {
                title: 'श्री जी 🙏',
                body: 'राधा नाम जपें और अपनी माला पूरी करें। जय श्री राधे!',
                sound: 'default',
                data: { screen: 'naam-jap-counter' },
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 19,
                minute: 0,
            },
            identifier: `${DAILY_REMINDER_ID}-evening`,
        });
    } catch (error) {
        console.warn('Failed to schedule daily reminder:', error);
    }
}

async function cancelDailyReminder() {
    try {
        await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
        await Notifications.cancelScheduledNotificationAsync(`${DAILY_REMINDER_ID}-evening`);
    } catch {
        // Ignore
    }
}
