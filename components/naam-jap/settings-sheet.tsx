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

const YELLOW_BG = '#FFEB3B';
const TEXT_DARK = '#333333';

interface SettingsSheetProps {
    visible: boolean;
    onClose: () => void;
    vibrationEnabled: boolean;
    onToggleVibration: (value: boolean) => void;
    onResetCurrentMala: () => void;
    onResetAllMalas: () => void;
}

export default function SettingsSheet({
    visible,
    onClose,
    vibrationEnabled,
    onToggleVibration,
    onResetCurrentMala,
    onResetAllMalas,
}: SettingsSheetProps) {
    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={styles.sheet}>
                {/* Vibration Toggle */}
                <View style={styles.row}>
                    <View style={styles.rowLeft}>
                        <MaterialCommunityIcons name="vibrate" size={24} color={TEXT_DARK} />
                        <Text style={styles.rowLabel}>Vibration / Haptics</Text>
                    </View>
                    <Switch
                        value={vibrationEnabled}
                        onValueChange={onToggleVibration}
                        trackColor={{ false: '#ccc', true: TEXT_DARK }}
                        thumbColor="#FFFFFF"
                    />
                </View>

                <View style={styles.divider} />

                {/* Reset Current Mala */}
                <TouchableOpacity style={styles.row} onPress={() => { onResetCurrentMala(); onClose(); }}>
                    <View style={styles.rowLeft}>
                        <Ionicons name="refresh" size={24} color={TEXT_DARK} />
                        <View style={styles.rowTextGroup}>
                            <Text style={styles.rowLabel}>Reset Current Mala</Text>
                            <Text style={styles.rowSubLabel}>Reset the current 108 count</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                {/* Reset All Malas */}
                <TouchableOpacity style={styles.row} onPress={() => { onResetAllMalas(); onClose(); }}>
                    <View style={styles.rowLeft}>
                        <MaterialCommunityIcons name="close-box-outline" size={24} color={TEXT_DARK} />
                        <View style={styles.rowTextGroup}>
                            <Text style={styles.rowLabel}>Reset All Malas Done Today</Text>
                            <Text style={styles.rowSubLabel}>Reset count and malas to 0</Text>
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
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheet: {
        backgroundColor: YELLOW_BG,
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
    },
    rowLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    rowLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: TEXT_DARK,
        marginLeft: 14,
    },
    rowSubLabel: {
        fontSize: 13,
        color: TEXT_DARK,
        opacity: 0.7,
        marginLeft: 14,
        marginTop: 2,
    },
    rowTextGroup: {
        flexDirection: 'column',
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
    },
});
