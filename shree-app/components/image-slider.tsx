import { Image } from 'expo-image';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, View } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const SLIDER_HEIGHT = 500;

const sliderImages = [
    require('@/assets/images/slider-1.png'),
    require('@/assets/images/slider-2.png'),
    require('@/assets/images/slider-3.png'),
    require('@/assets/images/slider-4.png'),
];

const AUTO_SCROLL_INTERVAL = 3000;

export default function ImageSlider() {
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startAutoScroll = useCallback(() => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setCurrentIndex((prev) => {
                const next = (prev + 1) % sliderImages.length;
                flatListRef.current?.scrollToIndex({ index: next, animated: true });
                return next;
            });
        }, AUTO_SCROLL_INTERVAL);
    }, []);

    useEffect(() => {
        startAutoScroll();
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [startAutoScroll]);

    const onScrollEnd = useCallback(
        (e: any) => {
            const offsetX = e.nativeEvent.contentOffset.x;
            const index = Math.round(offsetX / SCREEN_WIDTH);
            setCurrentIndex(index);
            startAutoScroll();
        },
        [startAutoScroll],
    );

    return (
        <View style={styles.container}>
            <FlatList
                ref={flatListRef}
                data={sliderImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onScrollEnd}
                keyExtractor={(_, i) => String(i)}
                getItemLayout={(_, index) => ({
                    length: SCREEN_WIDTH,
                    offset: SCREEN_WIDTH * index,
                    index,
                })}
                renderItem={({ item }) => (
                    <Image source={item} style={styles.image} contentFit="cover" />
                )}
            />
            {/* Dots */}
            <View style={styles.dotsRow}>
                {sliderImages.map((_, i) => (
                    <View
                        key={i}
                        style={[styles.dot, i === currentIndex && styles.dotActive]}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        height: SLIDER_HEIGHT,
    },
    image: {
        width: SCREEN_WIDTH,
        height: SLIDER_HEIGHT,
    },
    dotsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        bottom: 8,
        left: 0,
        right: 0,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.5)',
        marginHorizontal: 3,
    },
    dotActive: {
        backgroundColor: '#FFFFFF',
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});
