
import AnimatedSplash from '@/components/animated-splash';
import ForceUpdateScreen from '@/components/force-update-screen';
import LanguagePickerModal from '@/components/language-picker-modal';
import MobileAuthScreen from '@/components/mobile-auth-screen';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { LanguageProvider, useLanguage } from '@/contexts/language-context';
import { AppThemeProvider } from '@/contexts/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNotifications, requestNotificationPermission } from '@/hooks/use-notifications';
import { checkAppVersion, type AppVersionCheck } from '@/services/api';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
  const colorScheme = useColorScheme();
  const { loading: langLoading, hasChosenLanguage, markLanguageChosen } = useLanguage();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [showLangPicker, setShowLangPicker] = useState(true);
  const [showMobileAuth, setShowMobileAuth] = useState(true);
  const [forceUpdate, setForceUpdate] = useState<AppVersionCheck | null>(null);
  const [versionChecked, setVersionChecked] = useState(false);

  // Reset showMobileAuth when user logs out so auth screen shows again
  React.useEffect(() => {
    if (!isLoggedIn && !authLoading) {
      setShowMobileAuth(true);
    }
  }, [isLoggedIn, authLoading]);

  useNotifications();

  // Check app version on startup
  useEffect(() => {
    (async () => {
      try {
        const appVersion = Constants.expoConfig?.version || '1.0.0';
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        const result = await checkAppVersion(appVersion, platform);
        if (result && result.needsUpdate && result.isForceUpdate) {
          setForceUpdate(result);
        }
      } catch { }
      setVersionChecked(true);
    })();
  }, []);

  // Request all permissions on app startup
  useEffect(() => {
    (async () => {
      // 1. Notification permission
      await requestNotificationPermission();

      // 2. Sensor/Pedometer permission (uses expo-sensors API)
      try {
        const { Pedometer } = await import('expo-sensors');
        if (Pedometer) {
          const { status } = await Pedometer.getPermissionsAsync();
          if (status !== 'granted') {
            await Pedometer.requestPermissionsAsync();
          }
        }
      } catch { }
    })();
  }, []);

  const shouldShowLangPicker = !langLoading && !hasChosenLanguage && showLangPicker;
  // Show force update screen (blocks everything)
  if (versionChecked && forceUpdate) {
    const updateMsg = forceUpdate.updateMessage_hi + '\n' + forceUpdate.updateMessage_en;
    const storeUrl = Platform.OS === 'ios' ? forceUpdate.appStoreUrl : forceUpdate.playStoreUrl;
    return (
      <>
        <StatusBar style="light" />
        <ForceUpdateScreen message={updateMsg} storeUrl={storeUrl} />
      </>
    );
  }

  const shouldShowMobileAuth = !langLoading && hasChosenLanguage && !authLoading && !isLoggedIn && showMobileAuth;

  if (shouldShowMobileAuth) {
    return (
      <>
        <StatusBar style="auto" />
        <MobileAuthScreen onDone={() => setShowMobileAuth(false)} />
      </>
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="dark" />
      <Stack initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="shree-info" options={{ headerShown: false }} />
        <Stack.Screen name="naam-jap-counter" options={{ headerShown: false }} />
        <Stack.Screen name="step-tracker" options={{ headerShown: false }} />
        <Stack.Screen name="daily-quote" options={{ headerShown: false }} />
        <Stack.Screen name="donation" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="terms-conditions" options={{ headerShown: false }} />
        <Stack.Screen name="share-app" options={{ headerShown: false }} />
        <Stack.Screen name="theme-settings" options={{ headerShown: false }} />
        <Stack.Screen name="language-settings" options={{ headerShown: false }} />
        <Stack.Screen name="membership" options={{ headerShown: false }} />
        <Stack.Screen name="handwritten-naam" options={{ headerShown: false }} />
        <Stack.Screen name="wallet" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
        <Stack.Screen name="game-2048" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <LanguagePickerModal
        visible={shouldShowLangPicker}
        onDone={async () => {
          await markLanguageChosen();
          setShowLangPicker(false);
        }}
      />
    </ThemeProvider>
  );
}

function SplashGate({ onFinish }: { onFinish: () => void }) {
  return (
    <>
      <StatusBar style="auto" translucent={false} />
      <AnimatedSplash onFinish={onFinish} />
    </>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <AppThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          {showSplash ? (
            <SplashGate onFinish={() => setShowSplash(false)} />
          ) : (
            <AppContent />
          )}
        </AuthProvider>
      </LanguageProvider>
    </AppThemeProvider>
  );
}
