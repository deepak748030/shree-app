import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HP = 6;
type PlanId = 'monthly' | 'yearly' | 'lifetime';

interface Plan {
    id: PlanId;
    titleKey: string;
    price: string;
    periodKey: string;
    isLifetime?: boolean;
    bestValue?: boolean;
    subKey?: string;
}

const PLANS: Plan[] = [
    { id: 'monthly', titleKey: 'membership_monthly', price: '₹49', periodKey: 'membership_per_month' },
    { id: 'yearly', titleKey: 'membership_yearly', price: '₹499', periodKey: 'membership_per_year', bestValue: true },
    { id: 'lifetime', titleKey: 'membership_lifetime', price: '₹999', periodKey: 'membership_lifetime_period', isLifetime: true, subKey: 'membership_lifetime_sub' },
];

export default function MembershipScreen() {
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [selected, setSelected] = useState<PlanId>('lifetime');
    const [loading, setLoading] = useState(false);
    const [sheet, setSheet] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
        visible: false, type: 'success', title: '', message: '',
    });

    const selectedPlan = PLANS.find((p) => p.id === selected)!;

    const handleContinue = async () => {
        setLoading(true);
        try {
            await new Promise((r) => setTimeout(r, 900));
            setSheet({
                visible: true,
                type: 'success',
                title: t('membership_coming_soon_title' as any),
                message: t('membership_coming_soon_msg' as any),
            });
        } catch {
            setSheet({
                visible: true,
                type: 'error',
                title: t('error' as any),
                message: t('membership_error_msg' as any),
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            {/* Header */}
            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.headerText }]}>{t('membership_header' as any)}</Text>
                <View style={{ width: 28 }} />
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero card */}
                <View style={[styles.heroCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <View style={[styles.heroIconWrap, { backgroundColor: theme.mutedBg, borderColor: theme.accent }]}>
                        <Ionicons name="ribbon" size={30} color={theme.accent} />
                    </View>
                    <Text style={[styles.heroTitle, { color: theme.text }]}>{t('membership_hero_title' as any)}</Text>
                    <Text style={[styles.heroSubtitle, { color: theme.subText }]}>{t('membership_hero_subtitle' as any)}</Text>
                </View>

                {/* Plan cards row */}
                <View style={styles.planRow}>
                    {PLANS.filter((p) => !p.isLifetime).map((plan) => {
                        const isSel = selected === plan.id;
                        return (
                            <Pressable
                                key={plan.id}
                                onPress={() => setSelected(plan.id)}
                                style={[
                                    styles.planCard,
                                    {
                                        backgroundColor: theme.cardBg,
                                        borderColor: isSel ? theme.accent : theme.cardBorder,
                                        borderWidth: isSel ? 2 : 1,
                                    },
                                ]}
                            >
                                {plan.bestValue && (
                                    <View style={[styles.bestBadge, { backgroundColor: theme.accent }]}>
                                        <Text style={[styles.bestBadgeText, { color: theme.isDark ? '#000' : '#fff' }]}>{t('membership_best_value' as any)}</Text>
                                    </View>
                                )}
                                <Text style={[styles.planLabel, { color: theme.subText }]}>{t(plan.titleKey as any)}</Text>
                                <Text style={[styles.planPrice, { color: theme.text }]}>{plan.price}</Text>
                                <Text style={[styles.planPeriod, { color: theme.subText }]}>{t(plan.periodKey as any)}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                {/* Lifetime card full width */}
                {PLANS.filter((p) => p.isLifetime).map((plan) => {
                    const isSel = selected === plan.id;
                    return (
                        <Pressable
                            key={plan.id}
                            onPress={() => setSelected(plan.id)}
                            style={[
                                styles.lifetimeCard,
                                {
                                    backgroundColor: theme.cardBg,
                                    borderColor: isSel ? theme.accent : theme.cardBorder,
                                    borderWidth: isSel ? 2 : 1,
                                },
                            ]}
                        >
                            <View style={[styles.lifetimeIconWrap, { borderColor: theme.accent, backgroundColor: theme.mutedBg }]}>
                                <Ionicons name="infinite" size={22} color={theme.accent} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.lifetimeTitle, { color: theme.text }]}>{t(plan.titleKey as any)}</Text>
                                {plan.subKey && (
                                    <Text style={[styles.lifetimeSub, { color: theme.subText }]}>{t(plan.subKey as any)}</Text>
                                )}
                            </View>
                            <Text style={[styles.lifetimePrice, { color: theme.accent }]}>{plan.price}</Text>
                        </Pressable>
                    );
                })}

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
                                <Ionicons name="checkmark" size={14} color="#22A06B" />
                            </View>
                            <Text style={[styles.benefitText, { color: theme.text }]}>{t(key as any)}</Text>
                        </View>
                    ))}
                </View>

                {/* Continue */}
                <TouchableOpacity
                    onPress={handleContinue}
                    disabled={loading}
                    activeOpacity={0.8}
                    style={[styles.continueBtn, { backgroundColor: theme.accent, borderColor: theme.accent }]}
                >
                    {loading ? (
                        <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
                    ) : (
                        <Text style={[styles.continueText, { color: theme.isDark ? '#000' : '#fff' }]}>
                            {t('membership_continue' as any)}  •  {selectedPlan.price}
                        </Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.restoreBtn} hitSlop={6}>
                    <Text style={[styles.restoreText, { color: theme.subText }]}>
                        {t('membership_already_member' as any)}{' '}
                        <Text style={{ color: theme.accent, fontWeight: '700' }}>
                            {t('membership_restore' as any)}
                        </Text>
                    </Text>
                </TouchableOpacity>
            </ScrollView>

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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: HP,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    backBtn: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: { fontSize: 16, fontWeight: '700' },

    scrollContent: { paddingHorizontal: HP, paddingTop: 6, paddingBottom: 20 },

    heroCard: {
        borderRadius: 14,
        borderWidth: 1,
        paddingVertical: 16,
        paddingHorizontal: 12,
        alignItems: 'center',
    },
    heroIconWrap: {
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
        marginBottom: 8,
    },
    heroTitle: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    heroSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'center' },

    planRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    planCard: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 10,
        position: 'relative',
        minHeight: 88,
    },
    bestBadge: {
        position: 'absolute',
        top: -8,
        alignSelf: 'center',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    bestBadgeText: { fontSize: 10, fontWeight: '700' },
    planLabel: { fontSize: 12, marginTop: 4 },
    planPrice: { fontSize: 18, fontWeight: '800', marginTop: 4 },
    planPeriod: { fontSize: 11, marginTop: 2 },

    lifetimeCard: {
        marginTop: 6,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lifetimeIconWrap: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
    },
    lifetimeTitle: { fontSize: 14, fontWeight: '700' },
    lifetimeSub: { fontSize: 11, marginTop: 1 },
    lifetimePrice: { fontSize: 16, fontWeight: '800' },

    benefitsCard: {
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
    },
    checkWrap: {
        width: 22, height: 22, borderRadius: 11,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginRight: 8,
    },
    benefitText: { fontSize: 13, flex: 1 },

    continueBtn: {
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
    },
    continueText: { fontSize: 14, fontWeight: '800' },

    restoreBtn: { marginTop: 6, alignItems: 'center', paddingVertical: 6 },
    restoreText: { fontSize: 12 },
});
