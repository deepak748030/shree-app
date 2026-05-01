import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

export default function TabLayout() {
  const { theme } = useAppTheme();
  const isDark = theme.id === 'dark';

  const inactive = isDark ? '#888888' : '#9A9A9A';
  const tabBg = isDark ? '#1F1F1F' : '#FFFFFF';
  const borderTop = isDark ? '#1F1F1F' : '#EEEEEE';

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: inactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
          marginBottom: Platform.OS === 'ios' ? 0 : 4
        },
        tabBarStyle: {
          backgroundColor: tabBg,
          borderTopColor: borderTop,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === 'ios' ? 82 : 62,
          paddingTop: 6,
          paddingBottom: 30,
          marginBottom: 18,
          borderRadius: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Leaderboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="awards"
        options={{
          title: 'Awards',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'medal' : 'medal-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}