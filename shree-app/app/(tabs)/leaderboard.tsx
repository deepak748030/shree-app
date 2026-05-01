import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchLeaderboard, type LeaderboardEntry } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Period = 'all' | 'daily' | 'weekly' | 'monthly';

export default function LeaderboardScreen() {
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const insets = useSafeAreaInsets();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#222222';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';

    const [period, setPeriod] = useState<Period>('all');
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (p: Period) => {
        const list = await fetchLeaderboard(p, 200);
        setData(list);
        setLoading(false);
    }, []);

    useEffect(() => {
        setLoading(true);
        load(period);
    }, [period, load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load(period);
        setRefreshing(false);
    }, [period, load]);

    const periods: { id: Period; key: string }[] = [
        { id: 'all', key: 'leaderboard_all_time' },
        { id: 'monthly', key: 'leaderboard_monthly' },
        { id: 'weekly', key: 'leaderboard_weekly' },
        { id: 'daily', key: 'leaderboard_daily' },
    ];

    const rankColor = (rank: number) => {
        if (rank === 1) return '#FFD700';
        if (rank === 2) return '#C0C0C0';
        if (rank === 3) return '#CD7F32';
        return theme.accent;
    };

    const renderItem = ({ item }: { item: LeaderboardEntry }) => (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.rankBadge, { backgroundColor: rankColor(item.rank) + '22', borderColor: rankColor(item.rank) }]}>
                <Text style={[styles.rankText, { color: rankColor(item.rank) }]}>#{item.rank}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.name, { color: textPrimary }]} numberOfLines={1}>{item.name}</Text>
                {item.city ? (
                    <Text style={[styles.city, { color: textMuted }]} numberOfLines={1}>{item.city}</Text>
                ) : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.malas, { color: theme.accent }]}>{item.malas}</Text>
                <Text style={[styles.malasLabel, { color: textMuted }]}>{t('leaderboard_malas' as any)}</Text>
            </View>
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <Ionicons name="trophy" size={22} color={theme.accent} />
                <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('leaderboard_title' as any)}</Text>
            </View>

            <View style={styles.tabs}>
                {periods.map((p) => {
                    const active = period === p.id;
                    return (
                        <TouchableOpacity
                            key={p.id}
                            style={[
                                styles.tab,
                                {
                                    backgroundColor: active ? theme.accent : cardBg,
                                    borderColor: active ? theme.accent : theme.cardBorder,
                                },
                            ]}
                            onPress={() => setPeriod(p.id)}
                            activeOpacity={0.8}
                        >
                            <Text style={[styles.tabText, { color: active ? '#FFFFFF' : textPrimary }]}>
                                {t(p.key as any)}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            {loading ? (
                <View style={styles.loadingWrap}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : data.length === 0 ? (
                <View style={styles.loadingWrap}>
                    <Ionicons name="trophy-outline" size={48} color={textMuted} />
                    <Text style={[styles.empty, { color: textMuted }]}>{t('leaderboard_empty' as any)}</Text>
                </View>
            ) : (
                <FlatList
                    data={data}
                    keyExtractor={(item, i) => `${item.name}-${i}`}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 6, paddingBottom: 20 }}
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
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    tabs: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 6,
        paddingVertical: 6,
    },
    tab: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
    },
    tabText: { fontSize: 12, fontWeight: '600' },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    rankBadge: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    rankText: { fontSize: 13, fontWeight: '800' },
    name: { fontSize: 14, fontWeight: '700' },
    city: { fontSize: 11, marginTop: 2 },
    malas: { fontSize: 18, fontWeight: '800' },
    malasLabel: { fontSize: 10, marginTop: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    empty: { fontSize: 14, fontWeight: '500' },
});
