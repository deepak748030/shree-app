import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme, THEME_OPTIONS } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BELL_KEY = '@bell_sound_enabled';
const REMINDER_KEY = '@daily_reminder_enabled';

type Row =
    | { type: 'header'; key: string; titleKey: string }
    | { type: 'profile' }
    | { type: 'toggle'; key: string; titleKey: string; descKey: string; icon: keyof typeof Ionicons.glyphMap; storageKey: string; defaultValue: boolean }
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

    const [bellSound, setBellSound] = useState(true);
    const [dailyReminder, setDailyReminder] = useState(false);
    const [logoutSheet, setLogoutSheet] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(BELL_KEY).then((v) => { if (v !== null) setBellSound(v === '1'); });
        AsyncStorage.getItem(REMINDER_KEY).then((v) => { if (v !== null) setDailyReminder(v === '1'); });
    }, []);

    const toggleBell = async (v: boolean) => {
        setBellSound(v);
        await AsyncStorage.setItem(BELL_KEY, v ? '1' : '0');
    };
    const toggleReminder = async (v: boolean) => {
        setDailyReminder(v);
        await AsyncStorage.setItem(REMINDER_KEY, v ? '1' : '0');
    };

    const themeName = THEME_OPTIONS.find((tm) => tm.id === themeId)?.id || 'dark';
    const themeLabel = themeName.charAt(0).toUpperCase() + themeName.slice(1);

    const rows: Row[] = [
        { type: 'profile' },
        { type: 'header', key: 'h1', titleKey: 'settings_preferences' },
        { type: 'toggle', key: 'bell', titleKey: 'settings_bell_sound', descKey: 'settings_bell_sound_desc', icon: 'notifications', storageKey: BELL_KEY, defaultValue: true },
        { type: 'header', key: 'h2', titleKey: 'settings_appearance' },
        { type: 'nav', key: 'lang', titleKey: 'settings_language', valueKey: language === 'hi' ? 'हिंदी' : 'English', icon: 'globe-outline', route: '/language-settings' },
        { type: 'header', key: 'h3', titleKey: 'settings_customize' },
        { type: 'nav', key: 'theme', titleKey: 'settings_theme', valueKey: themeLabel, icon: 'color-palette-outline', route: '/theme-settings' },
        { type: 'header', key: 'h4', titleKey: 'settings_daily_reminder_section' },
        { type: 'toggle', key: 'reminder', titleKey: 'settings_daily_reminder', descKey: 'settings_daily_reminder_desc', icon: 'alarm-outline', storageKey: REMINDER_KEY, defaultValue: false },
        { type: 'header', key: 'h5', titleKey: 'settings_about' },
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
            return (
                <TouchableOpacity
                    style={[styles.profileCard, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}
                    activeOpacity={0.8}
                    onPress={() => !isLoggedIn && router.push('/' as any)}
                >
                    <View style={[styles.avatar, { borderColor: theme.accent, backgroundColor: theme.accent + '22' }]}>
                        <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
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
        if (item.type === 'toggle') {
            const value = item.key === 'bell' ? bellSound : dailyReminder;
            const onChange = item.key === 'bell' ? toggleBell : toggleReminder;
            return (
                <View style={[styles.row, { backgroundColor: cardBg, borderColor: theme.cardBorder }]}>
                    <View style={[styles.iconBox, { backgroundColor: theme.accent + '22' }]}>
                        <Ionicons name={item.icon} size={18} color={theme.accent} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.rowTitle, { color: textPrimary }]}>{t(item.titleKey as any)}</Text>
                        <Text style={[styles.rowDesc, { color: textMuted }]} numberOfLines={2}>
                            {t(item.descKey as any)}
                        </Text>
                    </View>
                    <Switch
                        value={value}
                        onValueChange={onChange}
                        trackColor={{ false: '#444', true: theme.accent }}
                        thumbColor="#FFFFFF"
                    />
                </View>
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
    },
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