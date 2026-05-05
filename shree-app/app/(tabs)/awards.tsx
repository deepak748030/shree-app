import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { claimReward, fetchRewards, type RewardServer } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Row =
    | { kind: 'header'; unlocked: number; total: number }
    | { kind: 'reward'; reward: RewardServer };

export default function AwardsScreen() {
    const { theme } = useAppTheme();
    const { t, language } = useLanguage();
    const { user } = useAuth();
    const router = useRouter();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#181818' : '#FFFFFF';
    const lockedBg = isDark ? '#141414' : '#F4F4F4';
    const screenBg = isDark ? '#0A0A0A' : theme.bgCream;
    const trackBg = isDark ? '#2A2A2A' : '#E5E5E5';
    const ACCENT = theme.accent;

    const [rewards, setRewards] = useState<RewardServer[]>([]);
    const [isMember, setIsMember] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [claiming, setClaiming] = useState<string | null>(null);

    const isHindi = language === 'hi';

    const load = useCallback(async () => {
        if (!user?.deviceId) return;
        try {
            const res = await fetchRewards(user.deviceId);
            if (res) {
                setRewards(res.rewards);
                setIsMember(res.isMember);
            }
        } catch { }
        setLoading(false);
    }, [user?.deviceId]);

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

    const handleClaim = useCallback(async (rewardId: string) => {
        if (!user?.deviceId) return;
        setClaiming(rewardId);
        try {
            const res = await claimReward(user.deviceId, rewardId);
            if (res.ok) {
                Alert.alert(
                    isHindi ? 'बधाई!' : 'Congratulations!',
                    isHindi ? `₹${res.amount} आपके वॉलेट में जोड़ दिए गए` : `₹${res.amount} added to your wallet`,
                );
                await load();
            } else {
                Alert.alert(isHindi ? 'त्रुटि' : 'Error', res.message || (isHindi ? 'कुछ गलत हुआ' : 'Something went wrong'));
            }
        } catch {
            Alert.alert(isHindi ? 'त्रुटि' : 'Error', isHindi ? 'नेटवर्क त्रुटि' : 'Network error');
        }
        setClaiming(null);
    }, [user?.deviceId, isHindi, load]);

    const unlockedCount = rewards.filter(r => r.unlocked).length;
    const totalCount = rewards.length;
    const percent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    const rows: Row[] = [
        { kind: 'header', unlocked: unlockedCount, total: totalCount },
        ...rewards.map(r => ({ kind: 'reward' as const, reward: r })),
    ];

    const renderHeaderCard = (unlocked: number, total: number) => (
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
                            borderTopColor: percent > 0 ? ACCENT : 'transparent',
                            borderRightColor: percent > 25 ? ACCENT : 'transparent',
                            borderBottomColor: percent > 50 ? ACCENT : 'transparent',
                            borderLeftColor: percent > 75 ? ACCENT : 'transparent',
                            transform: [{ rotate: '-45deg' }],
                        },
                    ]} />
                    <Text style={[styles.progressText, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                        {unlocked}/{total}
                    </Text>
                </View>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={[styles.headerCardTitle, { color: isDark ? '#FFFFFF' : '#1A1A1A' }]}>
                    {isHindi ? 'पुरस्कार' : 'Rewards'}
                </Text>
                <Text style={[styles.headerCardSub, { color: ACCENT }]}>
                    {percent}% {isHindi ? 'पूर्ण' : 'Complete'}
                </Text>
            </View>
        </LinearGradient>
    );

    const renderReward = (item: RewardServer) => {
        const japCur = Number(item.currentJap) || 0;
        const stepsCur = Number(item.currentSteps) || 0;
        const hwCur = Number(item.currentHandwritten) || 0;
        const hwTarget = Number(item.handwrittenTarget) || 0;
        const japProgress = item.japTarget > 0 ? Math.min(100, Math.round((japCur / item.japTarget) * 100)) : 0;
        const stepsProgress = item.stepsTarget > 0 ? Math.min(100, Math.round((stepsCur / item.stepsTarget) * 100)) : 0;
        const hwProgress = hwTarget > 0 ? Math.min(100, Math.round((hwCur / hwTarget) * 100)) : 0;
        const circleColor = item.unlocked ? ACCENT : (isDark ? '#3A3A3A' : '#C8C8C8');
        const titleColor = item.unlocked ? textPrimary : (isDark ? '#BDBDBD' : '#555555');

        return (
            <View
                style={[
                    styles.awardCard,
                    {
                        backgroundColor: item.unlocked ? cardBg : lockedBg,
                        borderColor: item.unlocked ? ACCENT + '44' : (isDark ? '#222' : '#E5E5E5'),
                    },
                ]}
            >
                {/* Reward amount circle */}
                <View style={styles.milestoneWrap}>
                    <View style={[styles.milestoneOuter, { borderColor: circleColor }]}>
                        <View style={[styles.milestoneInner, { borderColor: circleColor }]}>
                            <Text style={[styles.milestoneNumber, { color: circleColor }]}>
                                ₹{item.rewardAmount}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.awardTitle, { color: titleColor }]} numberOfLines={1}>
                        {isHindi ? item.title_hi : item.title_en}
                    </Text>
                    <Text style={[styles.awardDesc, { color: textMuted }]} numberOfLines={2}>
                        {isHindi ? item.description_hi : item.description_en}
                    </Text>

                    {/* Jap progress */}
                    {item.japTarget > 0 && (
                        <View style={{ marginTop: 6 }}>
                            <Text style={[styles.progressLabel, { color: textMuted }]}>
                                {isHindi ? 'जप' : 'Jap'}: {Math.min(japCur, item.japTarget)} / {item.japTarget}
                            </Text>
                            <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                                <View style={[styles.progressFill, { width: `${japProgress}%`, backgroundColor: '#4CAF50' }]} />
                            </View>
                        </View>
                    )}

                    {/* Steps progress */}
                    {item.stepsTarget > 0 && (
                        <View style={{ marginTop: 5 }}>
                            <Text style={[styles.progressLabel, { color: textMuted }]}>
                                {isHindi ? 'कदम' : 'Steps'}: {Math.min(stepsCur, item.stepsTarget)} / {item.stepsTarget}
                            </Text>
                            <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                                <View style={[styles.progressFill, { width: `${stepsProgress}%`, backgroundColor: '#2196F3' }]} />
                            </View>
                        </View>
                    )}

                    {/* Handwritten progress */}
                    {hwTarget > 0 && (
                        <View style={{ marginTop: 5 }}>
                            <Text style={[styles.progressLabel, { color: textMuted }]}>
                                {isHindi ? 'लिखित नाम' : 'Handwritten'}: {Math.min(hwCur, hwTarget)} / {hwTarget}
                            </Text>
                            <View style={[styles.progressTrack, { backgroundColor: trackBg }]}>
                                <View style={[styles.progressFill, { width: `${hwProgress}%`, backgroundColor: '#9C27B0' }]} />
                            </View>
                        </View>
                    )}

                    {/* Action button */}
                    <View style={{ marginTop: 8 }}>
                        {item.claimed ? (
                            <View style={[styles.claimedBadge, { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}>
                                <Ionicons name="checkmark-circle" size={14} color={ACCENT} />
                                <Text style={[styles.claimedText, { color: ACCENT }]}>
                                    {isHindi ? 'प्राप्त किया' : 'Claimed'}
                                </Text>
                            </View>
                        ) : item.unlocked && isMember ? (
                            <TouchableOpacity
                                style={[styles.claimBtn, { backgroundColor: ACCENT }]}
                                onPress={() => handleClaim(item._id)}
                                disabled={claiming === item._id}
                                activeOpacity={0.7}
                            >
                                {claiming === item._id ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={styles.claimBtnText}>
                                        {isHindi ? `₹${item.rewardAmount} प्राप्त करें` : `Claim ₹${item.rewardAmount}`}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        ) : item.unlocked && !isMember ? (
                            <TouchableOpacity
                                style={[styles.claimBtn, { backgroundColor: '#7C3AED' }]}
                                onPress={() => router.push('/membership')}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="star" size={14} color="#FFF" style={{ marginRight: 4 }} />
                                <Text style={styles.claimBtnText}>
                                    {isHindi ? 'सदस्य बनें' : 'Become Member'}
                                </Text>
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.lockedBadge, { backgroundColor: isDark ? '#222' : '#E5E5E5' }]}>
                                <Ionicons name="lock-closed" size={12} color={textMuted} />
                                <Text style={[styles.lockedText, { color: textMuted }]}>
                                    {isHindi ? 'लक्ष्य पूरा करें' : 'Complete Target'}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    const renderItem = ({ item }: { item: Row }) => {
        if (item.kind === 'header') return renderHeaderCard(item.unlocked, item.total);
        return renderReward(item.reward);
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: screenBg, justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
                <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />
                <ActivityIndicator size="large" color={ACCENT} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: screenBg }]} edges={['top']}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />

            <View style={styles.headerWrap}>
                <View style={[styles.trophyBox, { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' }]}>
                    <Ionicons name="trophy" size={20} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.headerTitle, { color: textPrimary }]}>
                        {isHindi ? 'पुरस्कार' : 'Rewards'}
                    </Text>
                    <Text style={[styles.headerSub, { color: textMuted }]}>
                        {isHindi ? 'लक्ष्य पूरा करें और इनाम पाएं' : 'Complete targets and earn rewards'}
                    </Text>
                </View>
            </View>

            <FlatList
                data={rows}
                keyExtractor={(item, i) => item.kind === 'header' ? 'header' : item.reward._id}
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
                ListEmptyComponent={
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Ionicons name="gift-outline" size={48} color={textMuted} />
                        <Text style={{ color: textMuted, marginTop: 12, fontSize: 14, textAlign: 'center' }}>
                            {isHindi ? 'अभी कोई पुरस्कार उपलब्ध नहीं' : 'No rewards available yet'}
                        </Text>
                    </View>
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
    },
    progressText: { fontSize: 14, fontWeight: '800' },
    headerCardTitle: { fontSize: 20, fontWeight: '800' },
    headerCardSub: { fontSize: 13, marginTop: 4, fontWeight: '700' },
    awardCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    milestoneWrap: { width: 54, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
    milestoneOuter: {
        width: 50,
        height: 50,
        borderRadius: 25,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneInner: {
        width: 42,
        height: 42,
        borderRadius: 21,
        borderWidth: 1,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    milestoneNumber: { fontSize: 12, fontWeight: '900', lineHeight: 14 },
    awardTitle: { fontSize: 14, fontWeight: '800' },
    awardDesc: { fontSize: 11, marginTop: 2 },
    progressTrack: { height: 6, borderRadius: 3, marginTop: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    progressLabel: { fontSize: 10, fontWeight: '600' },
    claimBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    claimBtnText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    claimedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        alignSelf: 'flex-start',
    },
    claimedText: { fontSize: 12, fontWeight: '700' },
    lockedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 5,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    lockedText: { fontSize: 11, fontWeight: '600' },
});
