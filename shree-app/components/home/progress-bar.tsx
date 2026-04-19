import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ProgressBarProps {
    progress: number; // 0..1
    color: string;
    trackColor?: string;
    height?: number;
}

export default function ProgressBar({ progress, color, trackColor = '#EEE', height = 6 }: ProgressBarProps) {
    const pct = Math.min(Math.max(progress, 0), 1) * 100;
    return (
        <View style={[styles.track, { height, backgroundColor: trackColor }]}>
            <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color, height }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    track: { width: '100%', borderRadius: 999, overflow: 'hidden' },
    fill: { borderRadius: 999 },
});
