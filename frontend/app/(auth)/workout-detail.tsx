/**
 * Workout Detail (read-only) — view a completed workout's full breakdown.
 * Shown when user taps a recent-workout card on Dashboard or any row in History.
 *
 * Routes here as: /(auth)/workout-detail?id=<workout_id>
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { authFetch } from '../../src/utils/authFetch';

const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const ACCENT = '#F5A623';
const SUCCESS = '#2ECC71';
const TEXT_MUTED = '#8E8E93';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SetEntry {
  set_number?: number;
  weight?: number;
  reps?: number;
  completed?: boolean;
  is_pr?: boolean;
  is_warmup?: boolean;
}
interface ExerciseEntry {
  exercise_name: string;
  muscle_group?: string;
  sets?: SetEntry[];
  notes?: string;
}
interface Workout {
  workout_id?: string;
  name?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  exercises?: ExerciseEntry[];
}

const fmtDate = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const totalVolume = (w: Workout) =>
  (w.exercises || []).reduce(
    (a, ex) =>
      a +
      (ex.sets || []).reduce(
        (b, s) => b + (s.completed && s.weight && s.reps ? s.weight * s.reps : 0),
        0,
      ),
    0,
  );
const totalSets = (w: Workout) =>
  (w.exercises || []).reduce(
    (a, ex) => a + (ex.sets || []).filter((s) => s.completed).length,
    0,
  );

export default function WorkoutDetailScreen() {
  const { sessionToken } = useAuth() as any;
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id || !sessionToken) return;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/workouts/${id}`);
      if (res.ok) {
        const j = await res.json();
        setWorkout(j);
      }
    } catch {
      Alert.alert('Error', 'Could not load workout.');
    } finally {
      setLoading(false);
    }
  }, [id, sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Header onBack={() => router.back()} title="Workout" />
        <View style={styles.centered}>
          <Text style={{ color: TEXT_MUTED }}>Workout not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const sets = totalSets(workout);
  const vol = Math.round(totalVolume(workout));
  const exs = workout.exercises || [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header onBack={() => router.back()} title="Workout Detail" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        <Text style={styles.workoutName}>{workout.name || 'Workout'}</Text>
        <Text style={styles.workoutDate}>{fmtDate(workout.completed_at || workout.started_at)}</Text>

        <View style={styles.statRow}>
          <Stat label="Exercises" value={String(exs.length)} icon="barbell-outline" />
          <Stat label="Sets" value={String(sets)} icon="checkmark-done" />
          <Stat label="Volume" value={`${vol}kg`} icon="trending-up" />
          {!!workout.duration_minutes && (
            <Stat label="Duration" value={`${workout.duration_minutes}m`} icon="time-outline" />
          )}
        </View>

        {exs.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exercises logged.</Text>
          </View>
        ) : (
          exs.map((ex, i) => (
            <View key={`${ex.exercise_name}-${i}`} style={styles.exCard}>
              <View style={styles.exHeader}>
                <Text style={styles.exName}>{ex.exercise_name}</Text>
                {!!ex.muscle_group && (
                  <Text style={styles.exMuscle}>{ex.muscle_group.toUpperCase()}</Text>
                )}
              </View>
              <View style={styles.setsHeaderRow}>
                <Text style={[styles.setsCol, styles.setsHeader, { flex: 0.6 }]}>SET</Text>
                <Text style={[styles.setsCol, styles.setsHeader]}>WEIGHT</Text>
                <Text style={[styles.setsCol, styles.setsHeader]}>REPS</Text>
                <Text style={[styles.setsCol, styles.setsHeader, { flex: 0.6 }]}>✓</Text>
              </View>
              {(ex.sets || []).map((s, idx) => (
                <View key={idx} style={styles.setRow}>
                  <Text style={[styles.setsCol, { flex: 0.6, color: TEXT_MUTED }]}>
                    {s.is_warmup ? 'W' : (s.set_number ?? idx + 1)}
                  </Text>
                  <Text style={styles.setsCol}>{s.weight ?? '—'}{s.weight ? ' kg' : ''}</Text>
                  <Text style={styles.setsCol}>{s.reps ?? '—'}</Text>
                  <View style={[styles.setsCol, { flex: 0.6, alignItems: 'flex-start' }]}>
                    {s.completed ? (
                      <Ionicons name="checkmark-circle" size={18} color={SUCCESS} />
                    ) : (
                      <Ionicons name="ellipse-outline" size={18} color={TEXT_MUTED} />
                    )}
                  </View>
                </View>
              ))}
              {!!ex.notes && (
                <View style={styles.noteBox}>
                  <Ionicons name="document-text-outline" size={13} color={ACCENT} />
                  <Text style={styles.noteText}>{ex.notes}</Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.headerRow}>
      <TouchableOpacity onPress={onBack} style={styles.headerBtn}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={{ width: 38 }} />
    </View>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={16} color={ACCENT} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerBtn: { padding: 6 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workoutName: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  workoutDate: { color: TEXT_MUTED, fontSize: 13, marginBottom: 18 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statValue: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 4 },
  statLabel: { color: TEXT_MUTED, fontSize: 11, marginTop: 2, fontWeight: '600' },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: { color: TEXT_MUTED, fontSize: 14 },
  exCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  exHeader: { marginBottom: 10 },
  exName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  exMuscle: { color: ACCENT, fontSize: 10, fontWeight: '800', marginTop: 3, letterSpacing: 0.8 },
  setsHeaderRow: { flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BORDER },
  setRow: { flexDirection: 'row', paddingVertical: 8, alignItems: 'center' },
  setsCol: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600' },
  setsHeader: { color: TEXT_MUTED, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  noteBox: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  noteText: { color: '#ddd', fontSize: 12, flex: 1, lineHeight: 17, fontStyle: 'italic' },
});
