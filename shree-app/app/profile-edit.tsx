import BottomSheetMessage from '@/components/ui/bottom-sheet-message';
import { useAuth } from '@/contexts/auth-context';
import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { updateProfile } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileEditScreen() {
    const { theme } = useAppTheme();
    const { t, language } = useLanguage();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, updateAuthUser } = useAuth();

    const [name, setName] = useState(user?.name || '');
    const [localImage, setLocalImage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [sheet, setSheet] = useState<{ visible: boolean; type: 'success' | 'error'; title: string; message: string }>({
        visible: false, type: 'success', title: '', message: '',
    });

    const initial = (name || '?').charAt(0).toUpperCase();
    const previewUri = localImage || user?.profileImage || null;

    const pickFromGallery = async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
            setSheet({ visible: true, type: 'error', title: t('error' as any), message: language === 'hi' ? 'गैलरी की अनुमति नहीं मिली।' : 'Gallery permission denied.' });
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setLocalImage(result.assets[0].uri);
        }
    };

    const takePhoto = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            setSheet({ visible: true, type: 'error', title: t('error' as any), message: language === 'hi' ? 'कैमरा की अनुमति नहीं मिली।' : 'Camera permission denied.' });
            return;
        }
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            setLocalImage(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!user?.deviceId) return;
        const trimmed = name.trim();
        if (!trimmed) {
            setSheet({ visible: true, type: 'error', title: t('error' as any), message: language === 'hi' ? 'कृपया अपना नाम दर्ज करें।' : 'Please enter your name.' });
            return;
        }
        setSaving(true);
        const res = await updateProfile(user.deviceId, trimmed, localImage);
        setSaving(false);
        if (res.success && res.response) {
            await updateAuthUser({ ...user, ...res.response });
            setSheet({
                visible: true, type: 'success',
                title: language === 'hi' ? 'सफल' : 'Saved',
                message: language === 'hi' ? 'प्रोफ़ाइल अपडेट हो गई।' : 'Profile updated successfully.',
            });
            setTimeout(() => router.back(), 900);
        } else {
            setSheet({ visible: true, type: 'error', title: t('error' as any), message: res.message || (language === 'hi' ? 'अपडेट विफल।' : 'Update failed.') });
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { backgroundColor: theme.headerBg, borderBottomColor: theme.cardBorder }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
                    <Ionicons name="chevron-back" size={22} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: theme.headerText }]}>
                    {language === 'hi' ? 'प्रोफ़ाइल बदलें' : 'Edit Profile'}
                </Text>
                <View style={{ width: 28 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={styles.avatarWrap}>
                        <View style={[styles.avatar, { borderColor: theme.accent, backgroundColor: theme.accent + '22' }]}>
                            {previewUri ? (
                                <Image source={{ uri: previewUri }} style={styles.avatarImage} contentFit="cover" />
                            ) : (
                                <Text style={[styles.avatarText, { color: theme.accent }]}>{initial}</Text>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={pickFromGallery}
                            style={[styles.editFab, { backgroundColor: theme.accent }]}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="camera" size={16} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            onPress={pickFromGallery}
                            style={[styles.actionBtn, { borderColor: theme.cardBorder, backgroundColor: theme.cardBg }]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="images-outline" size={16} color={theme.accent} />
                            <Text style={[styles.actionText, { color: theme.text }]}>
                                {language === 'hi' ? 'गैलरी' : 'Gallery'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={takePhoto}
                            style={[styles.actionBtn, { borderColor: theme.cardBorder, backgroundColor: theme.cardBg }]}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="camera-outline" size={16} color={theme.accent} />
                            <Text style={[styles.actionText, { color: theme.text }]}>
                                {language === 'hi' ? 'कैमरा' : 'Camera'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.label, { color: theme.subText }]}>
                        {language === 'hi' ? 'नाम' : 'Name'}
                    </Text>
                    <View style={[styles.inputWrap, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Ionicons name="person-outline" size={16} color={theme.accent} style={{ marginRight: 8 }} />
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={language === 'hi' ? 'अपना नाम लिखें' : 'Enter your name'}
                            placeholderTextColor={theme.subText}
                            style={[styles.input, { color: theme.text }]}
                            maxLength={60}
                        />
                    </View>

                    <Text style={[styles.label, { color: theme.subText }]}>
                        {language === 'hi' ? 'मोबाइल नंबर' : 'Mobile Number'}
                    </Text>
                    <View style={[styles.inputWrap, { backgroundColor: theme.mutedBg, borderColor: theme.cardBorder }]}>
                        <Ionicons name="call-outline" size={16} color={theme.subText} style={{ marginRight: 8 }} />
                        <Text style={[styles.input, { color: theme.subText, paddingVertical: 14 }]}>
                            {user?.mobile || '-'}
                        </Text>
                        <Ionicons name="lock-closed-outline" size={14} color={theme.subText} />
                    </View>
                    <Text style={[styles.helper, { color: theme.subText }]}>
                        {language === 'hi' ? 'मोबाइल नंबर बदला नहीं जा सकता।' : 'Mobile number cannot be changed.'}
                    </Text>

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        activeOpacity={0.85}
                        style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: saving ? 0.7 : 1 }]}
                    >
                        {saving ? (
                            <ActivityIndicator color={theme.isDark ? '#000' : '#fff'} />
                        ) : (
                            <Text style={[styles.saveText, { color: theme.isDark ? '#000' : '#fff' }]}>
                                {language === 'hi' ? 'सेव करें' : 'Save Changes'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>

            <BottomSheetMessage
                visible={sheet.visible}
                onClose={() => setSheet((s) => ({ ...s, visible: false }))}
                type={sheet.type}
                title={sheet.title}
                message={sheet.message}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 6, paddingVertical: 8, borderBottomWidth: 1,
    },
    backBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700' },
    content: { padding: 16, paddingBottom: 40 },
    avatarWrap: { alignSelf: 'center', marginTop: 6, marginBottom: 6 },
    avatar: {
        width: 110, height: 110, borderRadius: 55, borderWidth: 2,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    avatarImage: { width: '100%', height: '100%' },
    avatarText: { fontSize: 38, fontWeight: '800' },
    editFab: {
        position: 'absolute', bottom: 0, right: 0,
        width: 32, height: 32, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    actionsRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 12, marginBottom: 18 },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
    },
    actionText: { fontSize: 13, fontWeight: '600' },
    label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 6 },
    inputWrap: {
        flexDirection: 'row', alignItems: 'center',
        borderRadius: 10, borderWidth: 1, paddingHorizontal: 12,
    },
    input: { flex: 1, fontSize: 14, paddingVertical: 12 },
    helper: { fontSize: 11, marginTop: 6 },
    saveBtn: {
        marginTop: 24, borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    },
    saveText: { fontSize: 15, fontWeight: '700' },
});
