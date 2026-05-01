import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchLeaderboard, fetchNaamJapStats, fetchUserData } from '@/services/api';
import type { LeaderboardEntry, NaamJapStats, UserRankData } from '@/services/api';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN_BG = '#4CAF50';

interface AnalyticsSheetProps {
    visible: boolean;
    onClose: () => void;
    deviceId: string | null;
}

type Row =
    | { type: 'rank' }
    | { type: 'section'; key: string }
    | { type: 'stats' }
    | { type: 'period-tabs' }
    | { type: 'leaderboard' }
    | { type: 'passbook' }
    | { type: 'disclaimer' };

export default function AnalyticsSheet({ visible, onClose, deviceId }: AnalyticsSheetProps) {
    const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
    const { theme } = useAppTheme();
    const { t } = useLanguage();

    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState<NaamJapStats | null>(null);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [userData, setUserData] = useState<UserRankData | null>(null);
    const [leaderboardPeriod, setLeaderboardPeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');

    useEffect(() => {
        if (visible) loadData();
    }, [visible]);

    useEffect(() => {
        if (visible) loadLeaderboard();
    }, [leaderboardPeriod, visible]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsData, userData_] = await Promise.all([
                fetchNaamJapStats(),
                deviceId ? fetchUserData(deviceId) : null,
            ]);
            if (statsData) setStats(statsData);
            if (userData_) setUserData(userData_);
            await loadLeaderboard();
        } catch { }
        finally { setLoading(false); }
    };

    const loadLeaderboard = async () => {
        const data = await fetchLeaderboard(leaderboardPeriod, 200);
        setLeaderboard(data);
    };

    const formatNum = (n: number) => n.toLocaleString('en-IN');

    const worldwideStats = stats ? [
        { labelKey: 'analytics_all_time_users', value: formatNum(stats.allTimeUsers) },
        { labelKey: 'analytics_all_time_malas', value: formatNum(stats.allTimeMalas) },
        { labelKey: 'analytics_users_week', value: formatNum(stats.weeklyUsers), accent: true },
        { labelKey: 'analytics_malas_week', value: formatNum(stats.weeklyMalas), accent: true },
        { labelKey: 'analytics_users_month', value: formatNum(stats.monthlyUsers) },
        { labelKey: 'analytics_malas_month', value: formatNum(stats.monthlyMalas) },
    ] : [];

    const tabKeys = [
        { id: 'daily' as const, key: 'analytics_daily' },
        { id: 'weekly' as const, key: 'analytics_weekly' },
        { id: 'monthly' as const, key: 'analytics_monthly' },
    ];

    const rankDisplay = userData
        ? `⭐ ${formatNum(userData.rank)} / ${formatNum(userData.totalUsers)}`
        : '⭐ -- / --';

    const rows: Row[] = [
        { type: 'rank' },
        { type: 'section', key: 'analytics_worldwide' },
        { type: 'stats' },
        { type: 'section', key: 'analytics_top_200' },
        { type: 'period-tabs' },
        { type: 'leaderboard' },
        { type: 'section', key: 'analytics_passbook' },
        { type: 'passbook' },
        { type: 'disclaimer' },
    ];

    const renderRow = ({ item }: { item: Row }) => {
        switch (item.type) {
            case 'rank':
                return (
                    <View style={[styles.rankBadge, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.rankBadgeLabel, { color: theme.subText }]}>{t('analytics_my_rank')}</Text>
                        <Text style={[styles.rankBadgeValue, { color: theme.text }]}>{rankDisplay}</Text>
                    </View>
                );
            case 'section':
                return <Text style={[styles.sectionTitle, { color: theme.text }]}>{t(item.key as any)}</Text>;
            case 'stats':
                return (
                    <View style={styles.statsGrid}>
                        {worldwideStats.map((s, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.statCard,
                                    {
                                        backgroundColor: theme.cardBg,
                                        borderColor: s.accent ? GREEN_BG : theme.cardBorder,
                                    },
                                ]}
                            >
                                <Text style={[styles.statLabel, { color: theme.subText }]}>{t(s.labelKey as any)}</Text>
                                <Text style={[styles.statValue, { color: theme.text }]}>{s.value}</Text>
                            </View>
                        ))}
                    </View>
                );
            case 'period-tabs':
                return (
                    <View style={styles.periodRow}>
                        {(['all', 'daily', 'weekly', 'monthly'] as const).map((period) => {
                            const active = leaderboardPeriod === period;
                            return (
                                <TouchableOpacity
                                    key={period}
                                    style={[
                                        styles.periodTab,
                                        { borderColor: theme.cardBorder },
                                        active && { backgroundColor: theme.accent, borderColor: theme.accent },
                                    ]}
                                    onPress={() => setLeaderboardPeriod(period)}
                                >
                                    <Text style={[
                                        styles.periodTabText,
                                        { color: active ? '#FFFFFF' : theme.subText, fontWeight: active ? '700' : '500' },
                                    ]}>
                                        {period === 'all' ? 'All Time' : period.charAt(0).toUpperCase() + period.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                );
            case 'leaderboard':
                return (
                    <View style={[styles.tableContainer, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <View style={[styles.tableHeader, { borderBottomColor: theme.divider }]}>
                            <Text style={[styles.tableHeaderText, { width: 24, color: theme.text }]}>#</Text>
                            <Text style={[styles.tableHeaderText, { flex: 1, color: theme.text }]}>{t('analytics_user')}</Text>
                            <Text style={[styles.tableHeaderText, { width: 90, textAlign: 'center', color: theme.text }]}>{t('analytics_location')}</Text>
                            <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'right', color: theme.text }]}>{t('analytics_malas')}</Text>
                        </View>
                        {leaderboard.length === 0 ? (
                            <View style={styles.emptyRow}>
                                <Text style={[styles.emptyText, { color: theme.subText }]}>No data yet. Start counting!</Text>
                            </View>
                        ) : (
                            leaderboard.map((user, index) => (
                                <View
                                    key={`${user.rank}-${user.name}`}
                                    style={[styles.tableRow, index < leaderboard.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
                                >
                                    <Text style={[styles.tableCell, { width: 24, color: theme.subText }]}>{user.rank}.</Text>
                                    <Text style={[styles.tableCellName, { flex: 1, color: theme.text }]} numberOfLines={1}>{user.name}</Text>
                                    <Text style={[styles.tableCell, { width: 90, textAlign: 'center', fontSize: 11, color: theme.subText }]} numberOfLines={1}>{user.city}</Text>
                                    <Text style={[styles.tableCellMalas, { width: 50, textAlign: 'right', color: theme.accent }]}>{formatNum(user.malas)}</Text>
                                </View>
                            ))
                        )}
                        <Text style={[styles.lastUpdated, { color: theme.subText }]}>
                            {t('analytics_last_updated')}: {new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                    </View>
                );
            case 'passbook':
                return (
                    <View style={[styles.passbookCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <View style={styles.passbookHighlight}>
                            <Text style={styles.fireEmoji}>🔥</Text>
                            <Text style={[styles.passbookHighlightText, { color: theme.text }]}>{t('analytics_highest_mala')}</Text>
                        </View>
                        <Text style={[styles.passbookHighlightValue, { color: theme.accent }]}>{userData?.highestMalaDay ?? 0}</Text>

                        <View style={styles.tabRow}>
                            {tabKeys.map((tab) => {
                                const active = activeTab === tab.id;
                                return (
                                    <TouchableOpacity
                                        key={tab.id}
                                        style={[
                                            styles.tab,
                                            { borderColor: theme.cardBorder },
                                            active && { borderColor: theme.accent },
                                        ]}
                                        onPress={() => setActiveTab(tab.id)}
                                    >
                                        {active && (
                                            <Ionicons name="checkmark" size={14} color={theme.accent} style={{ marginRight: 4 }} />
                                        )}
                                        <Text style={[styles.tabText, { color: active ? theme.accent : theme.subText, fontWeight: active ? '700' : '500' }]}>
                                            {t(tab.key as any)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity style={styles.chartIconBtn}>
                                <Ionicons name="bar-chart-outline" size={20} color={theme.accent} />
                            </TouchableOpacity>
                        </View>

                        {userData?.recentLogs && userData.recentLogs.length > 0 ? (
                            userData.recentLogs.slice(0, 7).map((log, i) => (
                                <View
                                    key={log.date}
                                    style={[
                                        styles.entryRow,
                                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider },
                                    ]}
                                >
                                    <View style={styles.entryLeft}>
                                        <MaterialCommunityIcons name="meditation" size={20} color={theme.accent} />
                                        <Text style={[styles.entryText, { color: theme.text }]}>{log.malas} {t('analytics_mala_unit')}</Text>
                                    </View>
                                    <Text style={[styles.entryDate, { color: theme.subText }]}>{log.date}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={styles.entryRow}>
                                <View style={styles.entryLeft}>
                                    <MaterialCommunityIcons name="meditation" size={20} color={theme.accent} />
                                    <Text style={[styles.entryText, { color: theme.text }]}>0 {t('analytics_mala_unit')}</Text>
                                </View>
                                <Text style={[styles.entryDate, { color: theme.subText }]}>--</Text>
                            </View>
                        )}
                    </View>
                );
            case 'disclaimer':
                return <Text style={[styles.disclaimer, { color: theme.subText }]}>{t('analytics_disclaimer')}</Text>;
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={[styles.container, { backgroundColor: theme.bgCream }]}>
                <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
                <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                    <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}>
                        <Ionicons name="arrow-back" size={24} color={theme.headerText} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.headerText }]}>{t('analytics_header')}</Text>
                    <View style={{ width: 32 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={theme.accent} />
                    </View>
                ) : (
                    <FlatList
                        data={rows}
                        keyExtractor={(_, i) => `r-${i}`}
                        renderItem={renderRow}
                        contentContainerStyle={styles.scrollContent}
                        ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                        showsVerticalScrollIndicator={false}
                    />
                )}
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 17, fontWeight: 'bold' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { paddingHorizontal: 6, paddingVertical: 6, paddingBottom: 30 },
    rankBadge: {
        alignSelf: 'center',
        borderRadius: 20,
        paddingVertical: 6,
        paddingHorizontal: 16,
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
    },
    rankBadgeLabel: { fontSize: 12, fontWeight: '600' },
    rankBadgeValue: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
    sectionTitle: { fontSize: 15, fontWeight: 'bold', textAlign: 'center', marginTop: 6 },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    statCard: {
        width: '48.5%',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        marginBottom: 6,
        borderWidth: StyleSheet.hairlineWidth,
    },
    statLabel: { fontSize: 12, fontWeight: '500' },
    statValue: { fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    periodRow: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
    periodTab: {
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 16,
        borderWidth: StyleSheet.hairlineWidth,
    },
    periodTabText: { fontSize: 12 },
    tableContainer: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    tableHeaderText: { fontSize: 12, fontWeight: 'bold' },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center' },
    tableCell: { fontSize: 12 },
    tableCellName: { fontSize: 13, fontWeight: '600' },
    tableCellMalas: { fontSize: 13, fontWeight: 'bold' },
    emptyRow: { paddingVertical: 20, alignItems: 'center' },
    emptyText: { fontSize: 13 },
    lastUpdated: { fontSize: 10, textAlign: 'center', paddingVertical: 6 },
    passbookCard: {
        borderRadius: 10,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    passbookHighlight: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
    fireEmoji: { fontSize: 18, marginRight: 6 },
    passbookHighlightText: { fontSize: 13, fontWeight: '600' },
    passbookHighlightValue: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginVertical: 4 },
    tabRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 6 },
    tab: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 12,
        marginRight: 6,
    },
    tabText: { fontSize: 12 },
    chartIconBtn: { marginLeft: 'auto', padding: 4 },
    entryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    entryLeft: { flexDirection: 'row', alignItems: 'center' },
    entryText: { fontSize: 13, marginLeft: 8 },
    entryDate: { fontSize: 11 },
    disclaimer: { fontSize: 10, marginTop: 4, paddingHorizontal: 6, textAlign: 'center' },
});
