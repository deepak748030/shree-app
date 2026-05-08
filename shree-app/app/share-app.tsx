import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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

    const [sharing, setSharing] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetConfig, setSheetConfig] = useState({
        type: 'success' as 'success' | 'error',
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

    const showSheet = (type: 'success' | 'error', title: string, message: string) => {
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

    const onPrimary = theme.isDark ? '#000' : '#FFFFFF';
    const refTitle = language === 'hi' ? settings?.title_hi : settings?.title_en;
    const refDescription = language === 'hi' ? settings?.description_hi : settings?.description_en;
    const refHowItWorks = language === 'hi' ? settings?.howItWorks_hi : settings?.howItWorks_en;

    const stats = t('referral_stats')
        .replace('{count}', String(myCode?.usageCount || 0))
        .replace('{earned}', String(myCode?.totalEarned || 0));

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={[styles.headerBg, { paddingTop: insets.top, backgroundColor: theme.headerBg }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={theme.headerText} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.headerText }]}>{t('share_header')}</Text>
                    <View style={{ width: 32 }} />
                </View>
            </View>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <Image source={require('@/assets/images/shree-ji-logo.png')} style={styles.logo} contentFit="contain" />
                    <Text style={[styles.appName, { color: theme.accent }]}>{t('app_name')}</Text>
                    <Text style={[styles.tagline, { color: theme.subText }]}>{t('share_tagline')}</Text>
                    <Text style={[styles.description, { color: theme.text }]}>{t('share_description')}</Text>

                    <TouchableOpacity
                        style={[styles.shareButton, { backgroundColor: theme.accent }]}
                        onPress={handleShare}
                        activeOpacity={0.7}
                        disabled={sharing}
                    >
                        {sharing ? (
                            <ActivityIndicator color={onPrimary} size="small" />
                        ) : (
                            <>
                                <Ionicons name="share-social" size={22} color={onPrimary} />
                                <Text style={[styles.shareButtonText, { color: onPrimary }]}>{t('share_button')}</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.copyButton, { borderColor: theme.cardBorder, backgroundColor: theme.cardBg }]}
                        onPress={handleCopyLink}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="content-copy" size={20} color={theme.text} />
                        <Text style={[styles.copyButtonText, { color: theme.text }]}>{t('share_copy_link')}</Text>
                    </TouchableOpacity>

                    {/* Referral block */}
                    {settings?.isEnabled && (
                        <View style={[styles.refBlock, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                            {!!refTitle && (
                                <Text style={[styles.refTitle, { color: theme.accent }]}>{refTitle}</Text>
                            )}
                            {!!refDescription && (
                                <Text style={[styles.refDesc, { color: theme.subText }]}>{refDescription}</Text>
                            )}

                            {loadingRef ? (
                                <ActivityIndicator color={theme.accent} style={{ marginVertical: 12 }} />
                            ) : (
                                <>
                                    <Text style={[styles.refLabel, { color: theme.subText }]}>{t('referral_your_code')}</Text>
                                    <TouchableOpacity
                                        onPress={handleCopyCode}
                                        activeOpacity={0.7}
                                        style={[styles.codeBox, { borderColor: theme.accent, backgroundColor: theme.bgCream }]}
                                    >
                                        <Text style={[styles.codeText, { color: theme.accent }]}>
                                            {myCode?.referralCode || '—'}
                                        </Text>
                                        <MaterialCommunityIcons name="content-copy" size={18} color={theme.accent} />
                                    </TouchableOpacity>

                                    <Text style={[styles.refStats, { color: theme.text }]}>{stats}</Text>

                                    {!!refHowItWorks && (
                                        <View style={{ marginTop: 12 }}>
                                            <Text style={[styles.refHowTitle, { color: theme.text }]}>{t('referral_how_it_works')}</Text>
                                            <Text style={[styles.refHow, { color: theme.subText }]}>{refHowItWorks}</Text>
                                        </View>
                                    )}

                                    {/* Apply input */}
                                    {!myCode?.hasAppliedCode ? (
                                        <View style={{ marginTop: 16, width: '100%' }}>
                                            <Text style={[styles.refLabel, { color: theme.subText }]}>{t('referral_have_code')}</Text>
                                            <View style={styles.inputRow}>
                                                <TextInput
                                                    value={codeInput}
                                                    onChangeText={(v) => setCodeInput(v.toUpperCase())}
                                                    placeholder={t('referral_enter_code')}
                                                    placeholderTextColor={theme.subText}
                                                    autoCapitalize="characters"
                                                    style={[styles.input, { borderColor: theme.cardBorder, color: theme.text, backgroundColor: theme.bgCream }]}
                                                />
                                                <TouchableOpacity
                                                    onPress={handleApplyCode}
                                                    disabled={applying || !codeInput.trim()}
                                                    style={[styles.applyBtn, { backgroundColor: theme.accent, opacity: applying || !codeInput.trim() ? 0.6 : 1 }]}
                                                >
                                                    {applying ? (
                                                        <ActivityIndicator size="small" color={onPrimary} />
                                                    ) : (
                                                        <Text style={[styles.applyText, { color: onPrimary }]}>{t('referral_apply')}</Text>
                                                    )}
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={[styles.appliedNote, { color: theme.subText }]}>
                                            {t('referral_already_applied')}
                                            {myCode?.appliedCode ? ` (${myCode.appliedCode})` : ''}
                                        </Text>
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
    headerBg: {},
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 10,
    },
    backButton: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    content: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 32, paddingTop: 12 },
    logo: { width: 110, height: 110, marginBottom: 6 },
    appName: { fontSize: 26, fontWeight: 'bold', marginBottom: 4 },
    tagline: { fontSize: 15, marginBottom: 12 },
    description: { fontSize: 14, opacity: 0.9, textAlign: 'center', lineHeight: 20, paddingHorizontal: 12, marginBottom: 18 },
    shareButton: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32,
        marginBottom: 8, gap: 8,
    },
    shareButtonText: { fontSize: 16, fontWeight: 'bold' },
    copyButton: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, borderWidth: 1,
        paddingVertical: 10, paddingHorizontal: 24, gap: 8,
    },
    copyButtonText: { fontSize: 15, fontWeight: '600' },

    refBlock: {
        marginTop: 22,
        width: '100%',
        borderRadius: 14,
        borderWidth: 1,
        padding: 16,
    },
    refTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
    refDesc: { fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 18 },
    refLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    codeBox: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10,
        paddingVertical: 14, paddingHorizontal: 16, gap: 10,
    },
    codeText: { fontSize: 22, fontWeight: '800', letterSpacing: 1.5 },
    refStats: { fontSize: 13, textAlign: 'center', marginTop: 10, fontWeight: '600' },
    refHowTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
    refHow: { fontSize: 12, lineHeight: 18 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
        flex: 1, borderWidth: 1, borderRadius: 10,
        paddingVertical: 10, paddingHorizontal: 12, fontSize: 14,
    },
    applyBtn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
    applyText: { fontWeight: '700', fontSize: 14 },
    appliedNote: { fontSize: 12, marginTop: 14, textAlign: 'center', fontStyle: 'italic' },
});
