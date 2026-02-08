import { useLanguage } from '@/contexts/language-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TEXT_DARK = '#333333';
const YELLOW_BG = '#FFEB3B';
const IMAGE_SIZE = (SCREEN_WIDTH - 60) / 3;

const textStyles = [
    { label: 'राधा', color: TEXT_DARK, bg: '#FFFFFF', borderColor: '#ccc' },
    { label: 'राधा', color: YELLOW_BG, bg: '#FFFFFF', borderColor: '#ccc' },
    { label: 'राधा', color: '#E53935', bg: '#FFFFFF', borderColor: '#ccc' },
];

const presetImages = [
    require('@/assets/images/slider-1.png'),
    require('@/assets/images/slider-2.png'),
    require('@/assets/images/slider-3.png'),
    require('@/assets/images/slider-4.png'),
];

interface PickImageSheetProps {
    visible: boolean;
    onClose: () => void;
    onSelectTextStyle: (index: number) => void;
    onSelectImage: (imageSource: any) => void;
}

export default function PickImageSheet({
    visible,
    onClose,
    onSelectTextStyle,
    onSelectImage,
}: PickImageSheetProps) {
    const { t } = useLanguage();

    return (
        <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>{t('pick_image_header')}</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color={TEXT_DARK} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.uploadRow}>
                    <Ionicons name="image-outline" size={24} color={TEXT_DARK} />
                    <Text style={styles.uploadText}>{t('pick_image_upload')}</Text>
                </TouchableOpacity>

                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}
                >
                    <View style={styles.textStyleRow}>
                        {textStyles.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.textStyleCard, { borderColor: item.borderColor }]}
                                onPress={() => onSelectTextStyle(index)}
                            >
                                <Text style={[styles.textStyleLabel, { color: item.color }]}>{item.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.imageGrid}>
                        {presetImages.map((img, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.imageCard}
                                onPress={() => onSelectImage(img)}
                            >
                                <Image source={img} style={styles.gridImage} contentFit="cover" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 0.3,
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    sheet: {
        flex: 0.7,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingHorizontal: 20,
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: TEXT_DARK,
    },
    uploadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 12,
    },
    uploadText: {
        fontSize: 15,
        color: TEXT_DARK,
        marginLeft: 12,
    },
    scrollContent: {
        paddingBottom: 30,
    },
    textStyleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    textStyleCard: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE * 0.6,
        borderRadius: 8,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    textStyleLabel: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    imageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    imageCard: {
        width: IMAGE_SIZE,
        height: IMAGE_SIZE,
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 10,
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
});
