import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface HomeHeaderProps {
    title: string;
    onMenuPress: () => void;
}

export default function HomeHeader({ title, onMenuPress }: HomeHeaderProps) {
    const { theme } = useAppTheme();
    return (
        <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
            <TouchableOpacity onPress={onMenuPress} style={styles.menuBtn} hitSlop={8}>
                <Ionicons name="menu" size={26} color={theme.headerText} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: theme.headerText }]}>{title}</Text>
            <View style={{ width: 26 }} />
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 6,
        paddingVertical: 10,
    },
    menuBtn: { padding: 2 },
    title: { fontSize: 20, fontWeight: 'bold' },
});
