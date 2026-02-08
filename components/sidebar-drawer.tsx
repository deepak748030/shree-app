import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DRAWER_WIDTH = SCREEN_WIDTH * 0.78;
const TEXT_DARK = '#333333';

interface DrawerMenuItem {
    icon: React.ReactNode;
    labelKey: string;
    route: string;
}

const menuItems: DrawerMenuItem[] = [
    { icon: <Ionicons name="home" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_home', route: '/' },
    { icon: <MaterialCommunityIcons name="counter" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_naam_jap', route: '/naam-jap-counter' },
    { icon: <Ionicons name="chatbubble-ellipses-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_daily_quote', route: '/daily-quote' },
    { icon: <Ionicons name="color-palette-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_theme', route: '/theme-settings' },
    { icon: <Ionicons name="language-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_language', route: '/language-settings' },
    { icon: <Ionicons name="share-social-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_share', route: '/share-app' },
    { icon: <Ionicons name="shield-checkmark-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_privacy', route: '/privacy-policy' },
    { icon: <Ionicons name="document-text-outline" size={22} color={TEXT_DARK} />, labelKey: 'sidebar_terms', route: '/terms-conditions' },
];

interface SidebarDrawerProps {
    visible: boolean;
    onClose: () => void;
}

export default function SidebarDrawer({ visible, onClose }: SidebarDrawerProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { theme } = useAppTheme();
    const { t } = useLanguage();
    const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
    const overlayAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(slideAnim, { toValue: -DRAWER_WIDTH, duration: 250, useNativeDriver: true }),
                Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    const [shouldRender, setShouldRender] = React.useState(false);

    useEffect(() => {
        if (visible) setShouldRender(true);
    }, [visible]);

    useEffect(() => {
        if (!visible && !shouldRender) return;
        if (!visible) {
            const timer = setTimeout(() => setShouldRender(false), 300);
            return () => clearTimeout(timer);
        }
    }, [visible, shouldRender]);

    if (!shouldRender) return null;

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <Animated.View style={[styles.overlay, { opacity: overlayAnim }]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
            </Animated.View>

            <Animated.View
                style={[
                    styles.drawer,
                    { paddingTop: insets.top, backgroundColor: theme.headerBg, transform: [{ translateX: slideAnim }] },
                ]}
            >
                <View style={styles.drawerHeader}>
                    <Image
                        source={require('@/assets/images/slider-2.png')}
                        style={styles.drawerHeaderImage}
                        contentFit="cover"
                    />
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.menuScroll}
                    contentContainerStyle={styles.menuContent}
                    showsVerticalScrollIndicator={false}
                >
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={styles.menuItem}
                            onPress={() => {
                                onClose();
                                router.push(item.route as any);
                            }}
                            activeOpacity={0.6}
                        >
                            <View style={styles.menuIconContainer}>{item.icon}</View>
                            <Text style={styles.menuLabel}>{t(item.labelKey as any)}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    drawer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        width: DRAWER_WIDTH,
    },
    drawerHeader: {
        width: '100%',
        height: 200,
        position: 'relative',
    },
    drawerHeaderImage: {
        width: '100%',
        height: '100%',
    },
    closeButton: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuScroll: {
        flex: 1,
    },
    menuContent: {
        paddingVertical: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 6,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
    },
    menuIconContainer: {
        width: 32,
        alignItems: 'center',
    },
    menuLabel: {
        fontSize: 15,
        color: TEXT_DARK,
        marginLeft: 12,
        flex: 1,
        fontWeight: '500',
    },
});
