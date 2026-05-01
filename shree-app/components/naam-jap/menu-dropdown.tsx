import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface MenuDropdownProps {
    visible: boolean;
    onClose: () => void;
    onPickImage: () => void;
    onAnalytics: () => void;
    onSettings: () => void;
    anchorY: number;
}

export default function MenuDropdown({
    visible,
    onClose,
    onPickImage,
    onAnalytics,
    onSettings,
    anchorY,
}: MenuDropdownProps) {
    const { t } = useLanguage();
    const { theme } = useAppTheme();

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <View
                    style={[
                        styles.menu,
                        {
                            top: anchorY,
                            backgroundColor: theme.cardBg,
                            borderColor: theme.cardBorder,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.divider }]}
                        onPress={() => { onClose(); onPickImage(); }}
                    >
                        <Ionicons name="image-outline" size={22} color={theme.accent} />
                        <Text style={[styles.menuText, { color: theme.text }]}>{t('menu_pick_image')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomColor: theme.divider }]}
                        onPress={() => { onClose(); onAnalytics(); }}
                    >
                        <MaterialIcons name="bar-chart" size={22} color={theme.accent} />
                        <Text style={[styles.menuText, { color: theme.text }]}>{t('menu_analytics')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.menuItem, { borderBottomWidth: 0 }]}
                        onPress={() => { onClose(); onSettings(); }}
                    >
                        <Ionicons name="settings-outline" size={22} color={theme.accent} />
                        <Text style={[styles.menuText, { color: theme.text }]}>{t('menu_settings')}</Text>
                    </TouchableOpacity>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
    },
    menu: {
        position: 'absolute',
        right: 10,
        borderRadius: 10,
        paddingVertical: 4,
        minWidth: 180,
        borderWidth: 1,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    menuText: {
        fontSize: 15,
        fontWeight: '500',
        marginLeft: 14,
    },
});
