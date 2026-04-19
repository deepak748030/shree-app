import ChantCard from '@/components/home/chant-card';
import FeatureCard from '@/components/home/feature-card';
import GreetingBar from '@/components/home/greeting-bar';
import InsightsCard from '@/components/home/insights-card';
import SectionHeader from '@/components/home/section-header';
import TodaysGoalCard from '@/components/home/todays-goal-card';
import SidebarDrawer from '@/components/sidebar-drawer';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchHandwrittenNaam, fetchUserData, type HandwrittenNaamData, type UserRankData } from '@/services/api';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HP = 6;

interface ChantItem {
  id: string;
  title: string;
  subtitle: string;
  target: number;
  current: number;
  todayJapa: number;
  lifetimeJapa: number;
}

type Section =
  | { type: 'greeting' }
  | { type: 'goal' }
  | { type: 'chants_header' }
  | { type: 'chant'; data: ChantItem }
  | { type: 'feature' }
  | { type: 'insights_header' }
  | { type: 'insights' };

function getGreetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'home_greeting_morning';
  if (h < 17) return 'home_greeting_afternoon';
  if (h < 21) return 'home_greeting_evening';
  return 'home_greeting_night';
}

export default function HomeScreen() {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<UserRankData | null>(null);
  const [handwritten, setHandwritten] = useState<HandwrittenNaamData | null>(null);

  const dailyGoalMantras = 1;
  const malaTarget = 108;
  const todayMalaCount = userData ? Math.min(userData.user.totalCount % 108 || 0, 108) : 0;
  const totalCount = userData?.user.totalCount ?? 0;
  const totalMalas = userData?.user.totalMalas ?? 0;
  const handwrittenToday = handwritten?.todayCount ?? 0;
  const handwrittenLifetime = handwritten?.lifetimeCount ?? 0;

  const loadData = useCallback(async () => {
    if (!user?.deviceId) return;
    try {
      const [data, hw] = await Promise.all([
        fetchUserData(user.deviceId),
        fetchHandwrittenNaam(user.deviceId),
      ]);
      if (data) setUserData(data);
      if (hw) setHandwritten(hw);
    } catch { }
  }, [user?.deviceId]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const sections: Section[] = [
    { type: 'greeting' },
    { type: 'goal' },
    { type: 'chants_header' },
    {
      type: 'chant',
      data: {
        id: 'om-namah-shivay',
        title: 'Om Namah Shivay',
        subtitle: 'ॐ नमः शिवाय',
        target: malaTarget,
        current: todayMalaCount,
        todayJapa: handwrittenToday,
        lifetimeJapa: handwrittenLifetime,
      },
    },
    { type: 'feature' },
    { type: 'insights_header' },
    { type: 'insights' },
  ];

  const renderItem = ({ item }: { item: Section }) => {
    switch (item.type) {
      case 'greeting':
        return (
          <GreetingBar
            greeting={t(getGreetingKey() as any)}
            name={user?.name || t('home_guest_user')}
            showNoAds
            noAdsLabel={t('home_no_ads')}
            onMenuPress={() => setDrawerVisible(true)}
            onNoAdsPress={() => router.push('/membership')}
          />
        );
      case 'goal':
        return (
          <TodaysGoalCard
            title={t('home_todays_goal')}
            mantraCount={dailyGoalMantras}
            mantrasLabel={t('home_mantras')}
            editLabel={t('home_edit_goal')}
            mantraName="Om Namah Shivay"
            current={todayMalaCount}
            target={malaTarget}
            onEdit={() => router.push('/naam-jap-counter')}
          />
        );
      case 'chants_header':
        return (
          <SectionHeader
            title={t('home_my_chants')}
            actionLabel={t('home_all_mantra')}
            actionIcon="add"
            onActionPress={() => router.push('/naam-jap-counter')}
          />
        );
      case 'chant':
        return (
          <ChantCard
            title={item.data.title}
            subtitle={item.data.subtitle}
            target={item.data.target}
            current={item.data.current}
            todayJapa={item.data.todayJapa}
            lifetimeJapa={item.data.lifetimeJapa}
            targetLabel={t('home_target')}
            todayLabel={t('home_today_japa')}
            lifetimeLabel={t('home_lifetime_japa')}
            onPress={() => router.push('/handwritten-naam')}
          />
        );
      case 'feature':
        return (
          <FeatureCard
            iconName="create-outline"
            title={t('home_handwritten')}
            subtitle={t('home_handwritten_sub')}
            onPress={() => router.push('/handwritten-naam')}
          />
        );
      case 'insights_header':
        return (
          <SectionHeader
            title={t('home_my_insights')}
            actionLabel={t('home_view')}
            actionIcon="eye"
            onActionPress={() => router.push('/naam-jap-counter')}
          />
        );
      case 'insights':
        return (
          <InsightsCard
            leftLabel={t('home_total_japa')}
            leftValue={totalCount}
            rightLabel={t('home_total_malas')}
            rightValue={totalMalas}
          />
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
      <StatusBar style="dark" backgroundColor={theme.headerBg} translucent={false} />

      {/* Yellow safe-area top band (status bar / notification bar background) */}
      <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

      <FlatList
        data={sections}
        keyExtractor={(_, i) => `sec-${i}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.accent]}
            tintColor={theme.accent}
          />
        }
      />

      <SidebarDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: {
    paddingHorizontal: HP,
    paddingTop: 6,
    paddingBottom: 20,
  },
});
