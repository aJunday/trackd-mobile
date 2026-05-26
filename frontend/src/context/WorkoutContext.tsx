/**
 * WorkoutContext — global state for an active workout session.
 *
 * Lets the workout screen mark "is_active=true" with a start timestamp,
 * and any other screen can read the running elapsed seconds + jump back
 * to the workout via the floating banner.
 */
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'trackd.active_workout';

interface ActiveWorkout {
  active: boolean;
  start_at?: number;          // epoch ms
  name?: string;
}

interface WorkoutCtx {
  active: boolean;
  startAt: number | null;
  name: string | null;
  elapsed: number;            // seconds since start_at
  startSession: (name?: string) => Promise<void>;
  endSession: () => Promise<void>;
}

const Ctx = createContext<WorkoutCtx | null>(null);

export const useActiveWorkout = (): WorkoutCtx => {
  const v = useContext(Ctx);
  if (!v) {
    return {
      active: false,
      startAt: null,
      name: null,
      elapsed: 0,
      startSession: async () => {},
      endSession: async () => {},
    };
  }
  return v;
};

export function WorkoutProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false);
  const [startAt, setStartAt] = useState<number | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef<any>(null);

  // Rehydrate from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const v: ActiveWorkout = JSON.parse(raw);
        if (v.active && v.start_at) {
          setActive(true);
          setStartAt(v.start_at);
          setName(v.name || null);
        }
      } catch {}
    })();
  }, []);

  // Tick every second while active
  useEffect(() => {
    if (active && startAt) {
      const update = () => setElapsed(Math.floor((Date.now() - startAt) / 1000));
      update();
      tickRef.current = setInterval(update, 1000);
      return () => {
        if (tickRef.current) clearInterval(tickRef.current);
      };
    } else {
      if (tickRef.current) clearInterval(tickRef.current);
      setElapsed(0);
    }
  }, [active, startAt]);

  const startSession = async (n?: string) => {
    const now = Date.now();
    setActive(true);
    setStartAt(now);
    setName(n || null);
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ active: true, start_at: now, name: n || null }),
      );
    } catch {}
  };

  const endSession = async () => {
    setActive(false);
    setStartAt(null);
    setName(null);
    setElapsed(0);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <Ctx.Provider value={{ active, startAt, name, elapsed, startSession, endSession }}>
      {children}
    </Ctx.Provider>
  );
}
