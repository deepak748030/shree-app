import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { useDeviceId } from '@/hooks/use-device-id';
import {
    applyReferralCode,
    fetchMyReferralCode,
    fetchReferralSettings,
    type MyReferralCode,
    type ReferralSettingsPublic,
} from '@/services/api';

export default function ShareAppScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { t, language } = useLanguage();
    const deviceId = useDeviceId();
    const { user, mobile } = useAuth();
    const isDark = theme.id === 'dark';

    const screenBg = isDark ? '#0A0A0A' : theme.bgCream;
    const cardBg = isDark ? '#161616' : '#FFFFFF';
    const cardBorder = isDark ? '#222' : '#ECECEC';
    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const ACCENT = theme.accent;

    const [sharing, setSharing] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetConfig, setSheetConfig] = useState({
        type: 'success' as 'success' | 'error' | 'info',
        title: '',
        message: '',
    });

    const [settings, setSettings] = useState<ReferralSettingsPublic | null>(null);
    const [myCode, setMyCode] = useState<MyReferralCode | null>(null);
    const [codeInput, setCodeInput] = useState('');
    const [applying, setApplying] = useState(false);
    const [loadingRef, setLoadingRef] = useState(true);

    useEffect(() => {
        let alive = true;
        (async () => {
            const s = await fetchReferralSettings();
            if (alive) setSettings(s);
        })();
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        if (!deviceId) return;
        let alive = true;
        (async () => {
            setLoadingRef(true);
            const c = await fetchMyReferralCode(deviceId);
            if (alive) {
                setMyCode(c);
                setLoadingRef(false);
            }
        })();
        return () => { alive = false; };
    }, [deviceId]);

    const showSheet = (type: 'success' | 'error' | 'info', title: string, message: string) => {
        setSheetConfig({ type, title, message });
        setSheetVisible(true);
    };

    const buildShareMessage = () => {
        const code = myCode?.referralCode;
        if (code && settings?.isEnabled) {
            return t('referral_share_with_code').replace('{code}', code);
        }
        return t('share_message');
    };

    const handleShare = async () => {
        setSharing(true);
        try {
            await Share.share({ message: buildShareMessage(), title: t('app_name') });
        } catch {
            showSheet('error', t('share_failed_title'), t('share_failed_msg'));
        } finally {
            setSharing(false);
        }
    };

    const handleCopyLink = async () => {
        try {
            await Clipboard.setStringAsync('https://play.google.com/store/apps/details?id=com.shreejii.app');
            showSheet('success', t('share_link_copied'), t('share_link_copied_msg'));
        } catch {
            showSheet('error', t('share_copy_failed_title'), t('share_copy_failed_msg'));
        }
    };

    const handleCopyCode = async () => {
        if (!myCode?.referralCode) return;
        try {
            await Clipboard.setStringAsync(myCode.referralCode);
            showSheet('success', t('referral_copied'), myCode.referralCode);
        } catch {
            showSheet('error', t('share_copy_failed_title'), t('share_copy_failed_msg'));
        }
    };

    const handleApplyCode = async () => {
        const code = codeInput.trim().toUpperCase();
        if (!code || code.length < 4) {
            showSheet('error', t('referral_invalid_input'), t('referral_invalid_input'));
            return;
        }
        if (!deviceId) return;
        setApplying(true);
        try {
            const res = await applyReferralCode(deviceId, code, mobile || undefined, user?.name || undefined);
            if (res.success) {
                showSheet('success', t('referral_success'), res.message || t('referral_success'));
                setCodeInput('');
                const updated = await fetchMyReferralCode(deviceId);
                setMyCode(updated);
            } else {
                showSheet('error', t('referral_invalid_input'), res.message || res.reason || t('referral_invalid_input'));
            }
        } finally {
            setApplying(false);
        }
    };

    const refTitle = language === 'hi' ? settings?.title_hi : settings?.title_en;
    const refDescription = language === 'hi' ? settings?.description_hi : settings?.description_en;
    const refHowItWorks = language === 'hi' ? settings?.howItWorks_hi : settings?.howItWorks_en;

    const usageCount = myCode?.usageCount || 0;
    const totalEarned = myCode?.totalEarned || 0;

    const heroColors = (isDark
        ? ['#2A1F08', '#0F0A02']
        : [ACCENT + '33', ACCENT + '0D']) as readonly [string, string];

    return (
        <View style={[styles.container, { backgroundColor: screenBg }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={screenBg} translucent={false} />

            {/* Header */}
            <View style={[styles.headerWrap, { paddingTop: insets.top + 6, backgroundColor: screenBg }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} hitSlop={10}>
                    <Ionicons name="arrow-back" size={22} color={textPrimary} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('share_header')}</Text>
                <View style={{ width: 36 }} />
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Hero */}
                    <LinearGradient
                        colors={heroColors}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[styles.hero, { borderColor: ACCENT + '33' }]}
                    >
                        <View style={[styles.logoRing, { borderColor: ACCENT + '55', backgroundColor: cardBg }]}>
                            <Image source={require('@/assets/images/shree-ji-logo.png')} style={styles.logo} contentFit="contain" />
                        </View>
                        <Text style={[styles.appName, { color: ACCENT }]}>{t('app_name')}</Text>
                        <Text style={[styles.tagline, { color: textMuted }]}>{t('share_tagline')}</Text>
                        <Text style={[styles.description, { color: textPrimary }]}>{t('share_description')}</Text>

                        <View style={styles.heroBtnRow}>
                            <TouchableOpacity
                                style={[styles.shareBtn, { backgroundColor: ACCENT }]}
                                onPress={handleShare}
                                activeOpacity={0.85}
                                disabled={sharing}
                            >
                                {sharing ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="share-social" size={18} color="#FFF" />
                                        <Text style={styles.shareBtnText}>{t('share_button')}</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.copyBtn, { borderColor: ACCENT + '66', backgroundColor: cardBg }]}
                                onPress={handleCopyLink}
                                activeOpacity={0.85}
                            >
                                <MaterialCommunityIcons name="link-variant" size={18} color={ACCENT} />
                                <Text style={[styles.copyBtnText, { color: ACCENT }]}>{t('share_copy_link')}</Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>

                    {/* Referral block */}
                    {settings?.isEnabled && (
                        <View style={[styles.refBlock, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                            <View style={styles.refHeaderRow}>
                                <View style={[styles.refIconBox, { backgroundColor: ACCENT + '22' }]}>
                                    <Ionicons name="gift" size={18} color={ACCENT} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    {!!refTitle && (
                                        <Text style={[styles.refTitle, { color: textPrimary }]}>{refTitle}</Text>
                                    )}
                                    {!!refDescription && (
                                        <Text style={[styles.refDesc, { color: textMuted }]}>{refDescription}</Text>
                                    )}
                                </View>
                            </View>

                            {loadingRef ? (
                                <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
                            ) : (
                                <>
                                    {/* Stats row */}
                                    <View style={styles.statsRow}>
                                        <View style={[styles.statCard, { backgroundColor: isDark ? '#1E1E1E' : '#F7F7F7', borderColor: cardBorder }]}>
                                            <Ionicons name="people" size={16} color={ACCENT} />
                                            <Text style={[styles.statValue, { color: textPrimary }]}>{usageCount}</Text>
                                            <Text style={[styles.statLabel, { color: textMuted }]}>
                                                {language === 'hi' ? 'दोस्त' : 'Friends'}
                                            </Text>
                                        </View>
                                        <View style={[styles.statCard, { backgroundColor: isDark ? '#1E1E1E' : '#F7F7F7', borderColor: cardBorder }]}>
                                            <Ionicons name="cash" size={16} color="#22C55E" />
                                            <Text style={[styles.statValue, { color: textPrimary }]}>₹{totalEarned}</Text>
                                            <Text style={[styles.statLabel, { color: textMuted }]}>
                                                {language === 'hi' ? 'कमाया' : 'Earned'}
                                            </Text>
                                        </View>
                                    </View>

                                    <Text style={[styles.refLabel, { color: textMuted }]}>{t('referral_your_code')}</Text>
                                    <TouchableOpacity
                                        onPress={handleCopyCode}
                                        activeOpacity={0.7}
                                        style={[styles.codeBox, { borderColor: ACCENT, backgroundColor: ACCENT + '11' }]}
                                    >
                                        <Text style={[styles.codeText, { color: ACCENT }]}>
                                            {myCode?.referralCode || '—'}
                                        </Text>
                                        <View style={[styles.copyChip, { backgroundColor: ACCENT }]}>
                                            <MaterialCommunityIcons name="content-copy" size={14} color="#FFF" />
                                            <Text style={styles.copyChipText}>{t('referral_copy')}</Text>
                                        </View>
                                    </TouchableOpacity>

                                    {!!refHowItWorks && (
                                        <View style={[styles.howBox, { backgroundColor: isDark ? '#1A1A1A' : '#FAFAFA', borderColor: cardBorder }]}>
                                            <View style={styles.howHeaderRow}>
                                                <Ionicons name="information-circle" size={16} color={ACCENT} />
                                                <Text style={[styles.refHowTitle, { color: textPrimary }]}>{t('referral_how_it_works')}</Text>
                                            </View>
                                            <Text style={[styles.refHow, { color: textMuted }]}>{refHowItWorks}</Text>
                                        </View>
                                    )}

                                    {/* Apply input */}
                                    {!myCode?.hasAppliedCode ? (
                                        <View style={{ marginTop: 14 }}>
                                            <Text style={[styles.refLabel, { color: textMuted }]}>{t('referral_have_code')}</Text>
                                            <View style={styles.inputRow}>
                                                <TextInput
                                                    value={codeInput}
                                                    onChangeText={(v) => setCodeInput(v.toUpperCase())}
                                                    placeholder={t('referral_enter_code')}
                                                    placeholderTextColor={textMuted}
                                                    autoCapitalize="characters"
                                                    style={[styles.input, { borderColor: cardBorder, color: textPrimary, backgroundColor: isDark ? '#1E1E1E' : '#F7F7F7' }]}
                                                />
                                                <TouchableOpacity
                                                    onPress={handleApplyCode}
                                                    disabled={applying || !codeInput.trim()}
                                                    activeOpacity={0.85}
                                                    style={[styles.applyBtn, { backgroundColor: ACCENT, opacity: applying || !codeInput.trim() ? 0.5 : 1 }]}
                                                >
                                                    {applying ? (
                                                        <ActivityIndicator size="small" color="#FFF" />
                                                    ) : (
                                                        <Text style={styles.applyText}>{t('referral_apply')}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={[styles.appliedBox, { backgroundColor: '#22C55E22', borderColor: '#22C55E55' }]}>
                                            <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                                            <Text style={[styles.appliedText, { color: '#22C55E' }]}>
                                                {t('referral_already_applied')}
                                                {myCode?.appliedCode ? ` (${myCode.appliedCode})` : ''}
                                            </Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            <BottomSheetMessage
                visible={sheetVisible}
                onClose={() => setSheetVisible(false)}
                type={sheetConfig.type}
                title={sheetConfig.title}
                message={sheetConfig.message}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    headerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingBottom: 10,
    },
    iconBtn: { padding: 6 },
    headerTitle: { fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
    content: { padding: 14, paddingBottom: 32 },

    hero: {
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 18,
        paddingBottom: 16,
    },
    logoRing: {
        width: 96, height: 96, borderRadius: 48,
        borderWidth: 2, alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
    },
    logo: { width: 80, height: 80 },
    appName: { fontSize: 22, fontWeight: '900', letterSpacing: 0.5 },
    tagline: { fontSize: 13, marginTop: 2, fontWeight: '600' },
    description: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 10, paddingHorizontal: 6 },

    heroBtnRow: { flexDirection: 'row', gap: 10, marginTop: 16, width: '100%' },
    shareBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, borderRadius: 12, paddingVertical: 12,
    },
    shareBtnText: { color: '#FFF', fontWeight: '800', fontSize: 14 },
    copyBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, borderRadius: 12, paddingVertical: 12, borderWidth: 1.5,
    },
    copyBtnText: { fontWeight: '800', fontSize: 14 },

    refBlock: {
        marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 14,
    },
    refHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
    refIconBox: {
        width: 36, height: 36, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center',
    },
    refTitle: { fontSize: 16, fontWeight: '800' },
    refDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },

    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    statCard: {
        flex: 1, borderRadius: 12, borderWidth: 1,
        paddingVertical: 12, alignItems: 'center', gap: 4,
    },
    statValue: { fontSize: 18, fontWeight: '900' },
    statLabel: { fontSize: 11, fontWeight: '600' },

    refLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
    codeBox: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 14,
    },
    codeText: { fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },
    copyChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    },
    copyChipText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

    howBox: { marginTop: 14, borderWidth: 1, borderRadius: 12, padding: 12 },
    howHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    refHowTitle: { fontSize: 13, fontWeight: '800' },
    refHow: { fontSize: 12, lineHeight: 18 },

    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
        flex: 1, borderWidth: 1, borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 12, fontSize: 14, fontWeight: '600',
    },
    applyBtn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
    applyText: { fontWeight: '800', fontSize: 14, color: '#FFF' },

    appliedBox: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginTop: 14, borderRadius: 10, borderWidth: 1, padding: 10,
    },
    appliedText: { fontSize: 12, fontWeight: '700', flex: 1 },
});
