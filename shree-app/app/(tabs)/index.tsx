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
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HP = 6;

const GAMES: {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route?: string;
  comingSoon?: boolean;
}[] = [
  { id: '2048', title: '2048', subtitle: 'Puzzle', icon: 'apps', color: '#F2A03D', route: '/game-2048' },
  { id: 'radha-jap', title: 'Radha Jap', subtitle: 'Catch Lotus', icon: 'flower', color: '#E91E63', route: '/game-radha-jap' },
  { id: 'bubble-smash', title: 'Bubble Smash', subtitle: 'Tap & Pop', icon: 'ellipse', color: '#4FC3F7', route: '/game-bubble-smash' },
  { id: 'memory', title: 'Memory', subtitle: 'Cards', icon: 'albums', color: '#81C784', comingSoon: true },
  { id: 'tictactoe', title: 'Tic Tac Toe', subtitle: 'Classic', icon: 'grid', color: '#26A69A', comingSoon: true },
  { id: 'snake', title: 'Snake', subtitle: 'Arcade', icon: 'flash', color: '#7E57C2', comingSoon: true },
];

interface ChantItem {
  id: string;
  title: string;
  subtitle: string;
  target: number;
  current: number;
  todayJap: number;
  lifetimeJap: number;
}

type Section =
  | { type: 'greeting' }
  | { type: 'goal' }
  | { type: 'chants_header' }
  | { type: 'chant'; data: ChantItem }
  | { type: 'feature' }
  | { type: 'insights_header' }
  | { type: 'insights' }
  | { type: 'games_header' }
  | { type: 'games' };

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
  const { user, updateAuthUser } = useAuth();

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
      if (data) {
        setUserData(data);
        // Keep AuthContext profileImage in sync
        if (user && data.user?.profileImage !== undefined && data.user.profileImage !== user.profileImage) {
          updateAuthUser({ ...user, profileImage: data.user.profileImage });
        }
      }
      if (hw) setHandwritten(hw);
    } catch { }
  }, [user?.deviceId]); // eslint-disable-line

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime auto-refresh: poll every 15s while screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
      const interval = setInterval(loadData, 15000);
      return () => clearInterval(interval);
    }, [loadData])
  );

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
        current: handwrittenToday,
        todayJap: handwrittenToday,
        lifetimeJap: handwrittenLifetime,
      },
    },
    { type: 'feature' },
    { type: 'insights_header' },
    { type: 'insights' },
    { type: 'games_header' },
    { type: 'games' },
  ];

  const renderItem = ({ item }: { item: Section }) => {
    switch (item.type) {
      case 'greeting':
        return (
          <GreetingBar
            greeting={t(getGreetingKey() as any)}
            name={user?.name || t('home_guest_user')}
            profileImage={userData?.user?.profileImage || user?.profileImage || null}
            showNoAds
            noAdsLabel={t('home_no_ads')}
            onMenuPress={() => setDrawerVisible(true)}
            onNoAdsPress={() => router.push('/membership')}
            onAvatarPress={() => router.push('/profile-edit' as any)}
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
            todayJap={item.data.todayJap}
            lifetimeJap={item.data.lifetimeJap}
            targetLabel={t('home_target')}
            todayLabel={t('home_today_jap')}
            lifetimeLabel={t('home_lifetime_jap')}
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
            leftLabel={t('home_total_jap')}
            leftValue={totalCount}
            rightLabel={t('home_total_malas')}
            rightValue={totalMalas}
          />
        );
      case 'games_header':
        return (
          <SectionHeader
            title={t('home_games' as any) || 'Games'}
            actionLabel={t('home_view' as any)}
            actionIcon="game-controller"
            onActionPress={() => router.push('/game-2048' as any)}
          />
        );
      case 'games':
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: 6 }}>
            {GAMES.map((g) => (
              <View key={g.id} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 12 }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={g.comingSoon}
                  onPress={() => g.route && router.push(g.route as any)}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: theme.cardBorder,
                    backgroundColor: theme.cardBg,
                    padding: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 110,
                    opacity: g.comingSoon ? 0.55 : 1,
                  }}
                >
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: g.color + '22',
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name={g.icon as any} size={26} color={g.color} />
                  </View>
                  <Text style={{ color: theme.text, fontSize: 14, fontWeight: '800' }} numberOfLines={1}>
                    {g.title}
                  </Text>
                  <Text style={{ color: theme.subText, fontSize: 11, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                    {g.comingSoon ? (t('home_coming_soon' as any) || 'Coming Soon') : g.subtitle}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />

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
