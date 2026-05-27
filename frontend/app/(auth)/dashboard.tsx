import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { recommendSplit, getAllSplits, getDayName, getTodayWorkout, DaysPerWeek, Goal, SplitRecommendation } from '../../src/data/splits';
import CoachCardsSection from '../../src/components/CoachCardsSection';
import HabitsSection from '../../src/components/HabitsSection';
import DailyWarningIntro from '../../src/components/DailyWarningIntro';
import CalorieAdjustmentCard from '../../src/components/CalorieAdjustmentCard';

const ACCENT = '#F5A623';
const PR = '#FF6B35';
const SUCCESS = '#2ECC71';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const greeting = (h: number) => {
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

interface WeekStats {
  workouts: number;
  sets: number;
  volume_kg: number;
}

interface Workout {
  workout_id: string;
  name: string;
  started_at?: string;
  completed_at?: string;
  exercises?: any[];
}

export default function Dashboard() {
  const router = useRouter();
  const { user, sessionToken } = useAuth();
  const [stats, setStats] = useState<WeekStats>({ workouts: 0, sets: 0, volume_kg: 0 });
  const [recent, setRecent] = useState<Workout[]>([]);
  const [activeProgram, setActiveProgram] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Derive user's split from their saved profile (or recompute from days+goal)
  const userSplit: SplitRecommendation | null = (() => {
    const days = (user as any)?.training_days_per_week as DaysPerWeek | undefined;
    const goal = (user as any)?.goal_type as Goal | undefined;
    const splitId = (user as any)?.split_id as string | undefined;
    const customDays = (user as any)?.training_day_indices as number[] | undefined;
    if (!days || !goal) return null;
    const all = getAllSplits(days);
    const chosen = splitId ? all.find((s) => s.id === splitId) : null;
    const base = chosen || recommendSplit(days, goal);
    // If user picked custom day indices, remap the active-session days
    if (customDays && customDays.length > 0) {
      const sessions = base.schedule.filter((d) => !d.is_rest);
      const sortedDays = [...customDays].sort((a, b) => a - b);
      const newSchedule = [0, 1, 2, 3, 4, 5, 6].map((dow) => {
        const idx = sortedDays.indexOf(dow);
        if (idx >= 0 && sessions[idx]) {
          return { ...sessions[idx], day_of_week: dow, is_rest: false };
        }
        return { day_of_week: dow, template_id: 'rest', template_name: 'Rest', is_rest: true };
      });
      return { ...base, schedule: newSchedule };
    }
    return base;
  })();

  const todayPlan = userSplit ? getTodayWorkout(userSplit) : null;
  const todayDow = () => {
    const js = new Date().getDay();
    return js === 0 ? 6 : js - 1;
  };

  const apiHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const [wRes, pRes] = await Promise.all([
        fetch(`${BACKEND_URL}/api/workouts`, { headers: apiHeaders() }),
        fetch(`${BACKEND_URL}/api/programs/current`, { headers: apiHeaders() }),
      ]);
      if (wRes.ok) {
        const all: Workout[] = await wRes.json();
        const completed = all
          .filter((w: any) => w.status === 'completed' || w.completed_at)
          .sort((a: any, b: any) =>
            new Date(b.completed_at || b.started_at || 0).getTime() -
            new Date(a.completed_at || a.started_at || 0).getTime()
          );
        // Last 7 days stats
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        let setCount = 0;
        let volume = 0;
        let workoutCount = 0;
        for (const w of completed) {
          const ts = new Date(w.completed_at || w.started_at || 0).getTime();
          if (ts < cutoff) continue;
          workoutCount++;
          for (const ex of (w as any).exercises || []) {
            for (const s of ex.sets || []) {
              if (s.completed) {
                setCount++;
                volume += (s.weight || 0) * (s.reps || 0);
              }
            }
          }
        }
        setStats({ workouts: workoutCount, sets: setCount, volume_kg: Math.round(volume) });
        setRecent(completed.slice(0, 5));
      }
      if (pRes.ok) {
        const p = await pRes.json();
        setActiveProgram(p.active ? p : null);
      }
    } catch (e) {
      console.log('dashboard load err', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, apiHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const startWorkout = () => {
    haptic();
    // FIX 2 — Do NOT auto-start a workout/timer from the dashboard hero.
    // Just navigate to the Workout tab so the user can pick what they want.
    // FIX 4 — If today's plan resolves to a user template (via training_day_templates map),
    // pre-select that template for preview but still do not start the timer.
    const todayIdx = todayDow();
    const dayTemplate = (user as any)?.training_day_templates?.[String(todayIdx)] as
      | string
      | undefined;
    if (dayTemplate) {
      router.push(`/(auth)/workout?previewTemplate=${dayTemplate}` as any);
    } else if (todayPlan && !todayPlan.is_rest && todayPlan.template_id !== 'rest') {
      router.push(`/(auth)/workout?previewTemplate=${todayPlan.template_id}` as any);
    } else {
      router.push('/(auth)/workout' as any);
    }
  };

  const firstName = (user?.name || 'Athlete').split(' ')[0];
  const hour = new Date().getHours();

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            tintColor={ACCENT}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        {/* Greeting */}
        <Text style={styles.greeting}>{greeting(hour)},</Text>
        <Text style={styles.name}>{firstName} 👋</Text>

        {/* Big Start Workout card with subtle gradient feel */}
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.heroCard}
          onPress={startWorkout}
        >
          <View style={styles.heroTopBar} />
          <View style={styles.heroContent}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>READY TO TRAIN</Text>
              <Text style={styles.heroTitle}>{(() => {
                const customTplId = (user as any)?.training_day_templates?.[String(todayDow())];
                if (customTplId) {
                  const t: any = (user as any)?._customTemplatesLookup?.[customTplId];
                  if (t?.name) return t.name;
                }
                if (todayPlan && !todayPlan.is_rest) return todayPlan.template_name;
                return 'Start Workout';
              })()}</Text>
              <Text style={styles.heroSub}>
                {todayPlan
                  ? (todayPlan.is_rest ? 'Rest day · go for a walk' : 'Tap to open in Workout tab')
                  : 'Choose a template or empty session'}
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name={todayPlan?.is_rest ? 'bed' : 'arrow-forward'} size={32} color="#000" />
            </View>
          </View>
        </TouchableOpacity>

        {/* Calorie Adjustment suggestion (auto-shows if weight has stalled/drifted) */}
        <CalorieAdjustmentCard sessionToken={sessionToken} onApplied={load} />

        {/* Weekly split schedule */}
        {userSplit && (
          <>
            <Text style={styles.section}>Your Week</Text>
            <View style={styles.scheduleCard}>
              <Text style={styles.scheduleSplitName}>{userSplit.name}</Text>
              <View style={styles.scheduleRow}>
                {userSplit.schedule.map((d, i) => {
                  const isToday = i === todayDow();
                  return (
                    <View
                      key={i}
                      style={[
                        styles.scheduleDayCol,
                        d.is_rest && styles.scheduleDayRest,
                        !d.is_rest && styles.scheduleDayActive,
                        isToday && styles.scheduleDayToday,
                      ]}
                    >
                      <Text style={[styles.scheduleDayName, isToday && { color: '#000' }]}>
                        {getDayName(i).slice(0, 3)}
                      </Text>
                      <Text style={[styles.scheduleDayPlan, isToday && { color: '#000' }]} numberOfLines={1}>
                        {d.is_rest ? 'Rest' : d.template_name.slice(0, 4)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <TouchableOpacity onPress={() => router.push('/(auth)/profile' as any)} style={styles.scheduleEditBtn}>
                <Ionicons name="pencil" size={12} color={ACCENT} />
                <Text style={styles.scheduleEditText}>Change split</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* AI Coach insights */}
        <CoachCardsSection sessionToken={sessionToken} />

        {/* 3 weekly stat cards */}
        <Text style={styles.section}>This Week</Text>
        <View style={styles.statRow}>
          <StatCard
            label="Workouts"
            value={stats.workouts}
            icon="barbell"
            color={ACCENT}
          />
          <StatCard
            label="Sets"
            value={stats.sets}
            icon="checkmark-done"
            color={SUCCESS}
          />
          <StatCard
            label="Volume"
            value={`${stats.volume_kg}`}
            unit="kg"
            icon="trending-up"
            color={PR}
          />
        </View>

        {/* Quick Actions row — FIX 6: Programs tile removed */}
        <Text style={styles.section}>Quick</Text>
        <View style={styles.quickRow}>
          <QuickTile
            icon="scan"
            label="Scan Meal"
            sub="Photo · Barcode"
            onPress={() => router.push('/(auth)/meal-scanner')}
          />
          <QuickTile
            icon="restaurant"
            label="Kitchen"
            sub="Macros"
            onPress={() => router.push('/(auth)/kitchen')}
          />
          <QuickTile
            icon="time"
            label="History"
            sub="Past sessions"
            onPress={() => router.push('/(auth)/history')}
          />
        </View>

        {/* Daily habits (P3) */}
        <HabitsSection />

        {/* Recent workouts */}
        <Text style={styles.section}>Recent Workouts</Text>
        {recent.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={32} color={TEXT_MUTED} />
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Tap Start Workout above to log your first one.</Text>
          </View>
        ) : (
          recent.map((w) => (
            <RecentRow key={w.workout_id} w={w} />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  unit,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  unit?: string;
  icon: any;
  color: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.statValue, { color }]}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickTile({
  icon,
  label,
  sub,
  onPress,
}: {
  icon: any;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickTile} onPress={onPress}>
      <Ionicons name={icon} size={22} color={ACCENT} />
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={styles.quickSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

function RecentRow({ w }: { w: Workout }) {
  const router = useRouter();
  const exercises = (w.exercises || []).map((ex: any) => ex.exercise_name).filter(Boolean);
  const tagText = exercises.slice(0, 3).join(' · ');
  const completedSets = (w.exercises || []).reduce(
    (a: number, ex: any) => a + (ex.sets || []).filter((s: any) => s.completed).length,
    0
  );
  const date = new Date(w.completed_at || w.started_at || 0);
  const dateStr = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.recentCard}
      onPress={() => router.push(`/(auth)/workout-detail?id=${w.workout_id}` as any)}
    >
      <View style={styles.recentTop}>
        <Text style={styles.recentName}>{w.name || 'Workout'}</Text>
        <Text style={styles.recentDate}>{dateStr}</Text>
      </View>
      {!!tagText && <Text style={styles.recentTags}>{tagText}{exercises.length > 3 ? ` +${exercises.length - 3} more` : ''}</Text>}
      <View style={styles.recentMetaRow}>
        <View style={styles.recentMeta}>
          <Ionicons name="checkmark-done" size={12} color={ACCENT} />
          <Text style={styles.recentMetaText}>{completedSets} sets</Text>
        </View>
        <View style={styles.recentMeta}>
          <Ionicons name="barbell" size={12} color={TEXT_MUTED} />
          <Text style={styles.recentMetaText}>{exercises.length} exercises</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 64 },
  greeting: { color: TEXT_MUTED, fontSize: 16, fontWeight: '500' },
  name: { color: '#fff', fontSize: 32, fontWeight: '900', marginTop: 2, letterSpacing: -0.5 },

  heroCard: {
    backgroundColor: ACCENT,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 18,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  heroTopBar: { height: 6, backgroundColor: 'rgba(0,0,0,0.15)' },
  heroContent: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  heroLabel: { color: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: '#000', fontSize: 28, fontWeight: '900', marginTop: 4 },
  heroSub: { color: 'rgba(0,0,0,0.7)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  heroIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },

  section: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 24, marginBottom: 10, letterSpacing: 0.3 },
  scheduleCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
  },
  scheduleSplitName: { color: ACCENT, fontSize: 13, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  scheduleRow: { flexDirection: 'row', gap: 4 },
  scheduleDayCol: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  scheduleDayActive: { backgroundColor: 'rgba(245,166,35,0.12)', borderWidth: 1, borderColor: 'rgba(245,166,35,0.3)' },
  scheduleDayRest: { backgroundColor: '#1F1F22' },
  scheduleDayToday: { backgroundColor: ACCENT, borderColor: ACCENT },
  scheduleDayName: { color: TEXT_MUTED, fontSize: 10, fontWeight: '700' },
  scheduleDayPlan: { color: '#fff', fontSize: 11, fontWeight: '600', marginTop: 2 },
  scheduleEditBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  scheduleEditText: { color: ACCENT, fontSize: 12, fontWeight: '600' },
  statRow: { flexDirection: 'row', gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  statValue: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
  statUnit: { fontSize: 12, fontWeight: '700', color: TEXT_MUTED },
  statLabel: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  quickRow: { flexDirection: 'row', gap: 8 },
  quickTile: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
    alignItems: 'flex-start',
  },
  quickLabel: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 6 },
  quickSub: { color: TEXT_MUTED, fontSize: 10, fontWeight: '600' },

  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { color: '#fff', fontSize: 15, fontWeight: '800', marginTop: 8 },
  emptySub: { color: TEXT_MUTED, fontSize: 12, marginTop: 4, textAlign: 'center' },

  recentCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  recentTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recentName: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1 },
  recentDate: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700' },
  recentTags: { color: ACCENT, fontSize: 12, fontWeight: '600', marginTop: 4 },
  recentMetaRow: { flexDirection: 'row', gap: 14, marginTop: 8 },
  recentMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentMetaText: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
});
