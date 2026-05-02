import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import RazorpayCheckoutWebView from '@/components/razorpay-checkout-webview';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useDeviceId } from '@/hooks/use-device-id';
import {
    createMembershipOrder,
    fetchMembershipPlans,
    fetchMembershipStatus,
    verifyMembershipPayment,
    type MembershipPlan,
    type MembershipStatus,
} from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HP = 6;
const PLANS_CACHE_KEY = '@membership_plans_cache';
const STATUS_CACHE_KEY_PREFIX = '@membership_status_cache_';

export default function MembershipScreen() {
    const { theme } = useAppTheme();
    const { t, language } = useLanguage();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const deviceId = useDeviceId();
    const { mobile } = useAuth();

    const [plans, setPlans] = useState<MembershipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const [status, setStatus] = useState<MembershipStatus>({ isActive: false });
    const [paying, setPaying] = useState(false);

    const [checkout, setCheckout] = useState<{
        visible: boolean; orderId: string; amount: number; keyId: string; description: string;
    } | null>(null);

    const [sheet, setSheet] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
        visible: false, type: 'success', title: '', message: '',
    });

    // 1) Hydrate from cache (instant) — runs once
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [cachedPlans, cachedStatusRaw] = await Promise.all([
                    AsyncStorage.getItem(PLANS_CACHE_KEY),
                    deviceId ? AsyncStorage.getItem(STATUS_CACHE_KEY_PREFIX + deviceId) : Promise.resolve(null),
                ]);
                if (cancelled) return;
                if (cachedPlans) {
                    const list = JSON.parse(cachedPlans) as MembershipPlan[];
                    if (Array.isArray(list) && list.length) {
                        setPlans(list);
                        const best = list.find(p => p.isBestValue) || list[0];
                        setSelected((s) => s ?? best._id);
                        setLoading(false);
                    }
                }
                if (cachedStatusRaw) {
                    const st = JSON.parse(cachedStatusRaw) as MembershipStatus;
                    setStatus(st);
                    setLoading(false);
                }
            } catch { }
        })();
        return () => { cancelled = true; };
    }, [deviceId]);

    // 2) Fresh fetch in background
    const load = useCallback(async () => {
        try {
            const [list, st] = await Promise.all([
                fetchMembershipPlans(),
                deviceId ? fetchMembershipStatus(deviceId) : Promise.resolve({ isActive: false } as MembershipStatus),
            ]);
            if (list.length) {
                setPlans(list);
                AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(list)).catch(() => { });
                if (!selected) {
                    const best = list.find(p => p.isBestValue) || list[0];
                    setSelected(best._id);
                }
            }
            setStatus(st);
            if (deviceId) {
                AsyncStorage.setItem(STATUS_CACHE_KEY_PREFIX + deviceId, JSON.stringify(st)).catch(() => { });
            }
        } finally {
            setLoading(false);
        }
    }, [deviceId]); // eslint-disable-line

    useEffect(() => { load(); }, [load]);

    const selectedPlan = plans.find(p => p._id === selected) || null;

    const handleContinue = async () => {
        if (!selectedPlan || !deviceId) return;
        setPaying(true);
        try {
            const order = await createMembershipOrder(selectedPlan._id, deviceId, mobile || undefined);
            if (!order) {
                setSheet({ visible: true, type: 'error', title: t('error' as any), message: 'Could not create order. Please try again.' });
                return;
            }
            setCheckout({
                visible: true,
                orderId: order.orderId,
                amount: order.amount,
                keyId: order.keyId,
                description: language === 'hi' ? order.plan.name_hi : order.plan.name_en,
            });
        } finally {
            setPaying(false);
        }
    };

    const onPaymentSuccess = async (data: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        setCheckout(null);
        const result = await verifyMembershipPayment(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature);
        if (result.ok) {
            setSheet({
                visible: true,
                type: 'success',
                title: language === 'hi' ? 'सदस्यता सक्रिय!' : 'Membership Activated!',
                message: language === 'hi' ? 'धन्यवाद! आपकी सदस्यता सक्रिय हो गई है।' : 'Thank you! Your membership is now active.',
            });
            load();
        } else {
            setSheet({
                visible: true, type: 'error',
                title: t('error' as any),
                message: language === 'hi' ? 'भुगतान सत्यापन विफल।' : 'Payment verification failed.',
            });
        }
    };

    const renderPlan = ({ item: p }: { item: MembershipPlan }) => {
        const isSel = selected === p._id;
        const title = language === 'hi' ? p.name_hi : p.name_en;
        const desc = language === 'hi' ? p.description_hi : p.description_en;
        return (
            <Pressable
                onPress={() => setSelected(p._id)}
                style={[
                    styles.planCard,
                    {
                        backgroundColor: theme.cardBg,
                        borderColor: isSel ? theme.accent : theme.cardBorder,
                        borderWidth: isSel ? 2 : 1,
                    },
                ]}
            >
                {p.isBestValue && (
                    <View style={[styles.bestBadge, { backgroundColor: '#E6A700' }]}>
                        <Ionicons name="star" size={10} color="#fff" />
                        <Text style={styles.bestBadgeText}>{language === 'hi' ? 'बेस्ट' : 'BEST'}</Text>
                    </View>
                )}
                <View style={styles.planRow}>
                    <View style={[styles.planIconWrap, { backgroundColor: theme.mutedBg, borderColor: theme.accent }]}>
                        <Ionicons name={p.isLifetime ? 'infinite' : 'ribbon'} size={20} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.planTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
                        <Text style={[styles.planSub, { color: theme.subText }]} numberOfLines={1}>
                            {p.isLifetime ? (language === 'hi' ? 'आजीवन' : 'Lifetime') : `${p.durationMonths} ${language === 'hi' ? 'महीने' : (p.durationMonths === 1 ? 'month' : 'months')}`}
                        </Text>
                        {!!desc && <Text style={[styles.planDesc, { color: theme.subText }]} numberOfLines={2}>{desc}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.planPrice, { color: theme.accent }]}>₹{p.price}</Text>
                        <View style={[styles.radio, { borderColor: isSel ? theme.accent : theme.cardBorder, backgroundColor: isSel ? theme.accent : 'transparent' }]}>
                            {isSel && <Ionicons name="checkmark" size={12} color={theme.isDark ? '#000' : '#fff'} />}
                        </View>
                    </View>
                </View>
            </Pressable>
        );
    };

    const ListHeader = (
        <View>
            {status.isActive ? (
                <View style={[styles.activeCard, { backgroundColor: theme.cardBg, borderColor: '#22A06B' }]}>
                    <View style={styles.activeTopRow}>
                        <View style={[styles.activeIconWrap, { backgroundColor: theme.isDark ? '#0E2A1F' : '#E8F7EF', borderColor: '#22A06B' }]}>
                            <Ionicons name="shield-checkmark" size={26} color="#22A06B" />
                        </View>
                        <View style={[styles.activeBadge, { backgroundColor: '#22A06B' }]}>
                            <Ionicons name="checkmark-circle" size={11} color="#fff" />
                            <Text style={styles.activeBadgeText}>{language === 'hi' ? 'सक्रिय' : 'ACTIVE'}</Text>
                        </View>
                    </View>
                    <Text style={[styles.activeTitle, { color: theme.text }]}>
                        {language === 'hi' ? 'सदस्यता सक्रिय है' : 'Membership Active'}
                    </Text>
                    {(status.planName_hi || status.planName_en) && (
                        <View style={[styles.planChip, { backgroundColor: theme.mutedBg, borderColor: theme.cardBorder }]}>
                            <Ionicons name={status.isLifetime ? 'infinite' : 'ribbon'} size={13} color={theme.accent} />
                            <Text style={[styles.planChipText, { color: theme.text }]} numberOfLines={1}>
                                {language === 'hi' ? (status.planName_hi || status.planName_en) : (status.planName_en || status.planName_hi)}
                            </Text>
                        </View>
                    )}
                    <View style={styles.activeMetaRow}>
                        {status.isLifetime ? (
                            <View style={styles.metaCol}>
                                <Text style={[styles.metaLabel, { color: theme.subText }]}>
                                    {language === 'hi' ? 'अवधि' : 'Validity'}
                                </Text>
                                <Text style={[styles.metaValue, { color: theme.text }]}>
                                    {language === 'hi' ? 'आजीवन' : 'Lifetime'}
                                </Text>
                            </View>
                        ) : status.expiresAt ? (
                            <>
                                <View style={styles.metaCol}>
                                    <Text style={[styles.metaLabel, { color: theme.subText }]}>
                                        {language === 'hi' ? 'समाप्ति' : 'Expires'}
                                    </Text>
                                    <Text style={[styles.metaValue, { color: theme.text }]}>
                                        {new Date(status.expiresAt).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </Text>
                                </View>
                                <View style={[styles.metaDivider, { backgroundColor: theme.cardBorder }]} />
                                <View style={styles.metaCol}>
                                    <Text style={[styles.metaLabel, { color: theme.subText }]}>
                                        {language === 'hi' ? 'शेष दिन' : 'Days left'}
                                    </Text>
                                    <Text style={[styles.metaValue, { color: '#22A06B' }]}>
                                        {Math.max(0, Math.ceil((new Date(status.expiresAt).getTime() - Date.now()) / 86400000))}
                                    </Text>
                                </View>
                            </>
                        ) : null}
                    </View>
                </View>
            ) : (
                <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={[styles.heroIconWrap, { backgroundColor: theme.mutedBg, borderColor: theme.accent }]}>
                        <Ionicons name="ribbon" size={28} color={theme.accent} />
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>{t('membership_hero_title' as any)}</Text>
                    <Text style={[styles.heroSubtitle, { color: theme.subText }]}>{t('membership_hero_subtitle' as any)}</Text>
                </View>
            )}

            {/* Benefits */}
            <View style={[styles.benefitsCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                {[
                    'membership_benefit_no_ads',
                    'membership_benefit_instant',
                    'membership_benefit_cancel',
                    'membership_benefit_premium_content',
                ].map((key) => (
                    <View key={key} style={styles.benefitRow}>
                        <View style={[styles.checkWrap, { borderColor: '#22A06B', backgroundColor: theme.isDark ? '#0E2A1F' : '#E8F7EF' }]}>
                            <Ionicons name="checkmark" size={12} color="#22A06B" />
                        </View>
                        <Text style={[styles.benefitText, { color: theme.text }]}>{t(key as any)}</Text>
                    </View>
                ))}
            </View>

            {!status.isActive && (
                <Text style={[styles.sectionLabel, { color: theme.subText }]}>{language === 'hi' ? 'योजना चुनें' : 'Choose a plan'}</Text>
            )}
        </View>
    );

    const ListFooter = !status.isActive && plans.length > 0 ? (
        <View>
            <TouchableOpacity
                onPress={handleContinue}
                disabled={paying || !selectedPlan}
                activeOpacity={0.85}
                style={[styles.continueBtn, { backgroundColor: theme.accent, borderColor: theme.accent, opacity: !selectedPlan ? 0.6 : 1 }]}
            >
                {paying ? (
                    <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
                ) : (
                    <Text style={[styles.continueText, { color: theme.isDark ? '#000' : '#fff' }]}>
                        {language === 'hi' ? 'UPI से भुगतान करें' : 'Pay with UPI'}{selectedPlan ? `  •  ₹${selectedPlan.price}` : ''}
                    </Text>
                )}
            </TouchableOpacity>
            <Text style={[styles.upiHint, { color: theme.subText }]}>
                <Ionicons name="shield-checkmark" size={11} color="#22A06B" />{' '}
                {language === 'hi' ? 'सुरक्षित Razorpay भुगतान — केवल UPI ऐप' : 'Secure Razorpay payment — UPI apps only'}
            </Text>
        </View>
    ) : null;

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.headerText }]}>{t('membership_header' as any)}</Text>
                <View style={{ width: 28 }} />
            </View>

            {loading && plans.length === 0 && !status.isActive ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={theme.accent} />
                </View>
            ) : (
                <FlatList
                    data={status.isActive ? [] : plans}
                    keyExtractor={(item) => item._id}
                    renderItem={renderPlan}
                    ListHeaderComponent={ListHeader}
                    ListFooterComponent={ListFooter}
                    ListEmptyComponent={
                        !status.isActive ? (
                            <Text style={{ textAlign: 'center', color: theme.subText, marginTop: 20, fontSize: 13 }}>
                                {language === 'hi' ? 'अभी कोई योजना उपलब्ध नहीं है।' : 'No plans available right now.'}
                            </Text>
                        ) : null
                    }
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                />
            )}

            {checkout && (
                <RazorpayCheckoutWebView
                    visible={checkout.visible}
                    keyId={checkout.keyId}
                    orderId={checkout.orderId}
                    amount={checkout.amount}
                    name="Shree Jii"
                    description={checkout.description}
                    prefillContact={mobile || ''}
                    onClose={() => setCheckout(null)}
                    onSuccess={onPaymentSuccess}
                    onFailure={(msg) => {
                        setCheckout(null);
                        setSheet({ visible: true, type: 'error', title: t('error' as any), message: msg });
                    }}
                />
            )}

            <BottomSheetMessage
                visible={sheet.visible}
                onClose={() => setSheet((s) => ({ ...s, visible: false }))}
                type={sheet.type}
                title={sheet.title}
                message={sheet.message}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: HP, paddingVertical: 8, borderBottomWidth: 1,
    },
    backBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700' },

    scrollContent: { paddingHorizontal: HP, paddingTop: 6, paddingBottom: 20 },

    heroCard: { borderRadius: 14, borderWidth: 1, paddingVertical: 14, paddingHorizontal: 12, alignItems: 'center' },
    heroIconWrap: {
        width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginBottom: 6,
    },
    heroTitle: { fontSize: 18, fontWeight: '800', marginTop: 2 },
    heroSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center' },

    activeCard: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 14, paddingHorizontal: 14 },
    activeTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    activeIconWrap: {
        width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
    },
    activeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
    },
    activeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    activeTitle: { fontSize: 17, fontWeight: '800', marginTop: 2 },
    planChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6,
        paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, borderWidth: 1, maxWidth: '100%',
    },
    planChipText: { fontSize: 12, fontWeight: '700' },
    activeMetaRow: {
        flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(127,127,127,0.25)',
    },
    metaCol: { flex: 1 },
    metaLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },
    metaValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
    metaDivider: { width: 1, alignSelf: 'stretch', marginHorizontal: 10 },

    benefitsCard: { marginTop: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
    benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
    checkWrap: {
        width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginRight: 8,
    },
    benefitText: { fontSize: 13, flex: 1 },

    sectionLabel: { fontSize: 11, marginTop: 10, marginBottom: 4, marginLeft: 2, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '700' },

    planCard: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 10, position: 'relative' },
    planRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    planIconWrap: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    planTitle: { fontSize: 14, fontWeight: '700' },
    planSub: { fontSize: 11, marginTop: 1 },
    planDesc: { fontSize: 11, marginTop: 2 },
    planPrice: { fontSize: 16, fontWeight: '800' },
    radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
    bestBadge: {
        position: 'absolute', top: -6, right: 8, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
        flexDirection: 'row', alignItems: 'center', gap: 2,
    },
    bestBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },

    continueBtn: {
        marginTop: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 12,
        alignItems: 'center', justifyContent: 'center', minHeight: 44,
    },
    continueText: { fontSize: 14, fontWeight: '800' },
    upiHint: { fontSize: 11, textAlign: 'center', marginTop: 6 },
});
