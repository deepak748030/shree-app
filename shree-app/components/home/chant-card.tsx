import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProgressBar from './progress-bar';

interface ChantCardProps {
    title: string;
    subtitle?: string;
    target: number;
    current: number;
    todayJapa: number;
    lifetimeJapa: number;
    targetLabel: string;
    todayLabel: string;
    lifetimeLabel: string;
    onPress?: () => void;
}

export default function ChantCard({
    title, subtitle, target, current,
    todayJapa, lifetimeJapa,
    targetLabel, todayLabel, lifetimeLabel,
    onPress,
}: ChantCardProps) {
    const { theme } = useAppTheme();
    const progress = target > 0 ? current / target : 0;
    const pct = Math.round(progress * 100);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={onPress}
            style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}
        >
            <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
                    <Ionicons name="sparkles" size={18} color={theme.accent} />
                </View>
                <View style={styles.titleCol}>
                    <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
                    {!!subtitle && <Text style={[styles.subtitle, { color: theme.subText }]} numberOfLines={1}>{subtitle}</Text>}
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.accent} />
            </View>

            <View style={styles.targetRow}>
                <Text style={[styles.target, { color: theme.subText }]}>{targetLabel}: {target}</Text>
                <Text style={[styles.pct, { color: theme.accent }]}>{pct}%</Text>
            </View>

            <View style={{ marginTop: 4 }}>
                <ProgressBar progress={progress} color={theme.accent} trackColor={theme.mutedBg} />
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statBox, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.statValue, { color: theme.text }]}>{todayJapa}</Text>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>{todayLabel}</Text>
                </View>
                <View style={[styles.statBox, { borderColor: theme.cardBorder }]}>
                    <Text style={[styles.statValue, { color: theme.text }]}>{lifetimeJapa}</Text>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>{lifetimeLabel}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: { borderRadius: 12, borderWidth: 1, padding: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    iconWrap: {
        width: 34, height: 34, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginRight: 6,
    },
    titleCol: { flex: 1 },
    title: { fontSize: 14, fontWeight: '700' },
    subtitle: { fontSize: 11 },
    targetRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    target: { fontSize: 12 },
    pct: { fontSize: 12, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
    statBox: {
        flex: 1, borderWidth: 1, borderRadius: 8,
        paddingVertical: 6, alignItems: 'center',
    },
    statValue: { fontSize: 16, fontWeight: '700' },
    statLabel: { fontSize: 11 },
});
