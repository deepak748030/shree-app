import { useLanguage } from '@/contexts/language-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchPresetImages, PresetImageData } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 60) / 3;
const STORAGE_KEY = '@naam_jap_user_images';

interface PickImageSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectTextStyle: (index: number) => void;
    onSelectImage: (imageSource: any) => void;
}

type Section =
    | { type: 'text-styles' }
    | { type: 'section-title'; key: string }
    | { type: 'user-grid'; uris: string[] }
    | { type: 'preset-grid'; images: PresetImageData[] }
    | { type: 'loading' }
    | { type: 'empty'; key: string };

export default function PickImageSheet({
    visible,
    onClose,
    onSelectTextStyle,
    onSelectImage,
}: PickImageSheetProps) {
    const { t } = useLanguage();
    const { theme } = useAppTheme();
    const [userImages, setUserImages] = useState<string[]>([]);
    const [presetImages, setPresetImages] = useState<PresetImageData[]>([]);
    const [loadingPresets, setLoadingPresets] = useState(false);

    useEffect(() => {
        if (!visible) return;
        AsyncStorage.getItem(STORAGE_KEY).then((val) => {
            if (val) {
                try { setUserImages(JSON.parse(val)); } catch { setUserImages([]); }
            }
        });
        setLoadingPresets(true);
        fetchPresetImages().then((imgs) => {
            setPresetImages(imgs);
        }).finally(() => setLoadingPresets(false));
    }, [visible]);

    const saveImages = useCallback(async (images: string[]) => {
        setUserImages(images);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(images));
    }, []);

    const handleUpload = useCallback(async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('error'), 'Gallery permission is required to upload images.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            base64: false,
            allowsEditing: false,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
            const uri = result.assets[0].uri;
            const updated = [uri, ...userImages];
            await saveImages(updated);
        }
    }, [userImages, saveImages, t]);

    const handleDeleteImage = useCallback((index: number) => {
        const updated = userImages.filter((_, i) => i !== index);
        saveImages(updated);
    }, [userImages, saveImages]);

    const textStyles = [
        { label: 'राधा', color: theme.text },
        { label: 'राधा', color: theme.accent },
        { label: 'राधा', color: '#E53935' },
    ];

    const sections: Section[] = [
        { type: 'text-styles' },
    ];
    if (userImages.length > 0) {
        sections.push({ type: 'section-title', key: 'pick_image_my_uploads' });
        sections.push({ type: 'user-grid', uris: userImages });
    }
    sections.push({ type: 'section-title', key: 'pick_image_presets' });
    if (loadingPresets) sections.push({ type: 'loading' });
    else if (presetImages.length === 0) sections.push({ type: 'empty', key: 'pick_image_no_uploads' });
    else sections.push({ type: 'preset-grid', images: presetImages });

    const renderItem = ({ item }: { item: Section }) => {
        switch (item.type) {
            case 'text-styles':
                return (
                    <View style={styles.textStyleRow}>
                        {textStyles.map((s, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.textStyleCard, { borderColor: theme.cardBorder, backgroundColor: theme.cardBg }]}
                                onPress={() => onSelectTextStyle(index)}
                            >
                                <Text style={[styles.textStyleLabel, { color: s.color }]}>{s.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            case 'section-title':
                return (
                    <Text style={[styles.sectionTitle, { color: theme.subText }]}>
                        {t(item.key as any)}
                    </Text>
                );
            case 'user-grid':
                return (
                    <View style={styles.imageGrid}>
                        {item.uris.map((uri, index) => (
                            <View key={`user-${index}`} style={styles.imageCard}>
                                <TouchableOpacity
                                    style={styles.imageCardInner}
                                    onPress={() => onSelectImage({ uri })}
                                    activeOpacity={0.8}
                                >
                                    <Image source={{ uri }} style={styles.gridImage} contentFit="cover" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.deleteBtn}
                                    onPress={() => handleDeleteImage(index)}
                                >
                                    <Ionicons name="trash-outline" size={14} color="#FFF" />
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                );
            case 'preset-grid':
                return (
                    <View style={styles.imageGrid}>
                        {item.images.map((img) => (
                            <TouchableOpacity
                                key={img._id}
                                style={styles.imageCard}
                                onPress={() => onSelectImage({ uri: img.imageUrl })}
                            >
                                <Image source={{ uri: img.imageUrl }} style={styles.gridImage} contentFit="cover" />
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            case 'loading':
                return <ActivityIndicator size="small" color={theme.accent} style={{ marginVertical: 20 }} />;
            case 'empty':
                return <Text style={[styles.emptyText, { color: theme.subText }]}>{t(item.key as any)}</Text>;
        }
    };

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={[styles.sheet, { backgroundColor: theme.bgCream }]}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>{t('pick_image_header')}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={10}>
                        <Ionicons name="close" size={24} color={theme.text} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={[styles.uploadRow, { backgroundColor: theme.mutedBg, borderColor: theme.cardBorder }]}
                    onPress={handleUpload}
                >
                    <Ionicons name="cloud-upload-outline" size={22} color={theme.accent} />
                    <Text style={[styles.uploadText, { color: theme.text }]}>{t('pick_image_upload')}</Text>
                </TouchableOpacity>

                <FlatList
                    data={sections}
                    keyExtractor={(_, i) => `s-${i}`}
                    renderItem={renderItem}
                    contentContainerStyle={styles.scrollContent}
                    ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 0.25,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
        flex: 0.75,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingHorizontal: 6,
        paddingTop: 14,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 14,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        marginBottom: 6,
        borderRadius: 10,
        marginHorizontal: 14,
        borderWidth: StyleSheet.hairlineWidth,
    },
    uploadText: {
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 12,
    },
    scrollContent: {
        paddingBottom: 30,
        paddingHorizontal: 14,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        marginBottom: 6,
        marginTop: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        marginVertical: 20,
    },
    textStyleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    textStyleCard: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE * 0.6,
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textStyleLabel: {
        fontSize: 30,
        fontWeight: 'bold',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 6,
    },
    imageCard: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
    },
    imageCardInner: {
        width: '100%',
        height: '100%',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
    deleteBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(229,57,53,0.85)',
        borderRadius: 12,
        width: 24,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
