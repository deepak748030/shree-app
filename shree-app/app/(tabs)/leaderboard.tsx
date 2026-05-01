import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchLeaderboard, type LeaderboardEntry } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
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
import { SafeAreaView } from 'react-native-safe-area-context';

type Period = 'daily' | 'weekly' | 'monthly' | 'all';

const RANK_COLORS: Record<number, { bg: readonly [string, string]; border: string; text: string; iconBg: string }> = {
    1: { bg: ['#3A2E12', '#1F1909'] as const, border: '#E2B53A', text: '#F4C744', iconBg: '#FFD24A' },
    2: { bg: ['#2A2A2A', '#1B1B1B'] as const, border: '#9C9C9C', text: '#D8D8D8', iconBg: '#C9C9C9' },
    3: { bg: ['#3A1F0E', '#1F1209'] as const, border: '#C97A3A', text: '#E8853A', iconBg: '#E07B2D' },
};

export default function LeaderboardScreen() {
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#8A8A8A' : '#777777';
    const cardBg = isDark ? '#1B1B1B' : '#FFFFFF';
    const screenBg = isDark ? '#0A0A0A' : theme.bgCream;

    const [period, setPeriod] = useState<Period>('daily');
    const [data, setData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async (p: Period) => {
        const list = await fetchLeaderboard(p, 200);
        // Re-sort/rank by total jap count (count) per requirement
        const ranked = [...list]
            .sort((a, b) => (b.count || 0) - (a.count || 0))
            .map((entry, i) => ({ ...entry, rank: i + 1 }));
        setData(ranked);
        setLoading(false);
    }, []);

    useEffect(() => {
        setLoading(true);
        load(period);
    }, [period, load]);

    // Realtime auto-refresh: poll every 15s while focused
    useFocusEffect(
        useCallback(() => {
            const interval = setInterval(() => load(period), 15000);
            return () => clearInterval(interval);
        }, [period, load])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load(period);
        setRefreshing(false);
    }, [period, load]);

    const periods: { id: Period; key: string }[] = [
        { id: 'daily', key: 'leaderboard_today' },
        { id: 'weekly', key: 'leaderboard_weekly' },
        { id: 'monthly', key: 'leaderboard_monthly' },
        { id: 'all', key: 'leaderboard_all_time' },
    ];

    const renderTopRank = (item: LeaderboardEntry) => {
        const conf = RANK_COLORS[item.rank];
        return (
            <LinearGradient
                colors={conf.bg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.cardTop, { borderColor: conf.border }]}
            >
                <View style={styles.crownWrap}>
                    <Ionicons name="trophy" size={14} color={conf.iconBg} style={{ position: 'absolute', top: -2 }} />
                    <View style={[styles.laurel, { borderColor: conf.iconBg }]}>
                        <Text style={[styles.laurelRank, { color: conf.iconBg }]}>{item.rank}</Text>
                    </View>
                    <View style={styles.starsRow}>
                        <Ionicons name="star" size={7} color={conf.iconBg} />
                        <Ionicons name="star" size={7} color={conf.iconBg} />
                        <Ionicons name="star" size={7} color={conf.iconBg} />
                    </View>
                </View>

                <View style={{ flex: 1, marginLeft: 14 }}>
                    <Text style={[styles.topName, { color: '#FFFFFF' }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.topMeta, { color: '#BFBFBF' }]} numberOfLines={1}>
                        {t('leaderboard_days' as any)}: 1{item.city ? `  •  ${item.city}` : ''}
                    </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.topCount, { color: conf.text }]}>{item.count.toLocaleString()}</Text>
                    <Text style={[styles.topTotal, { color: '#BFBFBF' }]}>{t('leaderboard_total' as any)}</Text>
                </View>
            </LinearGradient>
        );
    };

    const renderRow = (item: LeaderboardEntry) => (
        <View style={[styles.row, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
            <View style={[styles.rankCircle, { backgroundColor: isDark ? '#2A2A2A' : '#EFEFEF' }]}>
                <Text style={[styles.rankCircleText, { color: textPrimary }]}>{item.rank}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[styles.rowName, { color: textPrimary }]} numberOfLines={1}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: textMuted }]} numberOfLines={1}>
                    {t('leaderboard_days' as any)}: 1{item.city ? `  •  ${item.city}` : ''}
                </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.rowCount, { color: theme.accent }]}>{item.count.toLocaleString()}</Text>
                <Text style={[styles.rowTotal, { color: textMuted }]}>{t('leaderboard_total' as any)}</Text>
            </View>
        </View>
    );

    const renderItem = ({ item }: { item: LeaderboardEntry }) => {
        if (item.rank <= 3) return renderTopRank(item);
        return renderRow(item);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />

            <View style={styles.headerWrap}>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('leaderboard_title' as any)}</Text>
                <Text style={[styles.headerSub, { color: textMuted }]}>{t('leaderboard_subtitle' as any)}</Text>
            </View>

            <View style={[styles.tabsRow, { borderBottomColor: isDark ? '#222' : '#E5E5E5' }]}>
                {periods.map((p) => {
                    const active = period === p.id;
                    return (
                        <TouchableOpacity
                            key={p.id}
                            style={styles.tabBtn}
                            onPress={() => setPeriod(p.id)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.tabText, { color: active ? theme.accent : textMuted, fontWeight: active ? '800' : '600' }]}>
                                {t(p.key as any)}
                            </Text>
                            {active ? <View style={[styles.tabUnderline, { backgroundColor: theme.accent }]} /> : null}
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
                    contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerWrap: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 8,
    },
    headerTitle: { fontSize: 26, fontWeight: '900', letterSpacing: 1.5 },
    headerSub: { fontSize: 13, marginTop: 2 },
    tabsRow: {
        flexDirection: 'row',
        paddingHorizontal: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
    },
    tabText: { fontSize: 14 },
    tabUnderline: {
        position: 'absolute',
        bottom: -1,
        left: '25%',
        right: '25%',
        height: 3,
        borderRadius: 2,
    },
    cardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        minHeight: 76,
    },
    crownWrap: {
        width: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    laurel: {
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    laurelRank: { fontSize: 18, fontWeight: '900' },
    starsRow: {
        flexDirection: 'row',
        gap: 2,
        marginTop: 2,
    },
    topName: { fontSize: 17, fontWeight: '800' },
    topMeta: { fontSize: 12, marginTop: 3 },
    topCount: { fontSize: 22, fontWeight: '900' },
    topTotal: { fontSize: 11, marginTop: 1 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        minHeight: 70,
    },
    rankCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankCircleText: { fontSize: 16, fontWeight: '700' },
    rowName: { fontSize: 16, fontWeight: '700' },
    rowMeta: { fontSize: 12, marginTop: 2 },
    rowCount: { fontSize: 20, fontWeight: '800' },
    rowTotal: { fontSize: 11, marginTop: 1 },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
    empty: { fontSize: 14, fontWeight: '500' },
});
