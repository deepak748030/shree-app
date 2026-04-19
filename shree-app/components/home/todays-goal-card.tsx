import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ProgressBar from './progress-bar';

interface TodaysGoalCardProps {
    title: string;
    mantraCount: number;
    mantrasLabel: string;
    editLabel: string;
    mantraName: string;
    current: number;
    target: number;
    onEdit?: () => void;
}

export default function TodaysGoalCard({
    title, mantraCount, mantrasLabel, editLabel,
    mantraName, current, target, onEdit,
}: TodaysGoalCardProps) {
    const { theme } = useAppTheme();
    const progress = target > 0 ? current / target : 0;
    const pct = Math.round(progress * 100);

    return (
        <View style={[styles.card, { backgroundColor: theme.bgCream, borderColor: theme.cardBorder }]}>
            <View style={styles.headerRow}>
                <View style={[styles.iconWrap, { backgroundColor: theme.headerBg, borderColor: theme.cardBorder }]}>
                    <Ionicons name="locate" size={18} color={theme.accent} />
                </View>
                <View style={styles.titleCol}>
                    <Text style={[styles.title, { color: theme.accent }]}>{title}</Text>
                    <Text style={styles.subtitle}>{mantraCount} {mantrasLabel}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.editBtn, { borderColor: theme.cardBorder, backgroundColor: theme.headerBg }]}
                    onPress={onEdit}
                    hitSlop={6}
                >
                    <Text style={[styles.editText, { color: theme.accent }]}>{editLabel}</Text>
                    <Ionicons name="settings-outline" size={14} color={theme.accent} />
                </TouchableOpacity>
            </View>

            <View style={styles.bottomRow}>
                <Text style={styles.mantraName} numberOfLines={1}>{mantraName}</Text>
                <Text style={[styles.countText, { color: theme.accent }]}>
                    {current} / {target} • {pct}%
                </Text>
            </View>

            <View style={{ marginTop: 6 }}>
                <ProgressBar progress={progress} color={theme.accent} trackColor={theme.cardBorder + '55'} />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        borderWidth: 1,
        padding: 10,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    iconWrap: {
        width: 34, height: 34, borderRadius: 8,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, marginRight: 6,
    },
    titleCol: { flex: 1 },
    title: { fontSize: 15, fontWeight: '700' },
    subtitle: { fontSize: 12, color: '#666' },
    editBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 8, paddingVertical: 4,
        borderRadius: 999, borderWidth: 1,
    },
    editText: { fontSize: 12, fontWeight: '600' },
    bottomRow: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginTop: 8,
    },
    mantraName: { fontSize: 14, fontWeight: '600', color: '#222', flex: 1, marginRight: 6 },
    countText: { fontSize: 12, fontWeight: '700' },
});
