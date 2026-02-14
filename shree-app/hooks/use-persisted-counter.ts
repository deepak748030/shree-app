import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEYS = {
    COUNT: '@naam_jap_count',
    MALA_COUNT: '@naam_jap_mala_count',
    VIBRATION: '@naam_jap_vibration',
    DISPLAY_MODE: '@naam_jap_display_mode',
    SELECTED_IMAGE: '@naam_jap_selected_image',
    TEXT_STYLE: '@naam_jap_text_style',
    TODAY_DATE: '@naam_jap_today_date',
    TODAY_COUNT: '@naam_jap_today_count',
    TODAY_MALAS: '@naam_jap_today_malas',
    AUTO_CHANGE_IMAGE: '@naam_jap_auto_change_image',
};

const TEXT_DARK = '#333333';

function getTodayString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function usePersistedCounter() {
    const [count, setCount] = useState(0);
    const [malaCount, setMalaCount] = useState(0);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const [displayMode, setDisplayMode] = useState<'text' | 'image'>('image');
    const [selectedImage, setSelectedImage] = useState<any>(null);
    const [selectedTextStyle, setSelectedTextStyle] = useState<{ color: string }>({ color: TEXT_DARK });
    const [todayCount, setTodayCount] = useState(0);
    const [todayMalas, setTodayMalas] = useState(0);
    const [autoChangeImage, setAutoChangeImage] = useState(true);
    const [isLoaded, setIsLoaded] = useState(false);
    const lastDateRef = useRef<string>(getTodayString());

    // Check if day changed and reset daily counters if needed
    const checkAndResetDaily = useCallback(async () => {
        const today = getTodayString();
        if (lastDateRef.current !== today) {
            lastDateRef.current = today;
            setTodayCount(0);
            setTodayMalas(0);
            await AsyncStorage.multiSet([
                [STORAGE_KEYS.TODAY_DATE, today],
                [STORAGE_KEYS.TODAY_COUNT, '0'],
                [STORAGE_KEYS.TODAY_MALAS, '0'],
            ]);
        }
    }, []);

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
                    savedTodayDate,
                    savedTodayCount,
                    savedTodayMalas,
                ] = await Promise.all([
                    AsyncStorage.getItem(STORAGE_KEYS.COUNT),
                    AsyncStorage.getItem(STORAGE_KEYS.MALA_COUNT),
                    AsyncStorage.getItem(STORAGE_KEYS.VIBRATION),
                    AsyncStorage.getItem(STORAGE_KEYS.DISPLAY_MODE),
                    AsyncStorage.getItem(STORAGE_KEYS.SELECTED_IMAGE),
                    AsyncStorage.getItem(STORAGE_KEYS.TEXT_STYLE),
                    AsyncStorage.getItem(STORAGE_KEYS.TODAY_DATE),
                    AsyncStorage.getItem(STORAGE_KEYS.TODAY_COUNT),
                    AsyncStorage.getItem(STORAGE_KEYS.TODAY_MALAS),
                ]);

                const savedAutoChange = await AsyncStorage.getItem(STORAGE_KEYS.AUTO_CHANGE_IMAGE);

                if (savedCount !== null) setCount(parseInt(savedCount, 10));
                if (savedMalaCount !== null) setMalaCount(parseInt(savedMalaCount, 10));
                if (savedVibration !== null) setVibrationEnabled(savedVibration === 'true');
                if (savedDisplayMode !== null) setDisplayMode(savedDisplayMode as 'text' | 'image');
                if (savedImage !== null) setSelectedImage(JSON.parse(savedImage));
                if (savedTextStyle !== null) setSelectedTextStyle(JSON.parse(savedTextStyle));
                if (savedAutoChange !== null) setAutoChangeImage(savedAutoChange === 'true');

                // Check if today's date matches - if not, reset daily counters
                const today = getTodayString();
                if (savedTodayDate === today) {
                    if (savedTodayCount !== null) setTodayCount(parseInt(savedTodayCount, 10));
                    if (savedTodayMalas !== null) setTodayMalas(parseInt(savedTodayMalas, 10));
                } else {
                    // New day - reset daily counters and save new date
                    await Promise.all([
                        AsyncStorage.setItem(STORAGE_KEYS.TODAY_DATE, today),
                        AsyncStorage.setItem(STORAGE_KEYS.TODAY_COUNT, '0'),
                        AsyncStorage.setItem(STORAGE_KEYS.TODAY_MALAS, '0'),
                    ]);
                }
            } catch {
                // Silent fail
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

    // Persist today count
    const updateTodayCount = useCallback((updater: (prev: number) => number) => {
        setTodayCount((prev) => {
            const newVal = updater(prev);
            AsyncStorage.setItem(STORAGE_KEYS.TODAY_COUNT, String(newVal));
            return newVal;
        });
    }, []);

    // Persist today malas
    const updateTodayMalas = useCallback((updater: (prev: number) => number) => {
        setTodayMalas((prev) => {
            const newVal = updater(prev);
            AsyncStorage.setItem(STORAGE_KEYS.TODAY_MALAS, String(newVal));
            return newVal;
        });
    }, []);

    // Persist vibration
    const updateVibration = useCallback((value: boolean) => {
        setVibrationEnabled(value);
        AsyncStorage.setItem(STORAGE_KEYS.VIBRATION, String(value));
    }, []);

    // Persist auto change image
    const updateAutoChangeImage = useCallback((value: boolean) => {
        setAutoChangeImage(value);
        AsyncStorage.setItem(STORAGE_KEYS.AUTO_CHANGE_IMAGE, String(value));
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
            const remainder = prev % 108;
            const newVal = prev - remainder;
            AsyncStorage.setItem(STORAGE_KEYS.COUNT, String(newVal));
            // Also subtract remainder from today's count
            setTodayCount((tc) => {
                const newTc = Math.max(0, tc - remainder);
                AsyncStorage.setItem(STORAGE_KEYS.TODAY_COUNT, String(newTc));
                return newTc;
            });
            return newVal;
        });
    }, []);

    const resetAllMalas = useCallback(() => {
        setCount(0);
        setMalaCount(0);
        setTodayCount(0);
        setTodayMalas(0);
        AsyncStorage.multiSet([
            [STORAGE_KEYS.COUNT, '0'],
            [STORAGE_KEYS.MALA_COUNT, '0'],
            [STORAGE_KEYS.TODAY_COUNT, '0'],
            [STORAGE_KEYS.TODAY_MALAS, '0'],
        ]);
    }, []);

    // Restore counts from server data (after login / cache clear)
    const restoreFromServer = useCallback((totalCount: number, totalMalas: number, dailyCount: number, dailyMalas: number) => {
        setCount(totalCount);
        setMalaCount(totalMalas);
        setTodayCount(dailyCount);
        setTodayMalas(dailyMalas);
        const today = getTodayString();
        AsyncStorage.multiSet([
            [STORAGE_KEYS.COUNT, String(totalCount)],
            [STORAGE_KEYS.MALA_COUNT, String(totalMalas)],
            [STORAGE_KEYS.TODAY_COUNT, String(dailyCount)],
            [STORAGE_KEYS.TODAY_MALAS, String(dailyMalas)],
            [STORAGE_KEYS.TODAY_DATE, today],
        ]);
    }, []);

    return {
        count,
        malaCount,
        vibrationEnabled,
        displayMode,
        selectedImage,
        selectedTextStyle,
        todayCount,
        todayMalas,
        autoChangeImage,
        isLoaded,
        checkAndResetDaily,
        updateCount,
        updateMalaCount,
        updateTodayCount,
        updateTodayMalas,
        updateVibration,
        updateDisplayMode,
        updateSelectedImage,
        updateSelectedTextStyle,
        updateAutoChangeImage,
        resetCurrentMala,
        resetAllMalas,
        restoreFromServer,
    };
}
