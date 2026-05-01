import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchHandwrittenNaam, fetchUserData } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface AwardDef {
    id: string;
    titleKey: string;
    descKey: string;
    target: number;
    unitLabel: string; // shown inside circle (e.g. "01")
    metric: 'jap' | 'mala' | 'handwritten';
    section: 'jap' | 'mala' | 'writing';
}

const AWARDS: AwardDef[] = [
    { id: 'first_step', titleKey: 'award_first_step', descKey: 'award_first_step_desc', target: 1, unitLabel: '01', metric: 'jap', section: 'jap' },
    { id: 'century', titleKey: 'award_century', descKey: 'award_century_desc', target: 100, unitLabel: '100', metric: 'jap', section: 'jap' },
    { id: 'one_mala', titleKey: 'award_one_mala', descKey: 'award_one_mala_desc', target: 108, unitLabel: '108', metric: 'jap', section: 'jap' },
    { id: 'thousand', titleKey: 'award_thousand', descKey: 'award_thousand_desc', target: 1000, unitLabel: '1K', metric: 'jap', section: 'jap' },
    { id: 'five_thousand', titleKey: 'award_five_thousand', descKey: 'award_five_thousand_desc', target: 5000, unitLabel: '5K', metric: 'jap', section: 'jap' },
    { id: 'dedicated', titleKey: 'award_dedicated', descKey: 'award_dedicated_desc', target: 1, unitLabel: '01', metric: 'mala', section: 'mala' },
    { id: 'devotee', titleKey: 'award_devotee', descKey: 'award_devotee_desc', target: 10, unitLabel: '10', metric: 'mala', section: 'mala' },
    { id: 'master', titleKey: 'award_master', descKey: 'award_master_desc', target: 100, unitLabel: '100', metric: 'mala', section: 'mala' },
    { id: 'legend', titleKey: 'award_legend', descKey: 'award_legend_desc', target: 1000, unitLabel: '1K', metric: 'mala', section: 'mala' },
    { id: 'writer', titleKey: 'award_writer', descKey: 'award_writer_desc', target: 10, unitLabel: '10', metric: 'handwritten', section: 'writing' },
    { id: 'scribe', titleKey: 'award_scribe', descKey: 'award_scribe_desc', target: 108, unitLabel: '108', metric: 'handwritten', section: 'writing' },
];

type Row =
    | { kind: 'header' }
    | { kind: 'section'; titleKey: string }
    | { kind: 'award'; award: AwardDef };

export default function AwardsScreen() {
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const { user } = useAuth();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#181818' : '#FFFFFF';
    const lockedBg = isDark ? '#141414' : '#F4F4F4';
    const screenBg = isDark ? '#0A0A0A' : theme.bgCream;
    const trackBg = isDark ? '#2A2A2A' : '#E5E5E5';

    const ACCENT = theme.accent;

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

    // Realtime auto-refresh: poll every 15s while focused
    useFocusEffect(
        useCallback(() => {
            load();
            const interval = setInterval(load, 15000);
            return () => clearInterval(interval);
        }, [load])
    );

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
    const totalCount = AWARDS.length;
    const percent = Math.round((unlockedCount / totalCount) * 100);

    const rows: Row[] = useMemo(() => {
        const out: Row[] = [{ kind: 'header' }];
        const sections: { id: AwardDef['section']; titleKey: string }[] = [
            { id: 'jap', titleKey: 'awards_section_jap' },
            { id: 'mala', titleKey: 'awards_section_mala' },
            { id: 'writing', titleKey: 'awards_section_writing' },
        ];
        sections.forEach((s) => {
            const list = AWARDS.filter((a) => a.section === s.id);
            if (list.length === 0) return;
            out.push({ kind: 'section', titleKey: s.titleKey });
            list.forEach((a) => out.push({ kind: 'award', award: a }));
        });
        return out;
    }, []);

    const renderHeaderCard = () => (
        <LinearGradient
            colors={(isDark ? ['#3A2E12', '#231A09'] : ['#FFE9B5', '#FFD279']) as readonly [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerCard, { borderColor: ACCENT + '55' }]}
        >
            <View style={styles.progressCircleWrap}>
                <View style={[styles.progressCircle, { borderColor: trackBg }]}>
                    <View style={[
                        styles.progressArc,
                        {
                            borderColor: ACCENT,
                            borderRightColor: percent > 25 ? ACCENT : 'transparent',
                            borderBottomColor: percent > 50 ? ACCENT : 'transparent',
                            borderLeftColor: percent > 75 ? ACCENT : 'transparent',
                            transform: [{ rotate: '-45deg' }],
                        },
                    ]} />
                    <Text style={[styles.progressText, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                        {unlockedCount}/{totalCount}
                    </Text>
                </View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.headerCardTitle, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                    {t('awards_title' as any)}
                </Text>
                <Text style={[styles.headerCardSub, { color: ACCENT }]}>
                    {percent}% {t('awards_progress_label' as any)}
                </Text>
            </View>
        </LinearGradient>
    );

    const renderAward = (item: AwardDef) => {
        const current = getCurrent(item.metric);
        const unlocked = current >= item.target;
        const progress = Math.min(100, Math.round((current / item.target) * 100));
        const circleColor = unlocked ? ACCENT : (isDark ? '#3A3A3A' : '#C8C8C8');
        const titleColor = unlocked ? textPrimary : (isDark ? '#BDBDBD' : '#555555');

        return (
            <View
                style={[
                    styles.awardCard,
                    {
                        backgroundColor: unlocked ? cardBg : lockedBg,
                        borderColor: unlocked ? ACCENT + '44' : (isDark ? '#222' : '#E5E5E5'),
                    },
                ]}
            >
                {/* Milestone circle */}
                <View style={styles.milestoneWrap}>
                    <View style={[styles.milestoneOuter, { borderColor: circleColor }]}>
                        <View style={[styles.milestoneInner, { borderColor: circleColor }]}>
                            <Text style={[styles.milestoneNumber, { color: circleColor }]}>
                                {item.unitLabel}
                            </Text>
                            <Text style={[styles.milestoneUnit, { color: circleColor }]}>
                                {item.metric === 'mala' ? 'Mala' : item.metric === 'handwritten' ? 'Write' : 'Jap'}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.titleRow}>
                        <Text style={[styles.awardTitle, { color: titleColor }]} numberOfLines={1}>
                            {t(item.titleKey as any)}
                        </Text>
                        <View style={[
                            styles.statusBadge,
                            {
                                backgroundColor: unlocked ? ACCENT + '22' : (isDark ? '#222' : '#E5E5E5'),
                                borderColor: unlocked ? ACCENT : (isDark ? '#333' : '#CCC'),
                            },
                        ]}>
                            <Text style={[styles.statusBadgeText, { color: unlocked ? ACCENT : textMuted }]}>
                                {t((unlocked ? 'awards_unlocked' : 'awards_locked') as any)}
                            </Text>
                        </View>
                    </View>
                    <Text style={[styles.awardDesc, { color: textMuted }]} numberOfLines={2}>
                        {t(item.descKey as any)}
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                        <View
                            style={[
                                styles.progressFill,
                                { width: `${progress}%`, backgroundColor: circleColor },
                            ]}
                        />
                    </View>
                    <Text style={[styles.progressLabel, { color: textMuted }]}>
                        {Math.min(current, item.target)} / {item.target}
                    </Text>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: Row }) => {
        if (item.kind === 'header') return renderHeaderCard();
        if (item.kind === 'section') {
            return (
                <Text style={[styles.sectionLabel, { color: ACCENT }]}>
                    {t(item.titleKey as any)}
                </Text>
            );
        }
        return renderAward(item.award);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />

            <View style={styles.headerWrap}>
                <View style={[styles.trophyBox, { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' }]}>
                    <Ionicons name="trophy" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: textPrimary }]}>
                        {t('awards_title' as any)}
                    </Text>
                    <Text style={[styles.headerSub, { color: textMuted }]}>
                        {t('awards_subtitle' as any)}
                    </Text>
                </View>
            </View>

            <FlatList
                data={rows}
                keyExtractor={(item, i) => `r-${i}-${item.kind}`}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 12, paddingBottom: 24 }}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={[ACCENT]}
                        tintColor={ACCENT}
                    />
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 6,
    },
    trophyBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    headerTitle: { fontSize: 24, fontWeight: '900', letterSpacing: 1 },
    headerSub: { fontSize: 13, marginTop: 1 },
    headerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    progressCircleWrap: { width: 70, height: 70 },
    progressCircle: {
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressArc: {
        position: 'absolute',
        width: 70,
        height: 70,
        borderRadius: 35,
        borderWidth: 4,
        borderTopColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: 'transparent',
    },
    progressText: { fontSize: 14, fontWeight: '800' },
    headerCardTitle: { fontSize: 20, fontWeight: '800' },
    headerCardSub: { fontSize: 13, marginTop: 4, fontWeight: '700' },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 1.4,
        paddingHorizontal: 4,
        paddingTop: 6,
    },
    awardCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
    },
    milestoneWrap: { width: 64, alignItems: 'center', justifyContent: 'center' },
    milestoneOuter: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneInner: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneNumber: { fontSize: 14, fontWeight: '900', lineHeight: 16 },
    milestoneUnit: { fontSize: 8, fontWeight: '700', marginTop: 1, letterSpacing: 0.5 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    awardTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusBadgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
    awardDesc: { fontSize: 12, marginTop: 3 },
    progressTrack: { height: 6, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressLabel: { fontSize: 11, marginTop: 4, fontWeight: '600' },
});
