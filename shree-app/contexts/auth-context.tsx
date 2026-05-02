import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { type NaamJapUser, validateSession } from '@/services/api';

const AUTH_USER_KEY = '@auth_user';
const AUTH_MOBILE_KEY = '@auth_mobile';

interface AuthContextType {
    user: NaamJapUser | null;
    mobile: string | null;
    isLoggedIn: boolean;
    loading: boolean;
    setAuthUser: (user: NaamJapUser, mobile: string) => Promise<void>;
    updateAuthUser: (user: NaamJapUser) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    mobile: null,
    isLoggedIn: false,
    loading: true,
    setAuthUser: async () => { },
    updateAuthUser: async () => { },
    logout: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<NaamJapUser | null>(null);
    const [mobile, setMobile] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const [savedUser, savedMobile] = await Promise.all([
                    AsyncStorage.getItem(AUTH_USER_KEY),
                    AsyncStorage.getItem(AUTH_MOBILE_KEY),
                ]);

                if (savedUser && savedMobile) {
                    const parsedUser = JSON.parse(savedUser) as NaamJapUser;

                    // Basic local validation - check essential fields exist
                    if (!parsedUser.deviceId || !parsedUser.name || !parsedUser.mobile) {
                        await AsyncStorage.clear();
                        setUser(null);
                        setMobile(null);
                        setLoading(false);
                        return;
                    }

                    // Set cached data first so UI loads fast
                    setUser(parsedUser);
                    setMobile(savedMobile);

                    // Validate session with server
                    const result = await validateSession(savedMobile, parsedUser.deviceId);
                    if (!result.valid) {
                        // User deleted/deactivated on server - auto logout
                        await AsyncStorage.clear();
                        setUser(null);
                        setMobile(null);
                    } else if (result.user) {
                        // Verify server returned complete user data
                        if (!result.user.name || !result.user.mobile || !result.user.deviceId) {
                            await AsyncStorage.clear();
                            setUser(null);
                            setMobile(null);
                        } else {
                            // Update cached user with fresh server data
                            setUser(result.user);
                            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(result.user));
                        }
                    }
                } else if (savedUser || savedMobile) {
                    // Partial data - clear everything
                    await AsyncStorage.clear();
                }
            } catch { }
            setLoading(false);
        })();
    }, []);

    const setAuthUser = async (userData: NaamJapUser, mob: string) => {
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        await AsyncStorage.setItem(AUTH_MOBILE_KEY, mob);
        setUser(userData);
        setMobile(mob);
    };

    const updateAuthUser = async (userData: NaamJapUser) => {
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        setUser(userData);
    };

    const logout = async () => {
        await AsyncStorage.clear();
        setUser(null);
        setMobile(null);
    };

    return (
        <AuthContext.Provider value={{ user, mobile, isLoggedIn: !!user, loading, setAuthUser, updateAuthUser, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);