import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const { theme } = useAppTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const isDark = theme.id === 'dark';

  const inactive = isDark ? '#9A9A9A' : '#888888';
  const tabBg = isDark ? '#141414' : '#FFFFFF';
  const borderTop = isDark ? '#222222' : '#EEEEEE';

  // Bottom safe-area padding (Android nav bar / iOS home indicator)
  // Use a generous minimum so on phones with on-screen gesture/nav bars the
  // tab labels never sit behind the system navigation.
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 8);
  const tabBarHeight = 60 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: inactive,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          marginBottom: 2,
          includeFontPadding: false,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: bottomInset + 4,
          // No floating margin/radius — keep flush so labels aren't clipped
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home' as any),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t('tab_leaderboard' as any),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="rewards"
        options={{
          title: t('tab_rewards' as any),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'gift' : 'gift-outline'} size={22} color={color} />
          ),
        }}
      />


      <Tabs.Screen
        name="settings"
        options={{
          title: t('tab_settings' as any),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
