import { useAppTheme } from '@/contexts/theme-context';
import { Image } from 'expo-image';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
    onFinish: () => void;
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
    const { theme } = useAppTheme();
    const logoScale = useRef(new Animated.Value(0.3)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(30)).current;
    const glowOpacity = useRef(new Animated.Value(0)).current;
    const fadeOut = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Sequence: logo fades in + scales → text slides up → glow pulse → fade out
        Animated.sequence([
            // Logo appears with scale
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    friction: 4,
                    tension: 40,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ]),
            // Text slides up
            Animated.parallel([
                Animated.timing(textOpacity, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(textTranslateY, {
                    toValue: 0,
                    duration: 600,
                    useNativeDriver: true,
                }),
            ]),
            // Glow effect
            Animated.sequence([
                Animated.timing(glowOpacity, {
                    toValue: 0.6,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(glowOpacity, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]),
            // Hold for a moment
            Animated.delay(500),
            // Fade out everything
            Animated.timing(fadeOut, {
                toValue: 0,
                duration: 500,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onFinish();
        });
    }, []);

    return (
        <Animated.View style={[styles.container, { opacity: fadeOut, backgroundColor: theme.bgCream }]}>
            {/* Glow circle behind logo */}
            <Animated.View
                style={[
                    styles.glow,
                    { opacity: glowOpacity, backgroundColor: theme.accent },
                ]}
            />

            {/* Logo */}
            <Animated.View
                style={[
                    styles.logoContainer,
                    {
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                    },
                ]}
            >
                <Image
                    source={require('@/assets/images/shree-ji-logo.png')}
                    style={styles.logo}
                    contentFit="contain"
                />
            </Animated.View>

            {/* App Name */}
            <Animated.Text
                style={[
                    styles.appName,
                    {
                        color: theme.accent,
                        opacity: textOpacity,
                        transform: [{ translateY: textTranslateY }],
                    },
                ]}
            >
                श्री जी
            </Animated.Text>

            <Animated.Text
                style={[
                    styles.tagline,
                    {
                        color: theme.subText,
                        opacity: textOpacity,
                        transform: [{ translateY: textTranslateY }],
                    },
                ]}
            >
                जय श्री राधे
            </Animated.Text>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    glow: {
        position: 'absolute',
        width: 280,
        height: 280,
        borderRadius: 140,
    },
    logoContainer: {
        width: 200,
        height: 200,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 200,
        height: 200,
    },
    appName: {
        fontSize: 36,
        fontWeight: 'bold',
        marginTop: 20,
        letterSpacing: 2,
    },
    tagline: {
        fontSize: 16,
        marginTop: 8,
        fontStyle: 'italic',
    },
});
