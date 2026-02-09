import AnimatedSplash from '@/components/animated-splash';
import LanguagePickerModal from '@/components/language-picker-modal';
import { LanguageProvider, useLanguage } from '@/contexts/language-context';
import { AppThemeProvider } from '@/contexts/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import 'react-native-reanimated';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
  const colorScheme = useColorScheme();
  const { loading, hasChosenLanguage, markLanguageChosen } = useLanguage();
  const [showLangPicker, setShowLangPicker] = useState(true);

  const shouldShowPicker = !loading && !hasChosenLanguage && showLangPicker;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName="(tabs)">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="naam-jap-counter" options={{ headerShown: false }} />
        <Stack.Screen name="daily-quote" options={{ headerShown: false }} />
        <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
        <Stack.Screen name="terms-conditions" options={{ headerShown: false }} />
        <Stack.Screen name="share-app" options={{ headerShown: false }} />
        <Stack.Screen name="theme-settings" options={{ headerShown: false }} />
        <Stack.Screen name="language-settings" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" backgroundColor="#1a1a1a" translucent={false} />
      <LanguagePickerModal
        visible={shouldShowPicker}
        onDone={async () => {
          await markLanguageChosen();
          setShowLangPicker(false);
        }}
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return (
      <>
        <StatusBar style="light" backgroundColor="#1a1a1a" translucent={false} />
        <AnimatedSplash onFinish={() => setShowSplash(false)} />
      </>
    );
  }

  return (
    <AppThemeProvider>
      <LanguageProvider>
        <AppContent />
      </LanguageProvider>
    </AppThemeProvider>
  );
}
