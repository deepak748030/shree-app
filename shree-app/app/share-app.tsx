import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';

export default function ShareAppScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const [sharing, setSharing] = useState(false);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [sheetConfig, setSheetConfig] = useState({
        type: 'success' as 'success' | 'error',
        title: '',
        message: '',
    });

    const showSheet = (type: 'success' | 'error', title: string, message: string) => {
        setSheetConfig({ type, title, message });
        setSheetVisible(true);
    };

    const handleShare = async () => {
        setSharing(true);
        try {
            await Share.share({ message: t('share_message'), title: t('app_name') });
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

    const onPrimary = theme.isDark ? '#000' : '#FFFFFF';

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

            <View style={styles.content}>
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
            </View>

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
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
    logo: { width: 120, height: 120, marginBottom: 6 },
    appName: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
    tagline: { fontSize: 16, marginBottom: 16 },
    description: { fontSize: 14, opacity: 0.9, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20, marginBottom: 24 },
    shareButton: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32,
        marginBottom: 6, gap: 8,
    },
    shareButtonText: { fontSize: 16, fontWeight: 'bold' },
    copyButton: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, borderWidth: 1,
        paddingVertical: 10, paddingHorizontal: 24, gap: 8,
    },
    copyButtonText: { fontSize: 15, fontWeight: '600' },
});
