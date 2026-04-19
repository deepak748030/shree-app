import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useDeviceId } from '@/hooks/use-device-id';
import {
    fetchHandwrittenNaam,
    incrementHandwrittenNaam,
    updateHandwrittenMantra,
} from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

const TEXT_DARK = '#333333';
const CACHE_KEY = '@handwritten_naam_cache_v2';

const MANTRAS = [
    'Om Namah Shivay',
    'ॐ नमः शिवाय',
    'Hare Krishna',
    'हरे कृष्ण',
    'Jai Shri Ram',
    'जय श्री राम',
    'राधे राधे',
    'Radhe Radhe',
];

interface CacheShape {
    lifetime: number;
    todayDate: string; // YYYY-MM-DD (IST)
    today: number;
    mantra: string;
}

function todayKeyIST() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + (now.getTimezoneOffset() * 60 * 1000) + istOffset);
    return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, '0')}-${String(ist.getDate()).padStart(2, '0')}`;
}

export default function HandwrittenNaamScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const deviceId = useDeviceId();

    const [loading, setLoading] = useState(true);
    const [today, setToday] = useState(0);
    const [lifetime, setLifetime] = useState(0);
    const [selectedMantra, setSelectedMantra] = useState(MANTRAS[0]);
    const [mantraPickerVisible, setMantraPickerVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [paths, setPaths] = useState<string[]>([]);
    const currentPathRef = useRef<string>('');
    const [currentPath, setCurrentPath] = useState<string>('');

    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetCfg, setSheetCfg] = useState({
        type: 'success' as 'success' | 'error' | 'info' | 'warning',
        title: '',
        message: '',
    });

    const showSheet = (
        type: 'success' | 'error' | 'info' | 'warning',
        title: string,
        message: string,
    ) => {
        setSheetCfg({ type, title, message });
        setSheetVisible(true);
    };

    // Load: try cache instantly, then fetch from server
    useEffect(() => {
        let mounted = true;
        (async () => {
            // 1. Hydrate from cache for instant render
            try {
                const raw = await AsyncStorage.getItem(CACHE_KEY);
                if (raw) {
                    const c: CacheShape = JSON.parse(raw);
                    if (c.mantra) setSelectedMantra(c.mantra);
                    if (typeof c.lifetime === 'number') setLifetime(c.lifetime);
                    if (typeof c.today === 'number' && c.todayDate === todayKeyIST()) {
                        setToday(c.today);
                    } else {
                        setToday(0);
                    }
                }
            } catch { }

            // 2. Fetch fresh from server (needs deviceId)
            if (!deviceId) return;
            try {
                const data = await fetchHandwrittenNaam(deviceId);
                if (mounted && data) {
                    setLifetime(data.lifetimeCount);
                    setToday(data.todayCount);
                    if (data.selectedMantra) setSelectedMantra(data.selectedMantra);
                    await AsyncStorage.setItem(
                        CACHE_KEY,
                        JSON.stringify({
                            lifetime: data.lifetimeCount,
                            today: data.todayCount,
                            todayDate: todayKeyIST(),
                            mantra: data.selectedMantra,
                        } as CacheShape),
                    );
                }
            } catch { }
            if (mounted) setLoading(false);
        })();
        return () => {
            mounted = false;
        };
    }, [deviceId]);

    const persistCache = async (next: { lifetime: number; today: number; mantra: string }) => {
        try {
            await AsyncStorage.setItem(
                CACHE_KEY,
                JSON.stringify({
                    lifetime: next.lifetime,
                    today: next.today,
                    todayDate: todayKeyIST(),
                    mantra: next.mantra,
                } as CacheShape),
            );
        } catch { }
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    currentPathRef.current = `M${locationX.toFixed(2)},${locationY.toFixed(2)}`;
                    setCurrentPath(currentPathRef.current);
                },
                onPanResponderMove: (e) => {
                    const { locationX, locationY } = e.nativeEvent;
                    currentPathRef.current += ` L${locationX.toFixed(2)},${locationY.toFixed(2)}`;
                    setCurrentPath(currentPathRef.current);
                },
                onPanResponderRelease: () => {
                    if (currentPathRef.current) {
                        const completedPath = currentPathRef.current;
                        setPaths((prev) => [...prev, completedPath]);
                        currentPathRef.current = '';
                        setCurrentPath('');
                    }
                },
                onPanResponderTerminate: () => {
                    if (currentPathRef.current) {
                        const completedPath = currentPathRef.current;
                        setPaths((prev) => [...prev, completedPath]);
                        currentPathRef.current = '';
                        setCurrentPath('');
                    }
                },
            }),
        []
    );

    const handleClear = () => {
        setPaths([]);
        currentPathRef.current = '';
        setCurrentPath('');
    };

    const handleNext = async () => {
        if (submitting) return;
        if (paths.length === 0) {
            showSheet('warning', t('error'), t('handwritten_empty_msg'));
            return;
        }
        if (!deviceId) {
            showSheet('warning', t('error'), t('handwritten_empty_msg'));
            return;
        }

        // Clear canvas immediately on Next
        setPaths([]);
        currentPathRef.current = '';
        setCurrentPath('');

        const prevToday = today;
        const prevLifetime = lifetime;
        const newToday = today + 1;
        const newLifetime = lifetime + 1;
        setToday(newToday);
        setLifetime(newLifetime);
        setSubmitting(true);

        try {
            const result = await incrementHandwrittenNaam(deviceId, 1, selectedMantra);
            if (result) {
                setToday(result.todayCount);
                setLifetime(result.lifetimeCount);
                await persistCache({
                    lifetime: result.lifetimeCount,
                    today: result.todayCount,
                    mantra: result.selectedMantra || selectedMantra,
                });
            } else {
                // Server failed - rollback
                setToday(prevToday);
                setLifetime(prevLifetime);
                showSheet('error', t('error'), t('membership_error_msg'));
            }
        } catch {
            setToday(prevToday);
            setLifetime(prevLifetime);
            showSheet('error', t('error'), t('membership_error_msg'));
        } finally {
            setSubmitting(false);
        }
    };

    const handleSelectMantra = async (m: string) => {
        setSelectedMantra(m);
        setMantraPickerVisible(false);
        await persistCache({ lifetime, today, mantra: m });
        if (deviceId) {
            updateHandwrittenMantra(deviceId, m).catch(() => { });
        }
    };

    if (loading) {
        return (
            <View style={[styles.loaderWrap, { backgroundColor: theme.bgCream }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style="dark" />

            {/* Header */}
            <View
                style={[
                    styles.header,
                    {
                        backgroundColor: theme.headerBg,
                        paddingTop: insets.top + 6,
                        borderBottomColor: theme.cardBorder,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[styles.backBtn, { borderColor: theme.cardBorder }]}
                    onPress={() => router.back()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="chevron-back" size={22} color={TEXT_DARK} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.mantraBtn, { borderColor: theme.cardBorder }]}
                    onPress={() => setMantraPickerVisible(true)}
                    activeOpacity={0.7}
                >
                    <Text style={styles.mantraBtnText} numberOfLines={1}>
                        {selectedMantra}
                    </Text>
                    <Ionicons name="chevron-down" size={18} color={TEXT_DARK} />
                </TouchableOpacity>
            </View>

            {/* Counters */}
            <View style={styles.countersRow}>
                <View style={[styles.countCard, { borderColor: theme.cardBorder, backgroundColor: '#FFFFFF' }]}>
                    <Text style={styles.countLabel}>{t('handwritten_today')}</Text>
                    <View style={styles.countRow}>
                        <Text style={[styles.countValue, { color: theme.accent }]}>{today}</Text>
                        <Ionicons name="create-outline" size={18} color={theme.accent} />
                    </View>
                </View>
                <View style={[styles.countCard, { borderColor: theme.cardBorder, backgroundColor: '#FFFFFF' }]}>
                    <Text style={styles.countLabel}>{t('handwritten_lifetime')}</Text>
                    <View style={styles.countRow}>
                        <Text style={[styles.countValue, { color: theme.accent }]}>{lifetime}</Text>
                        <Ionicons name="checkmark-circle-outline" size={18} color={theme.accent} />
                    </View>
                </View>
            </View>

            {/* Drawing canvas */}
            <View
                style={[styles.canvasWrap, { borderColor: theme.cardBorder }]}
                {...panResponder.panHandlers}
            >
                <Svg style={StyleSheet.absoluteFill}>
                    {paths.map((d, i) => (
                        <Path
                            key={i}
                            d={d}
                            stroke={theme.accent}
                            strokeWidth={4}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ))}
                    {currentPath ? (
                        <Path
                            d={currentPath}
                            stroke={theme.accent}
                            strokeWidth={4}
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}
                </Svg>
                {paths.length === 0 && !currentPath ? (
                    <View pointerEvents="none" style={styles.hintWrap}>
                        <Text style={styles.hintText}>{t('handwritten_hint')}</Text>
                    </View>
                ) : null}
            </View>

            {/* Bottom action buttons */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.clearBtn, { borderColor: theme.cardBorder, backgroundColor: '#FFFFFF' }]}
                    onPress={handleClear}
                    activeOpacity={0.7}
                    disabled={submitting}
                >
                    <Ionicons name="refresh" size={18} color={TEXT_DARK} />
                    <Text style={styles.clearBtnText}>{t('handwritten_clear')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.nextBtn, { backgroundColor: theme.accent, opacity: submitting ? 0.85 : 1 }]}
                    onPress={handleNext}
                    activeOpacity={0.8}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                            <Text style={styles.nextBtnText}>{t('handwritten_next')}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Mantra picker bottom sheet */}
            <Modal
                visible={mantraPickerVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setMantraPickerVisible(false)}
            >
                <Pressable style={styles.modalOverlay} onPress={() => setMantraPickerVisible(false)} />
                <View style={[styles.pickerSheet, { backgroundColor: theme.bgCream, borderColor: theme.cardBorder }]}>
                    <View style={styles.pickerHandle} />
                    <Text style={styles.pickerTitle}>{t('handwritten_pick_mantra')}</Text>
                    {MANTRAS.map((m) => {
                        const active = m === selectedMantra;
                        return (
                            <TouchableOpacity
                                key={m}
                                style={[
                                    styles.pickerItem,
                                    {
                                        borderColor: active ? theme.accent : theme.cardBorder,
                                        backgroundColor: active ? theme.headerBg : '#FFFFFF',
                                    },
                                ]}
                                onPress={() => handleSelectMantra(m)}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.pickerItemText}>{m}</Text>
                                {active ? (
                                    <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Modal>

            <BottomSheetMessage
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                type={sheetCfg.type}
                title={sheetCfg.title}
                message={sheetCfg.message}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingBottom: 6,
        borderBottomWidth: 1,
        gap: 6,
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
    },
    mantraBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
    },
    mantraBtnText: { flex: 1, fontSize: 14, fontWeight: '600', color: TEXT_DARK },
    countersRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 6, marginTop: 6 },
    countCard: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    countLabel: { fontSize: 12, color: '#888', marginBottom: 2 },
    countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    countValue: { fontSize: 22, fontWeight: '700' },
    canvasWrap: {
        flex: 1,
        marginHorizontal: 6,
        marginTop: 6,
        borderWidth: 1,
        borderRadius: 14,
        backgroundColor: '#FFFFFF',
        overflow: 'hidden',
    },
    hintWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
    hintText: { fontSize: 13, color: '#AAAAAA' },
    bottomBar: {
        flexDirection: 'row',
        gap: 6,
        paddingHorizontal: 6,
        paddingTop: 6,
        paddingBottom: 6,
    },
    clearBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
    },
    clearBtnText: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
    nextBtn: {
        flex: 1.4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 46,
        borderRadius: 12,
    },
    nextBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    pickerSheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 6,
        paddingTop: 6,
        paddingBottom: 18,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        borderTopWidth: 1,
        gap: 6,
    },
    pickerHandle: {
        alignSelf: 'center',
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CCCCCC',
        marginBottom: 6,
    },
    pickerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: TEXT_DARK,
        paddingHorizontal: 4,
        marginBottom: 2,
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    pickerItemText: { fontSize: 14, fontWeight: '600', color: TEXT_DARK },
});
