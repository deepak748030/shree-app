import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';

interface ForceUpdateScreenProps {
    message: string;
    storeUrl: string;
}

export default function ForceUpdateScreen({ message, storeUrl }: ForceUpdateScreenProps) {
    const handleUpdate = () => {
        if (storeUrl) {
            Linking.openURL(storeUrl);
        } else {
            Linking.openURL('https://play.google.com/store/apps/details?id=com.shreejii.app');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.overlay} />
            <View style={styles.sheet}>
                <View style={styles.handle} />

                <View style={styles.iconContainer}>
                    <Ionicons name="cloud-download-outline" size={36} color={Colors.dark.primary} />
                </View>

                <Text style={styles.title}>अपडेट उपलब्ध है</Text>
                <Text style={styles.subtitle}>Update Available</Text>

                <View style={styles.divider} />

                <Text style={styles.message}>{message}</Text>

                <TouchableOpacity style={styles.button} onPress={handleUpdate} activeOpacity={0.8}>
                    <Ionicons name="logo-google-playstore" size={20} color={Colors.dark.background} style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>
                        {Platform.OS === 'ios' ? 'App Store पर अपडेट करें' : 'Play Store पर अपडेट करें'}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.note}>
                    ऐप का उपयोग जारी रखने के लिए कृपया नवीनतम संस्करण डाउनलोड करें।
                </Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(26, 18, 0, 0.7)',
    },
    sheet: {
        backgroundColor: Colors.dark.cardBg,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 24,
        paddingBottom: 40,
        alignItems: 'center',
        borderTopWidth: 1,
        borderColor: Colors.dark.border,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: Colors.dark.border,
        marginBottom: 20,
    },
    iconContainer: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: 'rgba(255, 215, 0, 0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.25)',
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: Colors.dark.primary,
        marginBottom: 4,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 14,
        fontWeight: '600',
        color: Colors.dark.text,
        marginBottom: 12,
        textAlign: 'center',
        opacity: 0.7,
    },
    divider: {
        width: '60%',
        height: 1,
        backgroundColor: Colors.dark.border,
        marginBottom: 14,
    },
    message: {
        fontSize: 14,
        color: Colors.dark.text,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 22,
        opacity: 0.65,
        paddingHorizontal: 8,
    },
    button: {
        backgroundColor: Colors.dark.primary,
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
        width: '100%',
        alignItems: 'center',
        marginBottom: 14,
        flexDirection: 'row',
        justifyContent: 'center',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: Colors.dark.background,
    },
    note: {
        fontSize: 11,
        color: Colors.dark.text,
        textAlign: 'center',
        lineHeight: 16,
        opacity: 0.4,
    },
});
