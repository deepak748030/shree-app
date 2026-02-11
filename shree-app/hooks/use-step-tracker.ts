import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

const STEP_DATA_KEY = '@step_tracker_data';
const STEP_GOAL_KEY = '@step_tracker_goal';
const STEPS_PER_KM = 1350;
const CALORIES_PER_STEP = 0.04;

interface StepData {
    date: string;
    steps: number;
}

function getTodayStr() {
    return new Date().toISOString().split('T')[0];
}

async function getPedometerModule() {
    try {
        const mod = await import('expo-sensors');
        if (mod?.Pedometer) return mod.Pedometer;
    } catch { }
    return null;
}

export function useStepTracker() {
    const [todaySteps, setTodaySteps] = useState(0);
    const [dailyGoal, setDailyGoal] = useState(5000);
    const [isAvailable, setIsAvailable] = useState(false);
    const [loading, setLoading] = useState(true);
    const subscriptionRef = useRef<{ remove: () => void } | null>(null);
    const baseStepsRef = useRef(0);

    const distance = parseFloat((todaySteps / STEPS_PER_KM).toFixed(2));
    const calories = Math.round(todaySteps * CALORIES_PER_STEP);
    const progress = dailyGoal > 0 ? Math.min(todaySteps / dailyGoal, 1) : 0;

    // Load saved data
    useEffect(() => {
        (async () => {
            try {
                const [savedData, savedGoal] = await Promise.all([
                    AsyncStorage.getItem(STEP_DATA_KEY),
                    AsyncStorage.getItem(STEP_GOAL_KEY),
                ]);
                if (savedGoal) setDailyGoal(parseInt(savedGoal, 10));
                if (savedData) {
                    const parsed: StepData = JSON.parse(savedData);
                    if (parsed.date === getTodayStr()) {
                        setTodaySteps(parsed.steps);
                        baseStepsRef.current = parsed.steps;
                    }
                }
            } catch { }
            setLoading(false);
        })();
    }, []);

    // Start pedometer
    useEffect(() => {
        let sub: { remove: () => void } | null = null;

        (async () => {
            try {
                const Pedometer = await getPedometerModule();
                if (!Pedometer) {
                    setIsAvailable(false);
                    return;
                }
                const available = await Pedometer.isAvailableAsync();
                setIsAvailable(available);
                if (!available) return;

                const start = new Date();
                start.setHours(0, 0, 0, 0);
                const end = new Date();

                try {
                    const result = await Pedometer.getStepCountAsync(start, end);
                    if (result?.steps) {
                        setTodaySteps(result.steps);
                        saveTodaySteps(result.steps);
                    }
                } catch { }

                sub = Pedometer.watchStepCount((result: any) => {
                    const savedBase = baseStepsRef.current;
                    setTodaySteps(() => {
                        const newSteps = savedBase + result.steps;
                        saveTodaySteps(newSteps);
                        return newSteps;
                    });
                });
                subscriptionRef.current = sub;
            } catch {
                setIsAvailable(false);
            }
        })();

        return () => { sub?.remove(); };
    }, []);

    // Re-fetch on app foreground
    useEffect(() => {
        const listener = AppState.addEventListener('change', async (state) => {
            if (state === 'active') {
                try {
                    const Pedometer = await getPedometerModule();
                    if (!Pedometer) return;
                    const start = new Date();
                    start.setHours(0, 0, 0, 0);
                    const end = new Date();
                    const result = await Pedometer.getStepCountAsync(start, end);
                    if (result?.steps) {
                        setTodaySteps(result.steps);
                        baseStepsRef.current = result.steps;
                        saveTodaySteps(result.steps);
                    }
                } catch { }
            }
        });
        return () => listener.remove();
    }, []);

    const saveTodaySteps = useCallback(async (steps: number) => {
        try {
            const data: StepData = { date: getTodayStr(), steps };
            await AsyncStorage.setItem(STEP_DATA_KEY, JSON.stringify(data));
        } catch { }
    }, []);

    const updateGoal = useCallback(async (goal: number) => {
        setDailyGoal(goal);
        await AsyncStorage.setItem(STEP_GOAL_KEY, goal.toString());
    }, []);

    const restoreFromServer = useCallback((serverData: {
        todaySteps: number;
        dailyGoal: number;
    }) => {
        setTodaySteps(serverData.todaySteps);
        setDailyGoal(serverData.dailyGoal);
        baseStepsRef.current = serverData.todaySteps;
        saveTodaySteps(serverData.todaySteps);
        AsyncStorage.setItem(STEP_GOAL_KEY, serverData.dailyGoal.toString());
    }, [saveTodaySteps]);

    return {
        todaySteps,
        distance,
        calories,
        dailyGoal,
        progress,
        isAvailable,
        loading,
        updateGoal,
        restoreFromServer,
    };
}
