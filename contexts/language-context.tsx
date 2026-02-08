import { translations, type TranslationKeys } from '@/constants/translations';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

const LANGUAGE_KEY = '@app_language';

export type Language = 'hi' | 'en';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => Promise<void>;
    t: (key: TranslationKeys) => string;
    loading: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
    language: 'hi',
    setLanguage: async () => { },
    t: (key) => key,
    loading: true,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [language, setLangState] = useState<Language>('hi');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem(LANGUAGE_KEY)
            .then((saved) => {
                if (saved === 'en' || saved === 'hi') setLangState(saved);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const setLanguage = async (lang: Language) => {
        await AsyncStorage.setItem(LANGUAGE_KEY, lang);
        setLangState(lang);
    };

    const t = (key: TranslationKeys): string => {
        return translations[language]?.[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
            {children}
        </LanguageContext.Provider>
    );
}

export const useLanguage = () => useContext(LanguageContext);
