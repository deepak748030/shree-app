import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = '@app_theme';

export interface ThemeColors {
    id: string;
    isDark: boolean;
    headerBg: string;
    headerText: string;
    bgCream: string;
    accent: string;
    cardBg: string;
    cardBorder: string;
    primary: string;
    text: string;
    subText: string;
    mutedBg: string;
    divider: string;
}

// Helper to build a theme entry concisely
const make = (
    id: string,
    isDark: boolean,
    headerBg: string,
    bgCream: string,
    accent: string,
    cardBorder: string,
    primary: string,
    cardBg?: string,
): ThemeColors => ({
    id,
    isDark,
    headerBg,
    headerText: isDark ? '#F5F5F5' : '#1A1A1A',
    bgCream,
    accent,
    cardBorder,
    primary,
    cardBg: cardBg ?? (isDark ? '#1A1A1A' : '#FFFFFF'),
    text: isDark ? '#F5F5F5' : '#1A1A1A',
    subText: isDark ? '#B5B5B5' : '#666666',
    mutedBg: isDark ? '#222222' : '#F4F4F4',
    divider: isDark ? '#2A2A2A' : '#E5E5E5',
});

export const THEME_OPTIONS: ThemeColors[] = [
    make('dark', true, '#1A1A1A', '#0D0D0D', '#F2A03D', '#2A2A2A', '#F2A03D'),
    make('yellow', false, '#FFEB3B', '#FFFDE7', '#B8860B', '#FFD54F', '#D4A017'),
    make('saffron', false, '#FF9800', '#FFF3E0', '#E65100', '#FFB74D', '#FF9800'),
    make('lotus', false, '#F48FB1', '#FCE4EC', '#C2185B', '#F48FB1', '#E91E63'),
    make('peacock', false, '#4FC3F7', '#E1F5FE', '#0277BD', '#4FC3F7', '#0288D1'),
    make('tulsi', false, '#81C784', '#E8F5E9', '#2E7D32', '#81C784', '#388E3C'),
    make('sandal', false, '#D7CCC8', '#EFEBE9', '#5D4037', '#BCAAA4', '#795548'),
];

interface ThemeContextType {
    theme: ThemeColors;
    themeId: string;
    setThemeId: (id: string) => Promise<void>;
    loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: THEME_OPTIONS[0],
    themeId: 'dark',
    setThemeId: async () => { },
    loading: true,
});

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
    const [themeId, setThemeIdState] = useState('dark');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(THEME_KEY)
            .then((saved) => {
                if (saved) setThemeIdState(saved);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const setThemeId = async (id: string) => {
        await AsyncStorage.setItem(THEME_KEY, id);
        setThemeIdState(id);
    };

    const theme = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];

    return (
        <ThemeContext.Provider value={{ theme, themeId, setThemeId, loading }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useAppTheme = () => useContext(ThemeContext);
