import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure notification behavior
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

const DAILY_REMINDER_ID = 'naam-jap-daily-reminder';

export interface PushNotificationState {
    expoPushToken: string | null;
    notification: Notifications.Notification | null;
    error: string | null;
}

export function useNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [notification, setNotification] = useState<Notifications.Notification | null>(null);
    const [error, setError] = useState<string | null>(null);
    const notificationListener = useRef<Notifications.EventSubscription | null>(null);
    const responseListener = useRef<Notifications.EventSubscription | null>(null);

    async function registerForPushNotificationsAsync(): Promise<string | null> {
        if (Platform.OS === 'web') return null;

        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFD700',
            });

            await Notifications.setNotificationChannelAsync('daily-reminder', {
                name: 'Daily Naam Jap Reminder',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FFD700',
                sound: 'default',
            });
        }

        if (!Device.isDevice) {
            console.log('Push notifications require a physical device');
            setError('Push notifications require a physical device');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            setError('Permission not granted for push notifications');
            console.log('Push notification permission not granted');
            return null;
        }

        try {
            const projectId =
                Constants.expoConfig?.extra?.eas?.projectId ??
                (Constants as any).easConfig?.projectId;

            console.log('EAS projectId:', projectId);

            if (!projectId) {
                console.warn('No EAS projectId found — cannot get real push token');
                setError('No EAS projectId configured');
                return null;
            }

            const pushTokenData = await Notifications.getExpoPushTokenAsync({ projectId });
            console.log('Got real push token:', pushTokenData.data);
            return pushTokenData.data;
        } catch (e: any) {
            console.error('Failed to get push token:', e?.message);
            setError('Failed to get push token: ' + e?.message);
            return null;
        }
    }

    async function updatePushTokenOnServer(token: string) {
        try {
            console.log('=== updatePushTokenOnServer START ===');
            console.log('Token to save:', token);

            // Store token locally so it's available during registration
            await AsyncStorage.setItem('@naam_jap_push_token', token);
            console.log('Token saved to AsyncStorage');

            const deviceId = await AsyncStorage.getItem('@naam_jap_device_id');
            console.log('Device ID from AsyncStorage:', deviceId);

            if (!deviceId) {
                console.log('No deviceId yet — token saved locally, will sync during registration');
                return;
            }

            const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://your-server-url.vercel.app/api';
            console.log('Calling update-push-token API:', `${API_BASE_URL}/naam-jap/update-push-token`);

            const response = await fetch(`${API_BASE_URL}/naam-jap/update-push-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceId, pushToken: token }),
            });
            const result = await response.json();
            console.log('Server response:', JSON.stringify(result));

            if (result.success) {
                console.log('Push token updated on server successfully');
            } else {
                console.warn('Failed to update push token on server:', result.message);
            }
        } catch (err) {
            console.error('Error updating push token on server:', err);
        }
        console.log('=== updatePushTokenOnServer END ===');
    }

    useEffect(() => {
        (async () => {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                setExpoPushToken(token);
                await updatePushTokenOnServer(token);
            }
            await scheduleDailyReminder();
        })();

        notificationListener.current = Notifications.addNotificationReceivedListener((notif) => {
            console.log('Notification received:', notif.request.content.title);
            setNotification(notif);
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

    return { expoPushToken, notification, error, updatePushTokenOnServer, scheduleDailyReminder, cancelDailyReminder };
}

export async function getExpoPushToken(): Promise<string | null> {
    try {
        if (Platform.OS === 'web') return null;
        if (!Device.isDevice) return null;

        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return null;

        const projectId =
            Constants.expoConfig?.extra?.eas?.projectId ??
            (Constants as any).easConfig?.projectId;

        if (!projectId) return null;

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        return tokenData.data;
    } catch {
        return null;
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

        console.log('Daily reminders scheduled');
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

export async function sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, unknown>
) {
    await Notifications.scheduleNotificationAsync({
        content: {
            title,
            body,
            data: data || {},
        },
        trigger: null,
    });
}
