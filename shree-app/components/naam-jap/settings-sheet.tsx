import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import React from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface SettingsSheetProps {
    visible: boolean;
    onClose: () => void;
    vibrationEnabled: boolean;
    onToggleVibration: (value: boolean) => void;
    autoChangeImage: boolean;
    onToggleAutoChange: (value: boolean) => void;
    onResetCurrentMala: () => void;
    onResetAllMalas: () => void;
}

export default function SettingsSheet({
    visible,
    onClose,
    vibrationEnabled,
    onToggleVibration,
    autoChangeImage,
    onToggleAutoChange,
    onResetCurrentMala,
    onResetAllMalas,
}: SettingsSheetProps) {
    const { theme } = useAppTheme();
    const { t } = useLanguage();

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={[styles.sheet, { backgroundColor: theme.cardBg, borderTopColor: theme.cardBorder }]}>
                <View style={[styles.handle, { backgroundColor: theme.divider }]} />

                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <MaterialCommunityIcons name="vibrate" size={22} color={theme.accent} />
                        <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings_vibration')}</Text>
                    </View>
                    <Switch
                        value={vibrationEnabled}
                        onValueChange={onToggleVibration}
                        trackColor={{ false: theme.divider, true: theme.accent }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <MaterialCommunityIcons name="image-auto-adjust" size={22} color={theme.accent} />
                        <View style={styles.rowTextGroup}>
                            <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings_auto_change_image')}</Text>
                            <Text style={[styles.rowSubLabel, { color: theme.subText }]}>{t('settings_auto_change_image_sub')}</Text>
                        </View>
                    </View>
                    <Switch
                        value={autoChangeImage}
                        onValueChange={onToggleAutoChange}
                        trackColor={{ false: theme.divider, true: theme.accent }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                <TouchableOpacity style={styles.row} onPress={() => { onResetCurrentMala(); onClose(); }}>
                    <View style={styles.rowLeft}>
                        <Ionicons name="refresh" size={22} color={theme.accent} />
                        <View style={styles.rowTextGroup}>
                            <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings_reset_current')}</Text>
                            <Text style={[styles.rowSubLabel, { color: theme.subText }]}>{t('settings_reset_current_sub')}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={[styles.divider, { backgroundColor: theme.divider }]} />

                <TouchableOpacity style={styles.row} onPress={() => { onResetAllMalas(); onClose(); }}>
                    <View style={styles.rowLeft}>
                        <MaterialCommunityIcons name="close-box-outline" size={22} color="#E53935" />
                        <View style={styles.rowTextGroup}>
                            <Text style={[styles.rowLabel, { color: theme.text }]}>{t('settings_reset_all')}</Text>
                            <Text style={[styles.rowSubLabel, { color: theme.subText }]}>{t('settings_reset_all_sub')}</Text>
                        </View>
                    </View>
                </TouchableOpacity>
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
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingTop: 8,
        paddingHorizontal: 20,
        paddingBottom: 30,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    handle: {
        width: 42,
        height: 4,
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    rowLabel: {
        fontSize: 15,
        fontWeight: '700',
        marginLeft: 14,
    },
    rowSubLabel: {
        fontSize: 12,
        marginLeft: 14,
        marginTop: 1,
    },
    rowTextGroup: {
        flexDirection: 'column',
        flex: 1,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
    },
});
