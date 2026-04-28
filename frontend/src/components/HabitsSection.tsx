/**
 * HabitsSection — local-only daily habit tracker shown on Dashboard.
 * Three habits with yes/no check per day:
 *   1. Sleep 7+ hours
 *   2. Hit water goal
 *   3. Hit 8000+ steps
 * Shows: today's toggle, weekly 7-day grid, current streak per habit.
 * Persisted to AsyncStorage (no backend — keep it simple per P3 spec).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ACCENT = '#F5A623';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const DONE = '#06D6A0';
const IDLE = '#2A2A2A';

const STORAGE_KEY = 'trackd.habits.v1';

type HabitId = 'sleep' | 'water' | 'steps';

const HABITS: { id: HabitId; label: string; icon: any; iconSet: 'ion' | 'mc' }[] = [
  { id: 'sleep', label: 'Sleep 7+ hours', icon: 'moon', iconSet: 'ion' },
  { id: 'water', label: 'Hit water goal', icon: 'water', iconSet: 'ion' },
  { id: 'steps', label: 'Hit 8000+ steps', icon: 'shoe-print', iconSet: 'mc' },
];

// Map of { 'YYYY-MM-DD': { sleep: bool, water: bool, steps: bool } }
type HabitStore = Record<string, Partial<Record<HabitId, boolean>>>;

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBack(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function computeStreak(store: HabitStore, id: HabitId): number {
  let streak = 0;
  const d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (store[key]?.[id]) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const haptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function HabitsSection() {
  const [store, setStore] = useState<HabitStore>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setStore(JSON.parse(raw));
      } catch {}
      setReady(true);
    })();
  }, []);

  const persist = useCallback(async (next: HabitStore) => {
    setStore(next);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
  }, []);

  const toggle = (id: HabitId) => {
    haptic();
    const t = today();
    const next: HabitStore = { ...store };
    next[t] = { ...(next[t] || {}) };
    next[t][id] = !next[t][id];
    persist(next);
  };

  const week = useMemo(() => daysBack(7), []);

  if (!ready) return null;

  const todayKey = today();

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Habits</Text>

      <View style={styles.card}>
        {HABITS.map((h, idx) => {
          const doneToday = !!store[todayKey]?.[h.id];
          const streak = computeStreak(store, h.id);
          const IconEl = h.iconSet === 'mc' ? MaterialCommunityIcons : Ionicons;
          return (
            <View key={h.id} style={[styles.habitRow, idx > 0 && styles.habitRowBorder]}>
              <View style={styles.habitHeader}>
                <View style={styles.habitLabelWrap}>
                  <View style={styles.habitIconWrap}>
                    <IconEl name={h.icon as any} size={16} color={ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.habitLabel}>{h.label}</Text>
                    {streak > 0 ? (
                      <View style={styles.streakPill}>
                        <Ionicons name="flame" size={11} color={ACCENT} />
                        <Text style={styles.streakTxt}>
                          {streak}-day streak
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.streakDim}>No streak yet</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  style={[
                    styles.checkBtn,
                    doneToday && { backgroundColor: DONE, borderColor: DONE },
                  ]}
                  onPress={() => toggle(h.id)}
                  activeOpacity={0.7}
                  hitSlop={12}
                  testID={`habit-toggle-${h.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: doneToday }}
                  accessibilityLabel={`${h.label} — ${doneToday ? 'done' : 'not done'}`}
                >
                  {doneToday ? (
                    <Ionicons name="checkmark" size={22} color="#000" />
                  ) : (
                    <Ionicons name="add" size={22} color={TEXT_MUTED} />
                  )}
                </TouchableOpacity>
              </View>

              {/* 7-day grid */}
              <View style={styles.weekGrid}>
                {week.map((d) => {
                  const done = !!store[d]?.[h.id];
                  const isToday = d === todayKey;
                  return (
                    <View
                      key={d}
                      style={[
                        styles.dot,
                        { backgroundColor: done ? DONE : IDLE },
                        isToday && styles.dotToday,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  habitRow: {
    paddingVertical: 14,
  },
  habitRowBorder: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  habitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  habitLabelWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  habitIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: '#7A5510',
  },
  habitLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  streakTxt: { color: ACCENT, fontSize: 11, fontWeight: '700' },
  streakDim: { color: TEXT_MUTED, fontSize: 11, marginTop: 3 },
  checkBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0D0D0F',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  weekGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
    marginLeft: 42,
  },
  dot: {
    flex: 1,
    height: 10,
    borderRadius: 3,
  },
  dotToday: {
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
});
