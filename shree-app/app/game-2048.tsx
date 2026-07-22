import { useAppTheme } from '@/contexts/theme-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/auth-context';
import { fetchGameLeaderboard, submitGameScore, type GameLeaderboardEntry } from '@/services/api';
import { FlatList, Modal } from 'react-native';

const SOUND_KEY = '@game_2048_sound';
const GAME_ID = '2048';

const SOUND_SOURCES = {
    move: require('@/assets/sounds/move.mp3'),
    merge: require('@/assets/sounds/merge.mp3'),
    gameover: require('@/assets/sounds/gameover.mp3'),
};

const SIZE = 4;
const { width } = Dimensions.get('window');
const BOARD_SIZE = Math.min(width - 24, 380);
const GAP = 8;
const TILE_SIZE = (BOARD_SIZE - GAP * (SIZE + 1)) / SIZE;

type Board = number[][];

function emptyBoard(): Board {
    return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(b: Board): Board {
    const empties: [number, number][] = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r][c] === 0) empties.push([r, c]);
    if (empties.length === 0) return b;
    const [r, c] = empties[Math.floor(Math.random() * empties.length)];
    const nb = b.map((row) => row.slice());
    nb[r][c] = Math.random() < 0.9 ? 2 : 4;
    return nb;
}

function newGame(): Board {
    return addRandom(addRandom(emptyBoard()));
}

function slideRow(row: number[]): { row: number[]; gained: number } {
    const filtered = row.filter((v) => v !== 0);
    let gained = 0;
    for (let i = 0; i < filtered.length - 1; i++) {
        if (filtered[i] === filtered[i + 1]) {
            filtered[i] *= 2;
            gained += filtered[i];
            filtered.splice(i + 1, 1);
        }
    }
    while (filtered.length < SIZE) filtered.push(0);
    return { row: filtered, gained };
}

function rotateCW(b: Board): Board {
    const nb = emptyBoard();
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) nb[c][SIZE - 1 - r] = b[r][c];
    return nb;
}

function move(b: Board, dir: 'left' | 'right' | 'up' | 'down'): { board: Board; gained: number; moved: boolean } {
    let rotations = 0;
    if (dir === 'up') rotations = 3;
    else if (dir === 'right') rotations = 2;
    else if (dir === 'down') rotations = 1;
    let work = b;
    for (let i = 0; i < rotations; i++) work = rotateCW(work);
    let gained = 0;
    const nb = work.map((row) => {
        const res = slideRow(row);
        gained += res.gained;
        return res.row;
    });
    let out = nb;
    for (let i = 0; i < (4 - rotations) % 4; i++) out = rotateCW(out);
    const moved = JSON.stringify(out) !== JSON.stringify(b);
    return { board: out, gained, moved };
}

function isGameOver(b: Board): boolean {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (b[r][c] === 0) return false;
        if (c < SIZE - 1 && b[r][c] === b[r][c + 1]) return false;
        if (r < SIZE - 1 && b[r][c] === b[r + 1][c]) return false;
    }
    return true;
}

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
    0: { bg: 'rgba(0,0,0,0.06)', fg: 'transparent' },
    2: { bg: '#EEE4DA', fg: '#776E65' },
    4: { bg: '#EDE0C8', fg: '#776E65' },
    8: { bg: '#F2B179', fg: '#FFFFFF' },
    16: { bg: '#F59563', fg: '#FFFFFF' },
    32: { bg: '#F67C5F', fg: '#FFFFFF' },
    64: { bg: '#F65E3B', fg: '#FFFFFF' },
    128: { bg: '#EDCF72', fg: '#FFFFFF' },
    256: { bg: '#EDCC61', fg: '#FFFFFF' },
    512: { bg: '#EDC850', fg: '#FFFFFF' },
    1024: { bg: '#EDC53F', fg: '#FFFFFF' },
    2048: { bg: '#EDC22E', fg: '#FFFFFF' },
};

export default function Game2048Screen() {
    const { theme } = useAppTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user } = useAuth();
    const [board, setBoard] = useState<Board>(() => newGame());
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [over, setOver] = useState(false);
    const [soundOn, setSoundOn] = useState(true);
    const [showBoard, setShowBoard] = useState(false);
    const [boardData, setBoardData] = useState<GameLeaderboardEntry[]>([]);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [boardLoading, setBoardLoading] = useState(false);
    const submittedRef = useRef(false);
    const playersRef = useRef<{ move?: AudioPlayer; merge?: AudioPlayer; gameover?: AudioPlayer }>({});

    useEffect(() => {
        AsyncStorage.getItem(SOUND_KEY).then((v) => {
            if (v === '0') setSoundOn(false);
        });
        setAudioModeAsync({ playsInSilentMode: true }).catch(() => { });
        try {
            playersRef.current.move = createAudioPlayer(SOUND_SOURCES.move);
            playersRef.current.merge = createAudioPlayer(SOUND_SOURCES.merge);
            playersRef.current.gameover = createAudioPlayer(SOUND_SOURCES.gameover);
            playersRef.current.move.volume = 0.4;
            playersRef.current.merge.volume = 0.6;
            playersRef.current.gameover.volume = 0.7;
        } catch { }
        return () => {
            Object.values(playersRef.current).forEach((p) => { try { p?.remove(); } catch { } });
            playersRef.current = {};
        };
    }, []);

    const play = useCallback((k: 'move' | 'merge' | 'gameover') => {
        if (!soundOn) return;
        const p = playersRef.current[k];
        if (!p) return;
        try { p.seekTo(0); p.play(); } catch { }
    }, [soundOn]);

    const toggleSound = useCallback(() => {
        setSoundOn((s) => {
            const next = !s;
            AsyncStorage.setItem(SOUND_KEY, next ? '1' : '0').catch(() => { });
            return next;
        });
    }, []);

    const doMove = useCallback((dir: 'left' | 'right' | 'up' | 'down') => {
        setBoard((prev) => {
            const { board: nb, gained, moved } = move(prev, dir);
            if (!moved) return prev;
            const withNew = addRandom(nb);
            if (gained > 0) {
                play('merge');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
            } else {
                play('move');
                Haptics.selectionAsync().catch(() => { });
            }
            setScore((s) => {
                const ns = s + gained;
                setBest((b) => (ns > b ? ns : b));
                return ns;
            });
            if (isGameOver(withNew)) {
                setOver(true);
                play('gameover');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
                setScore((s) => {
                    if (!submittedRef.current && user?.deviceId && s > 0) {
                        submittedRef.current = true;
                        submitGameScore(user.deviceId, GAME_ID, s).catch(() => { });
                    }
                    return s;
                });
            }
            return withNew;
        });
    }, [play, user?.deviceId]);

    const reset = useCallback(() => {
        setBoard(newGame());
        setScore(0);
        setOver(false);
        submittedRef.current = false;
    }, []);

    const openLeaderboard = useCallback(async () => {
        setShowBoard(true);
        setBoardLoading(true);
        const r = await fetchGameLeaderboard(GAME_ID, user?.deviceId, 100);
        setBoardData(r?.leaderboard || []);
        setMyRank(r?.me?.rank ?? null);
        setBoardLoading(false);
    }, [user?.deviceId]);

    const pan = useMemo(
        () =>
            Gesture.Pan()
                .minDistance(20)
                .onEnd((e) => {
                    const { translationX: x, translationY: y } = e;
                    if (Math.abs(x) < 20 && Math.abs(y) < 20) return;
                    if (Math.abs(x) > Math.abs(y)) {
                        runOnJS(doMove)(x > 0 ? 'right' : 'left');
                    } else {
                        runOnJS(doMove)(y > 0 ? 'down' : 'up');
                    }
                }),
        [doMove],
    );

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.bgCream }}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />
            <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={24} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.headerText }]}>2048</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={openLeaderboard} hitSlop={10}>
                        <Ionicons name="trophy" size={22} color={theme.headerText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleSound} hitSlop={10}>
                        <Ionicons
                            name={soundOn ? 'volume-high' : 'volume-mute'}
                            size={22}
                            color={theme.headerText}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={reset} hitSlop={10}>
                        <Ionicons name="refresh" size={22} color={theme.headerText} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.scoresRow}>
                    <View style={[styles.scoreBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.scoreLabel, { color: theme.subText }]}>SCORE</Text>
                        <Text style={[styles.scoreValue, { color: theme.accent }]}>{score}</Text>
                    </View>
                    <View style={[styles.scoreBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.scoreLabel, { color: theme.subText }]}>BEST</Text>
                        <Text style={[styles.scoreValue, { color: theme.accent }]}>{best}</Text>
                    </View>
                </View>

                <GestureDetector gesture={pan}>
                    <View style={[styles.board, { backgroundColor: theme.mutedBg }]}>
                        {board.map((row, r) => (
                            <View key={r} style={styles.row}>
                                {row.map((val, c) => {
                                    const colors = TILE_COLORS[val] || { bg: '#3C3A32', fg: '#FFFFFF' };
                                    return (
                                        <View
                                            key={c}
                                            style={[styles.tile, { backgroundColor: colors.bg }]}
                                        >
                                            {val !== 0 && (
                                                <Text
                                                    style={[
                                                        styles.tileText,
                                                        {
                                                            color: colors.fg,
                                                            fontSize: val >= 1024 ? 20 : val >= 128 ? 24 : 28,
                                                        },
                                                    ]}
                                                >
                                                    {val}
                                                </Text>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>
                </GestureDetector>

                <Text style={[styles.hint, { color: theme.subText }]}>
                    Swipe to move tiles. Combine same numbers to reach 2048!
                </Text>

                {over && (
                    <View style={[styles.overBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                        <Text style={[styles.overText, { color: theme.text }]}>Game Over</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={reset}
                                style={[styles.newBtn, { backgroundColor: theme.accent }]}
                            >
                                <Text style={styles.newBtnText}>New Game</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={openLeaderboard}
                                style={[styles.newBtn, { backgroundColor: '#333' }]}
                            >
                                <Text style={styles.newBtnText}>Leaderboard</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            <Modal visible={showBoard} animationType="slide" transparent onRequestClose={() => setShowBoard(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                    <View style={{
                        backgroundColor: theme.cardBg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
                        paddingHorizontal: 12, paddingTop: 14, paddingBottom: 24, maxHeight: '80%',
                    }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>2048 Leaderboard</Text>
                            <TouchableOpacity onPress={() => setShowBoard(false)} hitSlop={10}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        {myRank != null && (
                            <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.accent + '22', marginBottom: 10 }}>
                                <Ionicons name="person" size={14} color={theme.accent} />
                                <Text style={{ color: theme.accent, fontWeight: '800', marginLeft: 6 }}>Your Rank: #{myRank}</Text>
                            </View>
                        )}
                        {boardLoading ? (
                            <Text style={{ color: theme.subText, textAlign: 'center', paddingVertical: 24 }}>Loading…</Text>
                        ) : boardData.length === 0 ? (
                            <Text style={{ color: theme.subText, textAlign: 'center', paddingVertical: 24 }}>Be the first to set a score!</Text>
                        ) : (
                            <FlatList
                                data={boardData}
                                keyExtractor={(it) => it.deviceId}
                                renderItem={({ item }) => {
                                    const mine = item.deviceId === user?.deviceId;
                                    const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : item.rank === 3 ? '🥉' : null;
                                    return (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4, backgroundColor: mine ? theme.accent + '15' : 'transparent' }}>
                                            <Text style={{ width: 40, fontSize: 15, fontWeight: '800', color: theme.text }}>{medal || `#${item.rank}`}</Text>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }} numberOfLines={1}>{item.name || 'Guest'}</Text>
                                                {!!item.city && <Text style={{ fontSize: 11, marginTop: 1, color: theme.subText }} numberOfLines={1}>{item.city}</Text>}
                                            </View>
                                            <Text style={{ fontSize: 16, fontWeight: '900', color: theme.accent }}>{item.bestScore}</Text>
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    title: { fontSize: 20, fontWeight: '800' },
    content: { flex: 1, alignItems: 'center', paddingTop: 12 },
    scoresRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    scoreBox: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        alignItems: 'center',
        minWidth: 100,
    },
    scoreLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    scoreValue: { fontSize: 20, fontWeight: '800' },
    board: {
        width: BOARD_SIZE,
        height: BOARD_SIZE,
        borderRadius: 10,
        padding: GAP,
    },
    row: { flexDirection: 'row', flex: 1 },
    tile: {
        width: TILE_SIZE,
        height: TILE_SIZE,
        margin: GAP / 2,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tileText: { fontWeight: '800' },
    hint: { marginTop: 14, fontSize: 12, textAlign: 'center', paddingHorizontal: 20 },
    overBox: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    overText: { fontSize: 18, fontWeight: '800', marginBottom: 10 },
    newBtn: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 999 },
    newBtnText: { color: '#fff', fontWeight: '800' },
});