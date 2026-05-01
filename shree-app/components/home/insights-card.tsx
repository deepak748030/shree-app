import { useAppTheme } from '@/contexts/theme-context';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface InsightsCardProps {
    leftLabel: string;
    leftValue: number | string;
    rightLabel: string;
    rightValue: number | string;
}

export default function InsightsCard({ leftLabel, leftValue, rightLabel, rightValue }: InsightsCardProps) {
    const { theme } = useAppTheme();
    return (
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
            <View style={styles.col}>
                <Text style={[styles.value, { color: theme.accent }]}>{leftValue}</Text>
                <Text style={[styles.label, { color: theme.subText }]}>{leftLabel}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.cardBorder }]} />
            <View style={styles.col}>
                <Text style={[styles.value, { color: theme.accent }]}>{rightValue}</Text>
                <Text style={[styles.label, { color: theme.subText }]}>{rightLabel}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 12,
    },
    col: { flex: 1, alignItems: 'center' },
    value: { fontSize: 22, fontWeight: '800' },
    label: { fontSize: 12, marginTop: 2 },
    divider: { width: 1, height: 32 },
});
