import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

type MessageType = 'error' | 'warning' | 'success' | 'info' | 'confirm';

interface BottomSheetMessageProps {
    visible: boolean;
    onClose: () => void;
    type?: MessageType;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm?: () => void;
    loading?: boolean;
}

const iconMap: Record<MessageType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
    error: { name: 'alert-circle', color: '#E53935' },
    warning: { name: 'warning', color: '#F57C00' },
    success: { name: 'checkmark-circle', color: '#43A047' },
    info: { name: 'information-circle', color: '#1E88E5' },
    confirm: { name: 'help-circle', color: '#F57C00' },
};

export default function BottomSheetMessage({
    visible,
    onClose,
    type = 'info',
    title,
    message,
    confirmLabel = 'ठीक है',
    cancelLabel = 'रद्द करें',
    onConfirm,
    loading = false,
}: BottomSheetMessageProps) {
    const { theme } = useAppTheme();
    const icon = iconMap[type];
    const onAccent = theme.isDark ? '#000' : '#FFFFFF';
    const confirmBg = type === 'confirm' || type === 'error' || type === 'warning' ? icon.color : theme.accent;
    const onConfirmText = '#FFFFFF';

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderTopColor: theme.divider, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <View style={[styles.handle, { backgroundColor: theme.divider }]} />
                <View style={styles.iconRow}>
                    <Ionicons name={icon.name} size={32} color={icon.color} />
                    <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
                </View>
                <Text style={[styles.message, { color: theme.subText }]}>{message}</Text>
                <View style={styles.buttonRow}>
                    {type === 'confirm' && (
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: theme.mutedBg, borderColor: theme.divider, borderWidth: 1 }]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.buttonText, { color: theme.text }]}>{cancelLabel}</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: confirmBg }]}
                        onPress={onConfirm || onClose}
                        activeOpacity={0.7}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={onConfirmText} size="small" />
                        ) : (
                            <Text style={[styles.buttonText, { color: onConfirmText }]}>{confirmLabel}</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 6,
        paddingTop: 10,
        paddingBottom: 24,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 12,
    },
    iconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        paddingHorizontal: 10,
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
        marginLeft: 10,
        flex: 1,
    },
    message: {
        fontSize: 14,
        lineHeight: 20,
        paddingHorizontal: 10,
        marginBottom: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        gap: 8,
    },
    button: {
        flex: 1,
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '600',
    },
});
