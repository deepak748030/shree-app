import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchHandwrittenNaam, fetchUserData } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AwardDef {
    id: string;
    titleKey: string;
    descKey: string;
    icon: keyof typeof Ionicons.glyphMap;
    target: number;
    metric: 'jap' | 'mala' | 'handwritten';
    color: string;
}

const AWARDS: AwardDef[] = [
    { id: 'first_step', titleKey: 'award_first_step', descKey: 'award_first_step_desc', icon: 'star', target: 1, metric: 'jap', color: '#F2A03D' },
    { id: 'century', titleKey: 'award_century', descKey: 'award_century_desc', icon: 'flame', target: 100, metric: 'jap', color: '#E65100' },
    { id: 'dedicated', titleKey: 'award_dedicated', descKey: 'award_dedicated_desc', icon: 'ribbon', target: 1, metric: 'mala', color: '#9C27B0' },
    { id: 'devotee', titleKey: 'award_devotee', descKey: 'award_devotee_desc', icon: 'medal', target: 10, metric: 'mala', color: '#3F51B5' },
    { id: 'master', titleKey: 'award_master', descKey: 'award_master_desc', icon: 'trophy', target: 100, metric: 'mala', color: '#FFD700' },
    { id: 'legend', titleKey: 'award_legend', descKey: 'award_legend_desc', icon: 'diamond', target: 1000, metric: 'mala', color: '#00BCD4' },
    { id: 'writer', titleKey: 'award_writer', descKey: 'award_writer_desc', icon: 'create', target: 10, metric: 'handwritten', color: '#4CAF50' },
    { id: 'scribe', titleKey: 'award_scribe', descKey: 'award_scribe_desc', icon: 'book', target: 108, metric: 'handwritten', color: '#FF5722' },
];

export default function AwardsScreen() {
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#222222';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
    const lockedBg = isDark ? '#141414' : '#F5F5F5';

    const [totalJap, setTotalJap] = useState(0);
    const [totalMala, setTotalMala] = useState(0);
    const [handwritten, setHandwritten] = useState(0);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        if (!user?.deviceId) return;
        try {
            const [u, h] = await Promise.all([
                fetchUserData(user.deviceId),
                fetchHandwrittenNaam(user.deviceId),
            ]);
            if (u) {
                setTotalJap(u.user.totalCount);
                setTotalMala(u.user.totalMalas);
            }
            if (h) setHandwritten(h.lifetimeCount);
        } catch { }
    }, [user?.deviceId]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }, [load]);

    const getCurrent = (metric: AwardDef['metric']) => {
        if (metric === 'jap') return totalJap;
        if (metric === 'mala') return totalMala;
        return handwritten;
    };

    const unlockedCount = AWARDS.filter((a) => getCurrent(a.metric) >= a.target).length;

    const renderItem = ({ item }: { item: AwardDef }) => {
        const current = getCurrent(item.metric);
        const unlocked = current >= item.target;
        const progress = Math.min(100, Math.round((current / item.target) * 100));

        return (
            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: unlocked ? cardBg : lockedBg,
                        borderColor: unlocked ? item.color + '55' : theme.cardBorder,
                        opacity: unlocked ? 1 : 0.85,
                    },
                ]}
            >
                <View style={[styles.iconWrap, { backgroundColor: unlocked ? item.color + '22' : (isDark ? '#222' : '#E8E8E8') }]}>
                    <Ionicons
                        name={unlocked ? item.icon : 'lock-closed'}
                        size={24}
                        color={unlocked ? item.color : textMuted}
                    />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <View style={styles.rowBetween}>
                        <Text style={[styles.title, { color: textPrimary }]} numberOfLines={1}>
                            {t(item.titleKey as any)}
                        </Text>
                        {unlocked ? (
                            <View style={[styles.badge, { backgroundColor: item.color }]}>
                                <Text style={styles.badgeText}>{t('awards_unlocked' as any)}</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={[styles.desc, { color: textMuted }]} numberOfLines={2}>
                        {t(item.descKey as any)}
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? '#262626' : '#EEE' }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress}%`, backgroundColor: unlocked ? item.color : theme.accent },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressText, { color: textMuted }]}>
                        {Math.min(current, item.target)} / {item.target}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <Ionicons name="medal" size={22} color={theme.accent} />
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('awards_title' as any)}</Text>
                    <Text style={[styles.headerSub, { color: textMuted }]}>
                        {unlockedCount} / {AWARDS.length} {t('awards_unlocked' as any)}
                    </Text>
                </View>
            </View>

            <FlatList
                data={AWARDS}
                keyExtractor={(item) => item.id}
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 18, fontWeight: '700' },
    headerSub: { fontSize: 11, marginTop: 2 },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 14, fontWeight: '700', flex: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    badgeText: { fontSize: 10, color: '#FFF', fontWeight: '700' },
    desc: { fontSize: 11, marginTop: 2 },
    progressTrack: { height: 5, borderRadius: 3, marginTop: 6, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressText: { fontSize: 10, marginTop: 3, fontWeight: '600' },
});
