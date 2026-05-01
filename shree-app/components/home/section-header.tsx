import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface SectionHeaderProps {
    title: string;
    actionLabel?: string;
    actionIcon?: 'add' | 'eye';
    onActionPress?: () => void;
}

export default function SectionHeader({ title, actionLabel, actionIcon, onActionPress }: SectionHeaderProps) {
    const { theme } = useAppTheme();
    const iconName = actionIcon === 'add' ? 'add' : 'eye-outline';

    return (
        <View style={styles.row}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
            {!!actionLabel && (
                <TouchableOpacity
                    onPress={onActionPress}
                    style={[styles.btn, { borderColor: theme.cardBorder, backgroundColor: theme.cardBg }]}
                    hitSlop={6}
                >
                    <Text style={[styles.btnText, { color: theme.accent }]}>{actionLabel}</Text>
                    <Ionicons name={iconName} size={14} color={theme.accent} />
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
        marginBottom: 6,
    },
    title: { fontSize: 16, fontWeight: '700' },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        borderWidth: 1,
    },
    btnText: { fontSize: 12, fontWeight: '700' },
});
