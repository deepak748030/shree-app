import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface GreetingBarProps {
    greeting: string;
    name: string;
    showNoAds?: boolean;
    noAdsLabel?: string;
    onMenuPress?: () => void;
    onNoAdsPress?: () => void;
}

export default function GreetingBar({ greeting, name, showNoAds, noAdsLabel, onMenuPress, onNoAdsPress }: GreetingBarProps) {
    const { theme } = useAppTheme();
    const initial = (name || '?').charAt(0).toUpperCase();

    return (
        <View style={styles.row}>
            <View style={styles.left}>
                {onMenuPress && (
                    <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} hitSlop={8}>
                        <Ionicons name="menu" size={26} color="#222" />
                    </TouchableOpacity>
                )}
                <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.textCol}>
                    <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                </View>
            </View>

            {showNoAds && (
                <TouchableOpacity
                    onPress={onNoAdsPress}
                    activeOpacity={0.8}
                    style={[styles.noAdsPill, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}
                >
                    <Ionicons name="star" size={14} color={theme.accent} />
                    <Text style={[styles.noAdsText, { color: theme.accent }]}>{noAdsLabel}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
    },
    left: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    menuBtn: { padding: 2, marginRight: 6 },
    avatar: {
        width: 42, height: 42, borderRadius: 21,
        alignItems: 'center', justifyContent: 'center', marginRight: 6,
    },
    avatarText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    textCol: { flex: 1 },
    greeting: { fontSize: 12, color: '#666' },
    name: { fontSize: 15, fontWeight: '700', color: '#222' },
    noAdsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    noAdsText: { fontSize: 12, fontWeight: '700' },
});
