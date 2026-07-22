import { useAuth } from '@/contexts/auth-context';
import { useAppTheme } from '@/contexts/theme-context';
import { fetchGameLeaderboard, submitGameScore, type GameLeaderboardEntry } from '@/services/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GAME_ID = 'bubble-smash';
const HP = 6;
const BEST_KEY = '@game_bubble_best';
const SOUND_KEY = '@game_bubble_sound';

const SOUND_SOURCES = {
    pop: require('@/assets/sounds/merge.mp3'),
    miss: require('@/assets/sounds/move.mp3'),
    over: require('@/assets/sounds/gameover.mp3'),
};

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const TICK_MS = 32;

const BUBBLE_COLORS = ['#4FC3F7', '#E91E63', '#FFB74D', '#81C784', '#BA68C8', '#F06292', '#4DD0E1', '#FF8A65'];

interface Bubble {
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    color: string;
    bomb: boolean;
}

export default function GameBubbleSmash() {
    const { theme } = useAppTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { user } = useAuth();

    const [playAreaW, setPlayAreaW] = useState(SCREEN_W - HP * 2);
    const [playAreaH, setPlayAreaH] = useState(SCREEN_H - 240);
    const [bubbles, setBubbles] = useState<Bubble[]>([]);
    const [score, setScore] = useState(0);
    const [best, setBest] = useState(0);
    const [lives, setLives] = useState(3);
    const [running, setRunning] = useState(false);
    const [over, setOver] = useState(false);
    const [soundOn, setSoundOn] = useState(true);
    const [showBoard, setShowBoard] = useState(false);
    const [boardData, setBoardData] = useState<GameLeaderboardEntry[]>([]);
    const [myRank, setMyRank] = useState<number | null>(null);
    const [boardLoading, setBoardLoading] = useState(false);

    const bubblesRef = useRef<Bubble[]>([]);
    const areaRef = useRef({ w: playAreaW, h: playAreaH });
    const idRef = useRef(1);
    const tickRef = useRef<any>(null);
    const spawnAccRef = useRef(0);
    const spawnEveryRef = useRef(18);
    const speedRef = useRef(1.6);
    const scoreRef = useRef(0);
    const livesRef = useRef(3);
    const submittedRef = useRef(false);
    const playersRef = useRef<{ [k: string]: AudioPlayer }>({});

    useEffect(() => { areaRef.current = { w: playAreaW, h: playAreaH }; }, [playAreaW, playAreaH]);
    useEffect(() => { scoreRef.current = score; }, [score]);
    useEffect(() => { livesRef.current = lives; }, [lives]);

    useEffect(() => {
        (async () => {
            const [b, s] = await Promise.all([
                AsyncStorage.getItem(BEST_KEY),
                AsyncStorage.getItem(SOUND_KEY),
            ]);
            if (b) setBest(parseInt(b) || 0);
            if (s !== null) setSoundOn(s === '1');
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                await setAudioModeAsync({ playsInSilentMode: true });
                (Object.keys(SOUND_SOURCES) as (keyof typeof SOUND_SOURCES)[]).forEach((k) => {
                    try {
                        const p = createAudioPlayer(SOUND_SOURCES[k]);
                        p.volume = 0.7;
                        playersRef.current[k] = p;
                    } catch { }
                });
            } catch { }
        })();
        return () => {
            Object.values(playersRef.current).forEach((p) => { try { p.remove(); } catch { } });
            playersRef.current = {};
            if (tickRef.current) clearInterval(tickRef.current);
        };
    }, []);

    const play = useCallback((k: 'pop' | 'miss' | 'over') => {
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

    const submitFinalScore = useCallback(async (finalScore: number) => {
        if (submittedRef.current) return;
        submittedRef.current = true;
        if (finalScore > best) {
            setBest(finalScore);
            AsyncStorage.setItem(BEST_KEY, String(finalScore)).catch(() => { });
        }
        if (user?.deviceId && finalScore > 0) {
            await submitGameScore(user.deviceId, GAME_ID, finalScore);
        }
    }, [best, user?.deviceId]);

    const endGame = useCallback(() => {
        setRunning(false);
        setOver(true);
        if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        play('over');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
        submitFinalScore(scoreRef.current);
    }, [play, submitFinalScore]);

    const startGame = useCallback(() => {
        setBubbles([]);
        bubblesRef.current = [];
        setScore(0); scoreRef.current = 0;
        setLives(3); livesRef.current = 3;
        setOver(false);
        submittedRef.current = false;
        speedRef.current = 1.8;
        spawnEveryRef.current = 18;
        spawnAccRef.current = 0;
        setRunning(true);
    }, []);

    // Game loop — bubbles rise from bottom to top
    useEffect(() => {
        if (!running) return;
        if (tickRef.current) clearInterval(tickRef.current);
        tickRef.current = setInterval(() => {
            const { w, h } = areaRef.current;

            spawnAccRef.current += 1;
            const cur = bubblesRef.current.slice();
            if (spawnAccRef.current >= spawnEveryRef.current) {
                spawnAccRef.current = 0;
                const size = 44 + Math.floor(Math.random() * 26);
                const x = Math.random() * Math.max(0, w - size);
                const bomb = Math.random() < 0.1; // 10% bomb
                cur.push({
                    id: idRef.current++,
                    x,
                    y: h + size,
                    size,
                    speed: speedRef.current * (0.85 + Math.random() * 0.5),
                    color: bomb ? '#212121' : BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)],
                    bomb,
                });
            }

            let escaped = 0;
            const next: Bubble[] = [];
            for (const b of cur) {
                const ny = b.y - b.speed;
                if (ny + b.size < 0) {
                    if (!b.bomb) escaped += 1; // missed non-bomb = life lost
                    continue;
                }
                next.push({ ...b, y: ny });
            }
            bubblesRef.current = next;
            setBubbles(next);

            if (escaped > 0) {
                play('miss');
                setLives((l) => {
                    const nl = Math.max(0, l - escaped);
                    livesRef.current = nl;
                    if (nl <= 0) setTimeout(() => endGame(), 0);
                    return nl;
                });
            }
        }, TICK_MS);
        return () => {
            if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
        };
    }, [running, endGame, play]);

    const popBubble = useCallback((b: Bubble) => {
        if (!running) return;
        // remove
        bubblesRef.current = bubblesRef.current.filter((x) => x.id !== b.id);
        setBubbles(bubblesRef.current);
        if (b.bomb) {
            play('over');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
            setTimeout(() => endGame(), 0);
            return;
        }
        play('pop');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        setScore((s) => {
            const ns = s + 1;
            scoreRef.current = ns;
            if (ns > 0 && ns % 10 === 0) {
                speedRef.current = Math.min(5.5, speedRef.current + 0.3);
                spawnEveryRef.current = Math.max(7, spawnEveryRef.current - 1);
            }
            return ns;
        });
    }, [running, play, endGame]);

    const openLeaderboard = useCallback(async () => {
        setShowBoard(true);
        setBoardLoading(true);
        const r = await fetchGameLeaderboard(GAME_ID, user?.deviceId, 100);
        setBoardData(r?.leaderboard || []);
        setMyRank(r?.me?.rank ?? null);
        setBoardLoading(false);
    }, [user?.deviceId]);

    const HeartRow = useMemo(() => (
        <View style={{ flexDirection: 'row', gap: 4 }}>
            {[0, 1, 2].map((i) => (
                <Ionicons
                    key={i}
                    name={i < lives ? 'heart' : 'heart-outline'}
                    size={18}
                    color={i < lives ? '#E53935' : theme.subText}
                />
            ))}
        </View>
    ), [lives, theme.subText]);

    return (
        <View style={[styles.container, { backgroundColor: theme.bgCream }]}>
            <StatusBar style={theme.isDark ? 'light' : 'dark'} backgroundColor={theme.headerBg} translucent={false} />
            <View style={{ height: insets.top, backgroundColor: theme.headerBg }} />

            <View style={[styles.header, { backgroundColor: theme.headerBg }]}>
                <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
                    <Ionicons name="arrow-back" size={24} color={theme.headerText} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.headerText }]} numberOfLines={1}>Bubble Smash</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <TouchableOpacity onPress={openLeaderboard} hitSlop={10}>
                        <Ionicons name="trophy" size={22} color={theme.headerText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={toggleSound} hitSlop={10}>
                        <Ionicons name={soundOn ? 'volume-high' : 'volume-mute'} size={22} color={theme.headerText} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={startGame} hitSlop={10}>
                        <Ionicons name="refresh" size={22} color={theme.headerText} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.statsRow}>
                <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>SCORE</Text>
                    <Text style={[styles.statValue, { color: theme.accent }]}>{score}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder }]}>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>BEST</Text>
                    <Text style={[styles.statValue, { color: theme.accent }]}>{best}</Text>
                </View>
                <View style={[styles.statBox, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, alignItems: 'center' }]}>
                    <Text style={[styles.statLabel, { color: theme.subText }]}>LIVES</Text>
                    {HeartRow}
                </View>
            </View>

            <View
                style={[styles.playArea, { backgroundColor: theme.isDark ? '#0d1b2a' : '#E1F5FE' }]}
                onLayout={(e) => {
                    const { width: w, height: h } = e.nativeEvent.layout;
                    setPlayAreaW(w);
                    setPlayAreaH(h);
                }}
            >
                {bubbles.map((b) => (
                    <TouchableOpacity
                        key={b.id}
                        activeOpacity={0.7}
                        onPress={() => popBubble(b)}
                        style={{
                            position: 'absolute',
                            left: b.x,
                            top: b.y,
                            width: b.size,
                            height: b.size,
                            borderRadius: b.size / 2,
                            backgroundColor: b.color,
                            borderWidth: 2,
                            borderColor: b.bomb ? '#B71C1C' : 'rgba(255,255,255,0.7)',
                            alignItems: 'center',
                            justifyContent: 'center',
                            shadowColor: b.color,
                            shadowOpacity: 0.4,
                            shadowRadius: 6,
                            shadowOffset: { width: 0, height: 2 },
                            elevation: 3,
                        }}
                    >
                        {b.bomb ? (
                            <Ionicons name="skull" size={b.size * 0.5} color="#fff" />
                        ) : (
                            <View style={{
                                position: 'absolute',
                                top: b.size * 0.18,
                                left: b.size * 0.22,
                                width: b.size * 0.25,
                                height: b.size * 0.18,
                                borderRadius: b.size * 0.12,
                                backgroundColor: 'rgba(255,255,255,0.55)',
                            }} />
                        )}
                    </TouchableOpacity>
                ))}

                {!running && !over && (
                    <View style={styles.centerOverlay}>
                        <View style={styles.centerCard}>
                            <Text style={styles.centerTitle}>Bubble Smash 💥</Text>
                            <Text style={styles.centerSub}>Tap the rising bubbles to pop them. Avoid the black skull bubbles — one tap and it&apos;s game over!</Text>
                            <TouchableOpacity style={[styles.playBtn, { backgroundColor: theme.accent }]} onPress={startGame}>
                                <Ionicons name="play" size={18} color="#fff" />
                                <Text style={styles.playBtnText}>Start</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {over && (
                    <View style={styles.centerOverlay}>
                        <View style={styles.centerCard}>
                            <Text style={styles.centerTitle}>Game Over</Text>
                            <Text style={styles.centerSub}>Score: {score}   •   Best: {best}</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                                <TouchableOpacity style={[styles.playBtn, { backgroundColor: theme.accent }]} onPress={startGame}>
                                    <Ionicons name="refresh" size={18} color="#fff" />
                                    <Text style={styles.playBtnText}>Play Again</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.playBtn, { backgroundColor: '#333' }]} onPress={openLeaderboard}>
                                    <Ionicons name="trophy" size={18} color="#fff" />
                                    <Text style={styles.playBtnText}>Leaderboard</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                )}
            </View>

            <Modal visible={showBoard} animationType="slide" transparent onRequestClose={() => setShowBoard(false)}>
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalSheet, { backgroundColor: theme.cardBg }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: theme.text }]}>Bubble Smash Leaderboard</Text>
                            <TouchableOpacity onPress={() => setShowBoard(false)} hitSlop={10}>
                                <Ionicons name="close" size={24} color={theme.text} />
                            </TouchableOpacity>
                        </View>
                        {myRank != null && (
                            <View style={[styles.myRankChip, { backgroundColor: theme.accent + '22' }]}>
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
                                        <View style={[styles.row, { backgroundColor: mine ? theme.accent + '15' : 'transparent' }]}>
                                            <Text style={[styles.rowRank, { color: theme.text }]}>{medal || `#${item.rank}`}</Text>
                                            <View style={{ flex: 1, marginLeft: 10 }}>
                                                <Text style={[styles.rowName, { color: theme.text }]} numberOfLines={1}>{item.name || 'Guest'}</Text>
                                                {!!item.city && (
                                                    <Text style={[styles.rowCity, { color: theme.subText }]} numberOfLines={1}>{item.city}</Text>
                                                )}
                                            </View>
                                            <Text style={[styles.rowScore, { color: theme.accent }]}>{item.bestScore}</Text>
                                        </View>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: HP * 2, paddingVertical: 10,
    },
    title: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 10 },
    statsRow: { flexDirection: 'row', gap: HP, paddingHorizontal: HP, paddingTop: HP },
    statBox: {
        flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1,
    },
    statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
    statValue: { fontSize: 20, fontWeight: '800' },
    playArea: { flex: 1, margin: HP, borderRadius: 14, overflow: 'hidden' },
    centerOverlay: {
        ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)', padding: 20,
    },
    centerCard: {
        backgroundColor: 'rgba(255,255,255,0.96)', padding: 20, borderRadius: 16,
        alignItems: 'center', maxWidth: 320,
    },
    centerTitle: { fontSize: 22, fontWeight: '900', color: '#0277BD', marginBottom: 8 },
    centerSub: { fontSize: 13, color: '#333', textAlign: 'center', lineHeight: 18 },
    playBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999, marginTop: 14,
    },
    playBtnText: { color: '#fff', fontWeight: '800' },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalSheet: {
        borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: HP * 2, paddingTop: 14,
        paddingBottom: 24, maxHeight: '80%',
    },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    modalTitle: { fontSize: 18, fontWeight: '800' },
    myRankChip: {
        alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, marginBottom: 10,
    },
    row: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, marginBottom: 4,
    },
    rowRank: { width: 40, fontSize: 15, fontWeight: '800' },
    rowName: { fontSize: 14, fontWeight: '700' },
    rowCity: { fontSize: 11, marginTop: 1 },
    rowScore: { fontSize: 16, fontWeight: '900' },
});