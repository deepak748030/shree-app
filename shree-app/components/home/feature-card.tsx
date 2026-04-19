import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface FeatureCardProps {
    iconName: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress?: () => void;
}

export default function FeatureCard({ iconName, title, subtitle, onPress }: FeatureCardProps) {
    const { theme } = useAppTheme();
    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[styles.card, { backgroundColor: theme.bgCream, borderColor: theme.cardBorder }]}
        >
            <View style={[styles.iconWrap, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
                <Ionicons name={iconName} size={20} color={theme.accent} />
            </View>
            <View style={styles.textCol}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.accent} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
    },
    iconWrap: {
        width: 38, height: 38, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginRight: 6,
    },
    textCol: { flex: 1 },
    title: { fontSize: 14, fontWeight: '700', color: '#222' },
    subtitle: { fontSize: 12, color: '#666', marginTop: 2 },
});
