import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useDeviceId } from '@/hooks/use-device-id';
import { useStepTracker } from '@/hooks/use-step-tracker';
import { syncStepData, fetchStepData } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = SCREEN_WIDTH * 0.58;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function StepTrackerScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const { user, isLoggedIn, mobile } = useAuth();
    const deviceId = useDeviceId();
    const {
        todaySteps,
        distance,
        calories,
        dailyGoal,
        progress,
        isAvailable,
        loading,
        updateGoal,
        restoreFromServer,
    } = useStepTracker();

    const [syncing, setSyncing] = useState(false);
    const progressAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(progressAnim, {
                toValue: progress,
                duration: 1200,
                useNativeDriver: false,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 5,
                useNativeDriver: true,
            }),
        ]).start();
    }, [progress]);

    const strokeDashoffset = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [CIRCUMFERENCE, 0],
    });

    useEffect(() => {
        if (!isLoggedIn || !deviceId || todaySteps > 0) return;
        (async () => {
            const data = await fetchStepData(deviceId);
            if (data) {
                const today = new Date().toISOString().split('T')[0];
                const todayLog = data.dailyLogs?.find((l: any) => l.date === today);
                restoreFromServer({
                    todaySteps: todayLog?.steps || 0,
                    dailyGoal: data.dailyGoal || 5000,
                });
            }
        })();
    }, [isLoggedIn, deviceId]);

    const syncToServer = useCallback(async () => {
        if (!deviceId || !isLoggedIn || !mobile) return;
        setSyncing(true);
        try {
            await syncStepData(deviceId, mobile, todaySteps, distance, calories, dailyGoal);
        } catch { }
        setSyncing(false);
    }, [deviceId, isLoggedIn, mobile, todaySteps, distance, calories, dailyGoal]);

    useEffect(() => {
        if (!isLoggedIn || !deviceId) return;
        const interval = setInterval(syncToServer, 60000);
        return () => clearInterval(interval);
    }, [syncToServer, isLoggedIn, deviceId]);

    // Derive colors from theme with proper contrast
    const accentColor = theme.accent;
    const bgColor = theme.bgCream;
    const cardBg = '#FFFFFF';
    const ringTrackColor = theme.cardBorder + '40';
    const textColor = '#1A1A1A';
    const subTextColor = '#666666';

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: bgColor, paddingTop: insets.top }]}>
                <StatusBar barStyle="dark-content" />
                <ActivityIndicator size="large" color={accentColor} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color={textColor} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textColor }]}>{t('step_tracker_header' as any)}</Text>
                <TouchableOpacity onPress={syncToServer} style={styles.syncBtn} disabled={syncing}>
                    {syncing ? (
                        <ActivityIndicator size="small" color={accentColor} />
                    ) : (
                        <Ionicons name="sync" size={22} color={accentColor} />
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Ring Card */}
                <View style={[styles.ringCard, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
                    <Animated.View style={[styles.ringContainer, { transform: [{ scale: scaleAnim }] }]}>
                        <Svg width={RING_SIZE} height={RING_SIZE}>
                            <Circle
                                cx={RING_SIZE / 2}
                                cy={RING_SIZE / 2}
                                r={RADIUS}
                                stroke={ringTrackColor}
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                            />
                            <AnimatedCircle
                                cx={RING_SIZE / 2}
                                cy={RING_SIZE / 2}
                                r={RADIUS}
                                stroke={accentColor}
                                strokeWidth={STROKE_WIDTH}
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={CIRCUMFERENCE}
                                strokeDashoffset={strokeDashoffset}
                                rotation="-90"
                                origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                            />
                        </Svg>
                        <View style={styles.ringCenter}>
                            <Text style={[styles.stepsCount, { color: textColor }]}>{todaySteps.toLocaleString()}</Text>
                            <Text style={[styles.stepsLabel, { color: subTextColor }]}>{t('step_tracker_steps' as any)}</Text>
                        </View>
                    </Animated.View>
                </View>

                {/* Stats Row */}
                <View style={[styles.statsRow, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
                    <View style={styles.statItem}>
                        <View style={[styles.statIconBg, { backgroundColor: '#EBF0FF' }]}>
                            <Ionicons name="location" size={18} color="#5B7FFF" />
                        </View>
                        <View>
                            <Text style={[styles.statValue, { color: textColor }]}>{distance} km</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Distance</Text>
                        </View>
                    </View>
                    <View style={[styles.statDivider, { backgroundColor: theme.cardBorder }]} />
                    <View style={styles.statItem}>
                        <View style={[styles.statIconBg, { backgroundColor: '#FFEBEB' }]}>
                            <Ionicons name="flame" size={18} color="#FF6B6B" />
                        </View>
                        <View>
                            <Text style={[styles.statValue, { color: textColor }]}>{calories} kcal</Text>
                            <Text style={[styles.statLabel, { color: subTextColor }]}>Calories</Text>
                        </View>
                    </View>
                </View>

                {/* Goal Card */}
                <View style={[styles.goalCard, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.goalTitle, { color: textColor }]}>{t('step_tracker_daily_goal' as any)}</Text>
                    <Text style={[styles.goalValue, { color: accentColor }]}>{dailyGoal.toLocaleString()} {t('step_tracker_steps' as any)}</Text>
                    <View style={[styles.goalBarBg, { backgroundColor: ringTrackColor }]}>
                        <View style={[styles.goalBarFill, { width: `${Math.min(progress * 100, 100)}%`, backgroundColor: accentColor }]} />
                    </View>
                    <Text style={[styles.goalPercent, { color: subTextColor }]}>
                        {Math.round(progress * 100)}% {t('step_tracker_completed' as any)}
                    </Text>
                </View>

                {/* Goal presets */}
                <View style={styles.goalPresetsRow}>
                    {[3000, 5000, 8000, 10000].map(g => (
                        <TouchableOpacity
                            key={g}
                            onPress={() => updateGoal(g)}
                            style={[
                                styles.goalPresetBtn,
                                {
                                    borderColor: dailyGoal === g ? accentColor : theme.cardBorder,
                                    backgroundColor: dailyGoal === g ? accentColor : cardBg,
                                },
                            ]}
                        >
                            <Text style={[styles.goalPresetText, { color: dailyGoal === g ? '#FFF' : textColor }]}>
                                {(g / 1000).toFixed(0)}K
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {!isAvailable && (
                    <View style={[styles.warningCard, { backgroundColor: '#FFF8E1', borderColor: '#FFD54F' }]}>
                        <Ionicons name="warning" size={20} color="#F9A825" />
                        <Text style={[styles.warningText, { color: '#5D4037' }]}>{t('step_tracker_not_available' as any)}</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 48,
        paddingHorizontal: 6,
    },
    backBtn: { padding: 6 },
    headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
    syncBtn: { padding: 6 },
    scrollContent: { alignItems: 'center', paddingBottom: 40, paddingHorizontal: 6 },
    ringCard: {
        width: '100%',
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
        paddingVertical: 20,
        marginTop: 6,
    },
    ringContainer: {
        width: RING_SIZE,
        height: RING_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ringCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    stepsCount: { fontSize: 42, fontWeight: '800' },
    stepsLabel: { fontSize: 14, fontWeight: '500', marginTop: 2 },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 14,
        marginTop: 6,
    },
    statItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statIconBg: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statDivider: { width: 1, height: 36, marginHorizontal: 6 },
    statValue: { fontSize: 16, fontWeight: '700' },
    statLabel: { fontSize: 11, fontWeight: '500', marginTop: 1 },
    goalCard: {
        width: '100%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 16,
        marginTop: 6,
    },
    goalTitle: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    goalValue: { fontSize: 22, fontWeight: '800', marginBottom: 10 },
    goalBarBg: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
    },
    goalBarFill: { height: '100%', borderRadius: 4 },
    goalPercent: { fontSize: 12, marginTop: 6 },
    goalPresetsRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 6,
    },
    goalPresetBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
    },
    goalPresetText: { fontSize: 13, fontWeight: '600' },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderRadius: 10,
        padding: 12,
        marginTop: 6,
        width: '100%',
    },
    warningText: { fontSize: 13, flex: 1 },
});
