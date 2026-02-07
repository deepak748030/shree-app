import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEYS = {
    COUNT: '@naam_jap_count',
    MALA_COUNT: '@naam_jap_mala_count',
    VIBRATION: '@naam_jap_vibration',
    DISPLAY_MODE: '@naam_jap_display_mode',
    SELECTED_IMAGE: '@naam_jap_selected_image',
    TEXT_STYLE: '@naam_jap_text_style',
};

const TEXT_DARK = '#333333';

interface PersistedState {
    count: number;
    malaCount: number;
    vibrationEnabled: boolean;
    displayMode: 'text' | 'image';
    selectedImage: any;
    selectedTextStyle: { color: string };
    isLoaded: boolean;
}

export function usePersistedCounter() {
    const [count, setCount] = useState(0);
    const [malaCount, setMalaCount] = useState(0);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [displayMode, setDisplayMode] = useState<'text' | 'image'>('text');
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [selectedTextStyle, setSelectedTextStyle] = useState<{ color: string }>({ color: TEXT_DARK });
    const [isLoaded, setIsLoaded] = useState(false);

    // Load persisted data on mount
    useEffect(() => {
        const loadData = async () => {
            try {
                const [
                    savedCount,
                    savedMalaCount,
                    savedVibration,
                    savedDisplayMode,
                    savedImage,
                    savedTextStyle,
                ] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.COUNT),
                    AsyncStorage.getItem(STORAGE_KEYS.MALA_COUNT),
                    AsyncStorage.getItem(STORAGE_KEYS.VIBRATION),
                    AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_MODE),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_IMAGE),
                    AsyncStorage.getItem(STORAGE_KEYS.TEXT_STYLE),
                ]);

                if (savedCount !== null) setCount(parseInt(savedCount, 10));
                if (savedMalaCount !== null) setMalaCount(parseInt(savedMalaCount, 10));
                if (savedVibration !== null) setVibrationEnabled(savedVibration === 'true');
                if (savedDisplayMode !== null) setDisplayMode(savedDisplayMode as 'text' | 'image');
                if (savedImage !== null) setSelectedImage(JSON.parse(savedImage));
                if (savedTextStyle !== null) setSelectedTextStyle(JSON.parse(savedTextStyle));
            } catch (error) {
                console.warn('Failed to load persisted counter data:', error);
            } finally {
                setIsLoaded(true);
            }
        };
        loadData();
    }, []);

    // Persist count
    const updateCount = useCallback((updater: (prev: number) => number) => {
        setCount((prev) => {
            const newVal = updater(prev);
            AsyncStorage.setItem(STORAGE_KEYS.COUNT, String(newVal));
            return newVal;
        });
    }, []);

    // Persist mala count
    const updateMalaCount = useCallback((updater: (prev: number) => number) => {
        setMalaCount((prev) => {
            const newVal = updater(prev);
            AsyncStorage.setItem(STORAGE_KEYS.MALA_COUNT, String(newVal));
            return newVal;
        });
    }, []);

    // Persist vibration
    const updateVibration = useCallback((value: boolean) => {
        setVibrationEnabled(value);
        AsyncStorage.setItem(STORAGE_KEYS.VIBRATION, String(value));
    }, []);

    // Persist display mode
    const updateDisplayMode = useCallback((mode: 'text' | 'image') => {
        setDisplayMode(mode);
        AsyncStorage.setItem(STORAGE_KEYS.DISPLAY_MODE, mode);
    }, []);

    // Persist selected image
    const updateSelectedImage = useCallback((img: any) => {
        setSelectedImage(img);
        AsyncStorage.setItem(STORAGE_KEYS.SELECTED_IMAGE, JSON.stringify(img));
    }, []);

    // Persist text style
    const updateSelectedTextStyle = useCallback((style: { color: string }) => {
        setSelectedTextStyle(style);
        AsyncStorage.setItem(STORAGE_KEYS.TEXT_STYLE, JSON.stringify(style));
    }, []);

    // Reset helpers
    const resetCurrentMala = useCallback(() => {
        setCount((prev) => {
            const newVal = prev - (prev % 108);
            AsyncStorage.setItem(STORAGE_KEYS.COUNT, String(newVal));
            return newVal;
        });
    }, []);

    const resetAllMalas = useCallback(() => {
        setCount(0);
        setMalaCount(0);
        AsyncStorage.setItem(STORAGE_KEYS.COUNT, '0');
        AsyncStorage.setItem(STORAGE_KEYS.MALA_COUNT, '0');
    }, []);

    return {
        count,
        malaCount,
        vibrationEnabled,
        displayMode,
        selectedImage,
        selectedTextStyle,
        isLoaded,
        updateCount,
        updateMalaCount,
        updateVibration,
        updateDisplayMode,
        updateSelectedImage,
        updateSelectedTextStyle,
        resetCurrentMala,
        resetAllMalas,
    };
}
