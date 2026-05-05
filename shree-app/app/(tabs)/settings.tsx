import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme, THEME_OPTIONS } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Row =
    | { type: 'header'; key: string; titleKey: string }
    | { type: 'profile' }
    | { type: 'nav'; key: string; titleKey: string; descKey?: string; valueKey?: string; icon: keyof typeof Ionicons.glyphMap; route?: string; action?: 'logout' };

export default function SettingsScreen() {
    const { theme, themeId } = useAppTheme();
    const { t, language } = useLanguage();
    const { user, isLoggedIn, logout } = useAuth();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const isDark = theme.id === 'dark';

    const textPrimary = isDark ? '#F5F5F5' : '#1A1A1A';
    const textMuted = isDark ? '#9A9A9A' : '#777777';
    const cardBg = isDark ? '#1A1A1A' : '#FFFFFF';
    const sectionLabel = theme.accent;

    const [logoutSheet, setLogoutSheet] = useState(false);

    const themeName = THEME_OPTIONS.find((tm) => tm.id === themeId)?.id || 'dark';
    const themeLabel = themeName.charAt(0).toUpperCase() + themeName.slice(1);

    const rows: Row[] = [
        { type: 'profile' },
        { type: 'header', key: 'h2', titleKey: 'settings_appearance' },
        { type: 'nav', key: 'lang', titleKey: 'settings_language', valueKey: language === 'hi' ? 'हिंदी' : 'English', icon: 'globe-outline', route: '/language-settings' },
        { type: 'header', key: 'h3', titleKey: 'settings_customize' },
        { type: 'nav', key: 'theme', titleKey: 'settings_theme', valueKey: themeLabel, icon: 'color-palette-outline', route: '/theme-settings' },
        { type: 'header', key: 'h5', titleKey: 'settings_about' },
        { type: 'nav', key: 'wallet', titleKey: 'settings_wallet', icon: 'wallet-outline', route: '/wallet' },
        { type: 'nav', key: 'membership', titleKey: 'settings_membership', icon: 'star-outline', route: '/membership' },
        { type: 'nav', key: 'donation', titleKey: 'settings_donation', icon: 'heart-outline', route: '/donation' },
        { type: 'nav', key: 'share', titleKey: 'settings_share_app', icon: 'share-social-outline', route: '/share-app' },
        { type: 'nav', key: 'about', titleKey: 'settings_about_us', icon: 'information-circle-outline', route: '/shree-info' },
        { type: 'nav', key: 'privacy', titleKey: 'settings_privacy', icon: 'shield-checkmark-outline', route: '/privacy-policy' },
        { type: 'nav', key: 'terms', titleKey: 'settings_terms', icon: 'document-text-outline', route: '/terms-conditions' },
        ...(isLoggedIn ? [{ type: 'nav' as const, key: 'logout', titleKey: 'settings_logout', icon: 'log-out-outline' as const, action: 'logout' as const }] : []),
    ];

    const handleNav = (item: Row) => {
        if (item.type !== 'nav') return;
        if (item.action === 'logout') {
            setLogoutSheet(true);
            return;
        }
        if (item.route) router.push(item.route as any);
    };

    const handleLogout = async () => {
        await logout();
        setLogoutSheet(false);
    };

    const renderItem = ({ item }: { item: Row }) => {
        if (item.type === 'header') {
            return (
                <Text style={[styles.sectionLabel, { color: sectionLabel }]}>
                    {t(item.titleKey as any)}
                </Text>
            );
        }
        if (item.type === 'profile') {
            const initial = (user?.name?.[0] || 'G').toUpperCase();
            const hasImage = !!user?.profileImage;
            return (
                <TouchableOpacity
                    style={[styles.profileCard, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}
                    activeOpacity={0.8}
                    onPress={() => {
                        if (!isLoggedIn) router.push('/' as any);
                        else router.push('/profile-edit' as any);
                    }}
                >
                    <View style={[styles.avatar, { borderColor: theme.accent, backgroundColor: theme.accent + '22' }]}>
                        {hasImage ? (
                            <Image source={{ uri: user!.profileImage! }} style={styles.avatarImage} contentFit="cover" />
                        ) : (
                            <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
                        )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.profileName, { color: textPrimary }]} numberOfLines={1}>
                            {user?.name || t('home_guest_user' as any)}
                        </Text>
                        <Text style={[styles.profileSub, { color: textMuted }]} numberOfLines={1}>
                            {isLoggedIn && user?.mobile ? user.mobile : t('settings_login_to_access' as any)}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={textMuted} />
                </TouchableOpacity>
            );
        }
        // nav
        const isLogout = item.action === 'logout';
        return (
            <TouchableOpacity
                style={[styles.row, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}
                activeOpacity={0.7}
                onPress={() => handleNav(item)}
            >
                <View style={[styles.iconBox, { backgroundColor: (isLogout ? '#D32F2F' : theme.accent) + '22' }]}>
                    <Ionicons name={item.icon} size={18} color={isLogout ? '#D32F2F' : theme.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.rowTitle, { color: isLogout ? '#D32F2F' : textPrimary }]}>
                        {t(item.titleKey as any)}
                    </Text>
                    {item.valueKey ? (
                        <Text style={[styles.rowDesc, { color: textMuted }]} numberOfLines={1}>
                            {item.valueKey}
                        </Text>
                    ) : null}
                </View>
                {!isLogout ? <Ionicons name="chevron-forward" size={18} color={textMuted} /> : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { borderBottomColor: theme.cardBorder }]}>
                <Text style={[styles.headerTitle, { color: textPrimary }]}>{t('Settings' as any)}</Text>
            </View>

            <FlatList
                data={rows}
                keyExtractor={(item, i) => `r-${i}-${(item as any).key || item.type}`}
                renderItem={renderItem}
                contentContainerStyle={{ padding: 6, paddingBottom: 24 }}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                showsVerticalScrollIndicator={false}
            />

            <BottomSheetMessage
                visible={logoutSheet}
                onClose={() => setLogoutSheet(false)}
                type="confirm"
                title={t('logout_confirm_title' as any)}
                message={t('logout_confirm_msg' as any)}
                confirmLabel={t('settings_logout' as any)}
                onConfirm={handleLogout}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 22, fontWeight: '800', letterSpacing: 0.5 },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.2,
        marginTop: 6,
        marginBottom: 2,
        paddingHorizontal: 6,
    },
    profileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    profileName: { fontSize: 16, fontWeight: '700' },
    profileSub: { fontSize: 12, marginTop: 2 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
    iconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowTitle: { fontSize: 14, fontWeight: '600' },
    rowDesc: { fontSize: 11, marginTop: 2 },
})
