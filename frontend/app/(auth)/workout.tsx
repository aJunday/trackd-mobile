import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Animated,
  Platform,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../_layout';
import MuscleMap, { MuscleEntry } from '../../src/components/MuscleMap';
import ScienceBadge from '../../src/components/ScienceBadge';
import { authFetch } from '../../src/utils/authFetch';
import ExerciseQuickDetail from '../../src/components/ExerciseQuickDetail';
import ExerciseOptionsMenu from '../../src/components/ExerciseOptionsMenu';
import { TEMPLATE_RESEARCH } from '../../src/data/research';
import { getExerciseCitation, isSportProgram } from '../../src/data/exerciseScience';
import { Storage } from '../../src/utils/storage';
import { useActiveWorkout } from '../../src/context/WorkoutContext';

const ACCENT = '#F5A623';
const GOLD = '#F5A623';
const PR_ORANGE = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ============== TYPES ==============
interface SetEntry {
  id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed: boolean;
  is_pr?: boolean;
  one_rm?: number;
}
interface ExerciseEntry {
  id: string;
  exercise_name: string;
  muscle_group?: string;
  sets: SetEntry[];
  notes?: string;
  prev?: { weight: number; reps: number } | null;
}
interface ActiveWorkout {
  workout_id?: string;
  name: string;
  start_time: number; // ms
  exercises: ExerciseEntry[];
}
interface Template {
  template_id: string;
  name: string;
  description?: string;
  is_preset?: boolean;
  exercises: { exercise_name: string; sets: number; reps?: string; rest_seconds?: number; cue?: string }[];
}
interface PR {
  pr_id: string;
  exercise_name: string;
  weight: number;
  reps: number;
  one_rm: number;
  achieved_at: string;
}

// ============== HELPERS ==============
const fmtDur = (ms: number) => {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};
const epley = (w: number, r: number) => +(w * (1 + r / 30)).toFixed(1);
const haptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'warn' = 'light') => {
  if (Platform.OS === 'web') return;
  if (type === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else if (type === 'warn') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else
    Haptics.impactAsync(
      type === 'heavy'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : type === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
    );
};

// Plate calc utility
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATE_COLORS: Record<number, string> = {
  25: '#E94B3C',
  20: '#1668DC',
  15: '#FFD60A',
  10: '#43A047',
  5: '#F5F5F5',
  2.5: '#1A1A1A',
  1.25: '#777',
};
function calcPlates(weight: number, bar = 20) {
  if (weight < bar) return { perSide: [], remainder: 0 };
  const perSideWeight = (weight - bar) / 2;
  let remaining = perSideWeight;
  const perSide: number[] = [];
  for (const p of PLATES_KG) {
    while (remaining >= p - 0.001) {
      perSide.push(p);
      remaining -= p;
    }
  }
  return { perSide, remainder: +remaining.toFixed(2) };
}

// ============== MAIN ==============
export default function WorkoutScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    exercises?: string;
    name?: string;
    program?: string;
    level?: string;
    week?: string;
    day?: string;
    fromProgram?: string;
    autoStart?: string;
    splitTemplate?: string;
    previewTemplate?: string;
  }>();

  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [invalidSet, setInvalidSet] = useState<{ eid: string; sid: string; msg: string } | null>(null);
  const [whyExercise, setWhyExercise] = useState<{ name: string } | null>(null);
  const { startSession: startGlobalWorkout, endSession: endGlobalWorkout } = useActiveWorkout();

  // Sync local workout state ↔ global context so the floating banner can show
  useEffect(() => {
    if (active) {
      startGlobalWorkout(active.name).catch(() => {});
    } else {
      endGlobalWorkout().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!active, active?.name]);
  const [programContext, setProgramContext] = useState<{
    program?: string;
    week?: number;
    day?: number;
  } | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<any[]>([]);
  const [templates, setTemplates] = useState<{
    presets: Template[];
    user_templates: Template[];
    custom_templates?: Template[];
    copied_templates?: Template[];
    limits?: { max_custom: number; max_copied: number; custom_used: number; copied_used: number };
  }>({
    presets: [],
    user_templates: [],
  });
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());

  // Modals
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreMade, setShowPreMade] = useState(false); // FIX 3 — collapsed by default
  const [showPlateCalc, setShowPlateCalc] = useState<{ open: boolean; weight: number }>({
    open: false,
    weight: 100,
  });
  const [restTimer, setRestTimer] = useState<{ active: boolean; secs: number; total: number }>({
    active: false,
    secs: 0,
    total: 0,
  });
  const [prToast, setPrToast] = useState<{ visible: boolean; exerciseName: string; oneRm: number }>(
    { visible: false, exerciseName: '', oneRm: 0 }
  );

  const apiHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  // Tick clock for elapsed time
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // Rest timer countdown
  useEffect(() => {
    if (!restTimer.active) return;
    if (restTimer.secs <= 0) {
      haptic('success');
      setRestTimer({ active: false, secs: 0, total: 0 });
      return;
    }
    const id = setTimeout(() => setRestTimer((p) => ({ ...p, secs: p.secs - 1 })), 1000);
    return () => clearTimeout(id);
  }, [restTimer]);

  // Load initial
  useEffect(() => {
    if (!sessionToken) return;
    loadInitial();
  }, [sessionToken]);

  // Handle pre-fill from Programs (Storage payload — avoids URL length issues)
  useEffect(() => {
    if (!sessionToken || loading) return;
    if (params.fromProgram !== '1') return;
    let cancelled = false;
    const doPrefill = async () => {
      try {
        const raw = await Storage.getItem('pending_workout');
        if (!raw) return;
        await Storage.removeItem('pending_workout');
        if (cancelled) return;
        const payload = JSON.parse(raw);
        const parsed = payload.exercises as { name: string; sets: number; reps: string; rest: string; cue?: string }[];
        const name = payload.name || 'Program Workout';
        const exercises: ExerciseEntry[] = parsed.map((p, i) => {
          const setCount = Math.max(1, Number(p.sets) || 1);
          return {
            id: `e_${i}_${Date.now()}`,
            exercise_name: p.name,
            prev: null,
            notes: p.cue || undefined,
            sets: Array.from({ length: setCount }, (_, j) => ({
              id: `s_pre_${i}_${j}_${Date.now()}`,
              set_number: j + 1,
              weight: 0,
              reps: parseInt(String(p.reps).match(/\d+/)?.[0] || '0') || 0,
              completed: false,
            })),
          };
        });
        try {
          const res = await authFetch(`${BACKEND_URL}/api/workouts`, {
            method: 'POST',
            headers: apiHeaders(),
            body: JSON.stringify({
              name,
              exercises: exercises.map((e) => ({
                exercise_name: e.exercise_name,
                sets: e.sets.map((s) => ({ ...s })),
              })),
              status: 'in_progress',
            }),
          });
          const data = await res.json();
          setActive({
            workout_id: data.workout_id,
            name,
            start_time: Date.now(),
            exercises,
          });
        } catch {
          setActive({ name, start_time: Date.now(), exercises });
        }
        if (payload.program && payload.week && payload.day) {
          setProgramContext({
            program: String(payload.program),
            week: payload.week,
            day: payload.day,
          });
        }
        router.setParams({ fromProgram: '' } as any);
      } catch (e) {
        console.log('prefill from storage err', e);
        Alert.alert('Could not load program workout', 'Please try again from the Programs tab.');
      }
    };
    if (active) {
      // Prompt user — keep current OR replace with new program workout
      Alert.alert(
        'Workout in progress',
        'You have an active workout. Discard it and start the program workout?',
        [
          {
            text: 'Keep current',
            style: 'cancel',
            onPress: () => {
              router.setParams({ fromProgram: '' } as any);
              Storage.removeItem('pending_workout');
            },
          },
          {
            text: 'Discard & start new',
            style: 'destructive',
            onPress: () => {
              setActive(null);
              setRestTimer({ active: false, secs: 0, total: 0 });
              setProgramContext(null);
              setTimeout(() => doPrefill(), 100);
            },
          },
        ]
      );
      return;
    }
    doPrefill();
    return () => { cancelled = true; };
  }, [params.fromProgram, sessionToken, loading]);

  // Handle autoStart from Dashboard "Start Workout" button
  useEffect(() => {
    if (!sessionToken || loading) return;
    // FIX 2/4 — previewTemplate param: just open template preview (don't auto-start timer)
    if (params.previewTemplate && !active) {
      const tplId = String(params.previewTemplate);
      router.setParams({ previewTemplate: '' } as any);
      const all = [...templates.presets, ...templates.user_templates];
      const t = all.find((p: any) => p.template_id === tplId);
      if (t) {
        setPreviewTemplate(t as Template);
        return;
      }
    }
    if (params.autoStart !== '1') return;
    const splitTpl = params.splitTemplate;
    router.setParams({ autoStart: '', splitTemplate: '' } as any);
    if (active) return;  // already have an active workout — silently keep it
    if (splitTpl && templates.presets.length > 0) {
      const t = templates.presets.find((p) => p.template_id === splitTpl);
      if (t) {
        startFromTemplate(t);
        return;
      }
    }
    startEmptyWorkout();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.autoStart, params.splitTemplate, params.previewTemplate, sessionToken, loading, active, templates.presets.length, templates.user_templates.length]);

  const loadInitial = async () => {
    setLoading(true);
    try {
      const [recRes, tmplRes] = await Promise.all([
        authFetch(`${BACKEND_URL}/api/workouts`, { headers: apiHeaders() }),
        authFetch(`${BACKEND_URL}/api/templates`, { headers: apiHeaders() }),
      ]);
      if (recRes.ok) {
        const all = await recRes.json();
        const completed = (all || [])
          .filter((w: any) => w.status === 'completed' || w.completed_at)
          .slice(0, 5);
        const inProgress = (all || []).find((w: any) => w.status === 'in_progress');
        setRecentWorkouts(completed);
        if (inProgress && !active) {
          // resume in-progress workout
          setActive({
            workout_id: inProgress.workout_id,
            name: inProgress.name || 'Workout',
            start_time: new Date(inProgress.started_at || inProgress.start_time || Date.now()).getTime(),
            exercises: (inProgress.exercises || []).map((ex: any, i: number) => ({
              id: `e_${i}_${Date.now()}`,
              exercise_name: ex.exercise_name,
              muscle_group: ex.muscle_group,
              sets: (ex.sets || []).map((s: any, si: number) => ({
                id: `s_${i}_${si}`,
                set_number: s.set_number ?? si + 1,
                weight: s.weight || 0,
                reps: s.reps || 0,
                completed: !!s.completed,
              })),
            })),
          });
        }
      }
      if (tmplRes.ok) {
        const t = await tmplRes.json();
        setTemplates({ presets: t.presets || [], user_templates: t.user_templates || [] });
      }
    } catch (e) {
      console.log('loadInitial err', e);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Custom template menu (Edit / Rename / Duplicate / Delete) ----------
  const openTemplateMenu = (t: Template) => {
    Alert.alert(
      t.name,
      undefined,
      [
        { text: 'Start Workout', onPress: () => setPreviewTemplate(t) },
        {
          text: 'Edit Template',
          onPress: () =>
            router.push({ pathname: '/(auth)/template-builder', params: { id: t.template_id } } as any),
        },
        {
          text: 'Rename',
          onPress: () => promptRenameTemplate(t),
        },
        {
          text: 'Duplicate',
          onPress: () => duplicateTemplate(t),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => confirmDeleteTemplate(t),
        },
        { text: 'Cancel', style: 'cancel' },
      ],
      { cancelable: true },
    );
  };

  const promptRenameTemplate = (t: Template) => {
    if (Platform.OS === 'ios' && (Alert as any).prompt) {
      (Alert as any).prompt(
        'Rename template',
        '',
        async (newName: string) => {
          const n = (newName || '').trim();
          if (!n) return;
          await renameTemplate(t.template_id, n);
        },
        'plain-text',
        t.name,
      );
    } else {
      // Web/Android fallback: use a synchronous prompt (web) or skip (android)
      // For now use a simple JS prompt available in expo web; on Android show alert with default suffix.
      // eslint-disable-next-line no-alert
      const newName = typeof window !== 'undefined' && (window as any).prompt
        ? (window as any).prompt('Rename template', t.name)
        : null;
      if (newName && newName.trim() && newName.trim() !== t.name) {
        renameTemplate(t.template_id, newName.trim());
      }
    }
  };

  const renameTemplate = async (template_id: string, newName: string) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/templates/${template_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
        body: JSON.stringify({ name: newName }),
      });
      if (r.ok) loadInitial();
    } catch (e) {
      console.warn(e);
    }
  };

  const duplicateTemplate = async (t: Template) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/templates/${t.template_id}/duplicate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const data = await r.json();
      if (!r.ok) {
        Alert.alert('Cannot duplicate', data?.detail || 'Quota reached.');
        return;
      }
      loadInitial();
    } catch (e) {
      console.warn(e);
    }
  };

  const confirmDeleteTemplate = (t: Template) => {
    Alert.alert(
      'Delete template?',
      `"${t.name}" will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/templates/${t.template_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${sessionToken}` },
              });
              loadInitial();
            } catch (e) {
              console.warn(e);
            }
          },
        },
      ],
    );
  };

  // ---------- Workout lifecycle ----------
  const startEmptyWorkout = async () => {
    haptic('medium');
    const name = `Workout ${new Date().toLocaleDateString(undefined, { weekday: 'short' })}`;
    try {
      const res = await authFetch(`${BACKEND_URL}/api/workouts`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ name, exercises: [], status: 'in_progress' }),
      });
      const data = await res.json();
      setActive({
        workout_id: data.workout_id,
        name,
        start_time: Date.now(),
        exercises: [],
      });
    } catch {
      // local-only fallback
      setActive({ name, start_time: Date.now(), exercises: [] });
    }
  };

  const startFromTemplate = async (tmpl: Template) => {
    haptic('medium');
    if (active) {
      Alert.alert(
        'Workout in progress',
        'You have an active workout. Discard it and start this template?',
        [
          { text: 'Keep current', style: 'cancel' },
          {
            text: 'Discard & start new',
            style: 'destructive',
            onPress: async () => {
              setActive(null);
              setRestTimer({ active: false, secs: 0, total: 0 });
              setProgramContext(null);
              setTimeout(() => doStartFromTemplate(tmpl), 100);
            },
          },
        ]
      );
      return;
    }
    await doStartFromTemplate(tmpl);
  };

  const doStartFromTemplate = async (tmpl: Template) => {
    const exercises: ExerciseEntry[] = await Promise.all(
      tmpl.exercises.map(async (te, i) => {
        // Fetch previous best for each exercise
        let prev = null;
        try {
          const r = await authFetch(
            `${BACKEND_URL}/api/exercises/history/${encodeURIComponent(te.exercise_name)}`,
            { headers: apiHeaders() }
          );
          if (r.ok) {
            const data = await r.json();
            if (data && data.weight) prev = { weight: data.weight, reps: data.reps };
          }
        } catch {
          /* ignore */
        }
        const sets: SetEntry[] = Array.from({ length: te.sets || 3 }, (_, j) => ({
          id: `s_${i}_${j}_${Date.now()}`,
          set_number: j + 1,
          weight: prev?.weight || 0,
          reps: prev?.reps || 0,
          completed: false,
        }));
        return {
          id: `e_${i}_${Date.now()}`,
          exercise_name: te.exercise_name,
          sets,
          prev,
        };
      })
    );
    try {
      const res = await authFetch(`${BACKEND_URL}/api/workouts`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name: tmpl.name,
          exercises: exercises.map((e) => ({
            exercise_name: e.exercise_name,
            sets: e.sets.map((s) => ({ ...s })),
          })),
          status: 'in_progress',
        }),
      });
      const data = await res.json();
      setActive({
        workout_id: data.workout_id,
        name: tmpl.name,
        start_time: Date.now(),
        exercises,
      });
    } catch {
      setActive({ name: tmpl.name, start_time: Date.now(), exercises });
    }
  };

  const finishWorkout = () => {
    if (!active) return;
    // FIX 7 — do NOT save a workout that has no exercises (or zero completed sets at all).
    const hasAnyExercise = (active.exercises || []).length > 0;
    const hasAnyCompletedSet = (active.exercises || []).some((ex) =>
      (ex.sets || []).some((s) => s.completed && (s.reps || 0) > 0)
    );
    if (!hasAnyExercise || !hasAnyCompletedSet) {
      const title = 'Nothing logged yet';
      const msg = hasAnyExercise
        ? 'Complete at least one set with weight & reps before saving this workout.'
        : 'Add at least one exercise and complete a set before finishing.';
      const onDiscard = async () => {
        haptic();
        if (active.workout_id) {
          try {
            await authFetch(`${BACKEND_URL}/api/workouts/${active.workout_id}`, {
              method: 'DELETE',
              headers: apiHeaders(),
            });
          } catch { /* ignore */ }
        }
        setActive(null);
        setRestTimer({ active: false, secs: 0, total: 0 });
        setProgramContext(null);
        router.replace('/(auth)/workout' as any);
      };
      // Native: Alert.alert renders the 2-button modal. Web: window.confirm fallback.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const ok = window.confirm(`${title}\n\n${msg}\n\nPress OK to discard the session, or Cancel to keep going.`);
        if (ok) await onDiscard();
        return;
      }
      Alert.alert(title, msg, [
        { text: 'Keep Going', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ]);
      return;
    }
    Alert.alert('Finish Workout?', 'This will save your session and clear the timer.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finish',
        style: 'destructive',
        onPress: async () => {
          haptic('success');
          try {
            if (active.workout_id) {
              await authFetch(`${BACKEND_URL}/api/workouts/${active.workout_id}`, {
                method: 'PUT',
                headers: apiHeaders(),
                body: JSON.stringify({
                  exercises: active.exercises.map((ex) => ({
                    exercise_name: ex.exercise_name,
                    sets: ex.sets.map((s) => ({
                      set_number: s.set_number,
                      weight: s.weight,
                      reps: s.reps,
                      completed: s.completed,
                    })),
                  })),
                }),
              });
              await authFetch(`${BACKEND_URL}/api/workouts/${active.workout_id}/complete`, {
                method: 'POST',
                headers: apiHeaders(),
              });
            }
            // Auto-mark program day complete if this workout was from a program
            if (programContext?.week && programContext?.day) {
              try {
                await authFetch(`${BACKEND_URL}/api/programs/complete-day`, {
                  method: 'POST',
                  headers: apiHeaders(),
                  body: JSON.stringify({
                    week: programContext.week,
                    day: programContext.day,
                  }),
                });
              } catch {
                /* ignore */
              }
            }
          } catch (e) {
            console.log('finish err', e);
          }
          setActive(null);
          setRestTimer({ active: false, secs: 0, total: 0 });
          setProgramContext(null);
          loadInitial();
        },
      },
    ]);
  };

  const cancelWorkout = () => {
    Alert.alert('Cancel Workout?', 'You will lose this session.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Cancel',
        style: 'destructive',
        onPress: async () => {
          if (active?.workout_id) {
            try {
              await authFetch(`${BACKEND_URL}/api/workouts/${active.workout_id}`, {
                method: 'DELETE',
                headers: apiHeaders(),
              });
            } catch {
              /* ignore */
            }
          }
          setActive(null);
        },
      },
    ]);
  };

  // ---------- Exercise / Set ops ----------
  const addExercise = async (name: string, muscle_group?: string) => {
    if (!active) return;
    let prev = null;
    try {
      const r = await authFetch(
        `${BACKEND_URL}/api/exercises/history/${encodeURIComponent(name)}`,
        { headers: apiHeaders() }
      );
      if (r.ok) {
        const data = await r.json();
        if (data && data.weight) prev = { weight: data.weight, reps: data.reps };
      }
    } catch {
      /* ignore */
    }
    const id = `e_${Date.now()}`;
    // Replace mode: swap an existing exercise, keep its sets/structure
    if (replaceTargetId) {
      setActive({
        ...active,
        exercises: active.exercises.map((e) =>
          e.id === replaceTargetId
            ? {
                ...e,
                exercise_name: name,
                muscle_group,
                prev,
              }
            : e
        ),
      });
      setReplaceTargetId(null);
      setShowExercisePicker(false);
      return;
    }
    setActive({
      ...active,
      exercises: [
        ...active.exercises,
        {
          id,
          exercise_name: name,
          muscle_group,
          prev,
          sets: [
            {
              id: `s_${id}_0`,
              set_number: 1,
              weight: prev?.weight || 0,
              reps: prev?.reps || 0,
              completed: false,
            },
          ],
        },
      ],
    });
    setShowExercisePicker(false);
  };

  const removeExercise = (eid: string) => {
    if (!active) return;
    haptic('light');
    setActive({ ...active, exercises: active.exercises.filter((e) => e.id !== eid) });
  };

  const addSet = (eid: string) => {
    if (!active) return;
    haptic('light');
    setActive({
      ...active,
      exercises: active.exercises.map((ex) => {
        if (ex.id !== eid) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return {
          ...ex,
          sets: [
            ...ex.sets,
            {
              id: `s_${eid}_${ex.sets.length}_${Date.now()}`,
              set_number: ex.sets.length + 1,
              weight: lastSet?.weight || 0,
              reps: lastSet?.reps || 0,
              completed: false,
            },
          ],
        };
      }),
    });
  };

  const removeSet = (eid: string, sid: string) => {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map((ex) => {
        if (ex.id !== eid) return ex;
        const filtered = ex.sets.filter((s) => s.id !== sid);
        return {
          ...ex,
          sets: filtered.map((s, i) => ({ ...s, set_number: i + 1 })),
        };
      }),
    });
  };

  const updateSet = (eid: string, sid: string, patch: Partial<SetEntry>) => {
    if (!active) return;
    setActive({
      ...active,
      exercises: active.exercises.map((ex) => {
        if (ex.id !== eid) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.id === sid ? { ...s, ...patch } : s)),
        };
      }),
    });
  };

  const toggleSetComplete = async (eid: string, sid: string) => {
    if (!active) return;
    const ex = active.exercises.find((e) => e.id === eid);
    const set = ex?.sets.find((s) => s.id === sid);
    if (!set || !ex) return;

    const newCompleted = !set.completed;
    // Validation: weight and reps must both be > 0 before marking complete
    if (newCompleted && (!set.weight || set.weight <= 0 || !set.reps || set.reps <= 0)) {
      haptic('warning');
      setInvalidSet({ eid, sid, msg: 'Enter weight and reps to complete this set' });
      setTimeout(() => setInvalidSet(null), 2500);
      return;
    }
    if (newCompleted) {
      haptic('medium');
      // Check PR
      const oneRm = epley(set.weight, set.reps);
      try {
        const prRes = await authFetch(
          `${BACKEND_URL}/api/exercises/prs/${encodeURIComponent(ex.exercise_name)}`,
          { headers: apiHeaders() }
        );
        if (prRes.ok) {
          const data = await prRes.json();
          const currentBest = data.current_pr?.one_rm || 0;
          if (oneRm > currentBest && set.weight > 0 && set.reps > 0) {
            haptic('success');
            setPrToast({ visible: true, exerciseName: ex.exercise_name, oneRm });
            updateSet(eid, sid, { completed: true, is_pr: true, one_rm: oneRm });
            setTimeout(() => setPrToast({ visible: false, exerciseName: '', oneRm: 0 }), 3000);
          } else {
            updateSet(eid, sid, { completed: true, one_rm: oneRm });
          }
        } else {
          updateSet(eid, sid, { completed: true, one_rm: oneRm });
        }
      } catch {
        updateSet(eid, sid, { completed: true, one_rm: oneRm });
      }
      // Start rest timer
      startRest(90);
    } else {
      updateSet(eid, sid, { completed: false, is_pr: false });
    }
  };

  // ---------- Rest timer ----------
  const startRest = (secs: number) => {
    haptic('light');
    setRestTimer({ active: true, secs, total: secs });
  };
  const skipRest = () => {
    setRestTimer({ active: false, secs: 0, total: 0 });
  };
  const adjustRest = (delta: number) => {
    setRestTimer((p) => ({ ...p, secs: Math.max(0, p.secs + delta), total: p.total + delta }));
  };

  // ============== RENDER ==============
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  // ----------- Empty / lobby state -----------
  if (!active) {
    const presetIds = [
      'preset_push', 'preset_pull', 'preset_legs',
      'preset_upper', 'preset_lower',
      'preset_fullbody', 'preset_fullbody_b', 'preset_ppl',
    ];
    const orderedPresets = presetIds
      .map((id) => templates.presets.find((p) => p.template_id === id))
      .filter(Boolean) as Template[];
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.h1}>Workout</Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/template-builder' as any)}
              style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' }}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={22} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={styles.h2}>Pick a template or start fresh.</Text>

          <TouchableOpacity style={styles.startBtn} onPress={startEmptyWorkout} activeOpacity={0.85}>
            <Ionicons name="play" size={22} color="#000" />
            <Text style={styles.startBtnText}>Start Empty Workout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: ACCENT,
              borderStyle: 'dashed', backgroundColor: 'rgba(245,166,35,0.06)', marginTop: 10,
            }}
            onPress={() => router.push('/(auth)/template-builder' as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
            <Text style={{ color: ACCENT, fontWeight: '800', fontSize: 14 }}>Create Template</Text>
          </TouchableOpacity>

          {/* FIX 3 — My Templates FIRST (prominent), then Pre-Made (collapsed button) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.section}>
              My Templates ({templates.limits?.custom_used ?? (templates.custom_templates || templates.user_templates.filter((t: any) => !t.is_copied)).length}/3)
            </Text>
          </View>
          {(() => {
            const customs = templates.custom_templates ?? templates.user_templates.filter((t: any) => !t.is_copied);
            return customs.length === 0 ? (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons name="bookmark-outline" size={28} color={TEXT_MUTED} />
                <Text style={styles.emptyText}>No saved templates yet</Text>
                <Text style={styles.emptySub}>Tap Create Template above to build your own.</Text>
              </View>
            ) : (
              <View style={styles.templateGrid}>
                {customs.map((t: Template) => (
                  <TouchableOpacity
                    key={t.template_id}
                    style={styles.templateCard}
                    activeOpacity={0.85}
                    onPress={() => setPreviewTemplate(t)}
                  >
                    <View style={styles.tplIconWrap}>
                      <Ionicons name="bookmark" size={20} color={ACCENT} />
                    </View>
                    <Text style={styles.tplCardName} numberOfLines={1}>{t.name}</Text>
                    <Text style={styles.tplCardMeta}>{t.exercises.length} ex</Text>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        openTemplateMenu(t);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ position: 'absolute', top: 8, right: 8, padding: 4 }}
                    >
                      <Ionicons name="ellipsis-horizontal" size={18} color="#fff" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            );
          })()}

          {/* Pre-Made Templates — collapsible button (FIX 3) */}
          <TouchableOpacity
            style={styles.preMadeToggle}
            onPress={() => setShowPreMade((p) => !p)}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.preMadeIconWrap}>
                <MaterialCommunityIcons name="flask-outline" size={18} color={ACCENT} />
              </View>
              <View>
                <Text style={styles.preMadeTitle}>Pre-Made Templates</Text>
                <Text style={styles.preMadeSub}>{orderedPresets.length} science-backed splits</Text>
              </View>
            </View>
            <Ionicons name={showPreMade ? 'chevron-up' : 'chevron-down'} size={20} color={ACCENT} />
          </TouchableOpacity>
          {showPreMade && (
            <View style={styles.templateGrid}>
              {orderedPresets.map((t) => (
                <TouchableOpacity
                  key={t.template_id}
                  style={styles.templateCard}
                  activeOpacity={0.85}
                  onPress={() => setPreviewTemplate(t)}
                >
                  <View style={styles.tplIconWrap}>
                    <MaterialCommunityIcons name="dumbbell" size={22} color={ACCENT} />
                  </View>
                  <Text style={styles.tplCardName} numberOfLines={1}>{t.name}</Text>
                  <Text style={styles.tplCardMeta}>
                    {t.exercises.length} ex · ~{Math.round(t.exercises.length * 6 + 5)} min
                  </Text>
                  <Text style={styles.tplCardMuscles} numberOfLines={1}>
                    {summarizeMuscles(t)}
                  </Text>
                  <View style={{ marginTop: 8 }}>
                    <ScienceBadge refKeys={TEMPLATE_RESEARCH[t.template_id] || ['volume_schoenfeld_2017']} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Copied Templates */}
          {(() => {
            const copies = templates.copied_templates ?? templates.user_templates.filter((t: any) => t.is_copied);
            const used = templates.limits?.copied_used ?? copies.length;
            if (used === 0) return null;
            return (
              <>
                <View style={[styles.sectionHeader, { marginTop: 22 }]}>
                  <Text style={styles.section}>Copied Templates ({used}/3)</Text>
                </View>
                <View style={styles.templateGrid}>
                  {copies.map((t: Template) => (
                    <TouchableOpacity
                      key={t.template_id}
                      style={styles.templateCard}
                      activeOpacity={0.85}
                      onPress={() => setPreviewTemplate(t)}
                    >
                      <View style={styles.tplIconWrap}>
                        <Ionicons name="copy" size={20} color={ACCENT} />
                      </View>
                      <Text style={styles.tplCardName} numberOfLines={1}>{t.name}</Text>
                      <Text style={styles.tplCardMeta}>{t.exercises.length} ex</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            );
          })()}

          <Text style={[styles.section, { marginTop: 24 }]}>Recent Workouts</Text>
          {recentWorkouts.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="calendar-blank-outline" size={32} color={TEXT_MUTED} />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySub}>Press start above to begin your first session.</Text>
            </View>
          ) : (
            recentWorkouts.map((w) => (
              <View key={w.workout_id} style={styles.recentCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName}>{w.name}</Text>
                  <Text style={styles.recentMeta}>
                    {new Date(w.completed_at || w.started_at).toLocaleDateString()} •{' '}
                    {(w.exercises || []).length} exercises
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
              </View>
            ))
          )}
        </ScrollView>

        {/* Template preview modal */}
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
          onStart={(tmpl) => {
            setPreviewTemplate(null);
            startFromTemplate(tmpl);
          }}
          onEdit={(tmpl) => {
            // "Edit mode" = start the template, then user can use the ... menu on
            // each exercise to add/remove/replace before logging the first set.
            Alert.alert(
              'Edit template',
              'Starts the workout in edit mode. You can add, remove, replace exercises or change rest timers using the ⋯ menu on each exercise card before logging any sets.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Continue',
                  onPress: () => {
                    setPreviewTemplate(null);
                    startFromTemplate(tmpl);
                  },
                },
              ]
            );
          }}
        />
      </SafeAreaView>
    );
  }

  // ----------- Active session -----------
  const elapsed = now - active.start_time;
  const completedSets = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).length,
    0
  );
  const totalSets = active.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const totalVolume = active.exercises.reduce(
    (acc, e) => acc + e.sets.filter((s) => s.completed).reduce((sa, s) => sa + s.weight * s.reps, 0),
    0
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={cancelWorkout} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <PulsingTimer
              elapsedMs={elapsed}
              completedSets={completedSets}
              totalSets={totalSets}
              totalVolume={totalVolume}
            />
          </View>
          <TouchableOpacity onPress={finishWorkout} style={styles.finishBtn}>
            <Text style={styles.finishBtnText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }}>
          <Text style={styles.workoutName}>{active.name}</Text>

          {active.exercises.map((ex) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              invalidSetId={invalidSet?.eid === ex.id ? invalidSet.sid : null}
              invalidSetMsg={invalidSet?.eid === ex.id ? invalidSet.msg : null}
              onAddSet={() => addSet(ex.id)}
              onRemoveSet={(sid) => removeSet(ex.id, sid)}
              onUpdateSet={(sid, patch) => updateSet(ex.id, sid, patch)}
              onToggleComplete={(sid) => toggleSetComplete(ex.id, sid)}
              onRemove={() => removeExercise(ex.id)}
              onPlateCalc={(w) => setShowPlateCalc({ open: true, weight: w })}
              onShowDetail={() =>
                router.push({
                  pathname: '/(auth)/exercise-detail',
                  params: { name: ex.exercise_name },
                })
              }
              onAddNote={(note) => {
                if (!active) return;
                setActive({
                  ...active,
                  exercises: active.exercises.map((e: any) =>
                    e.id === ex.id ? { ...e, note } : e
                  ),
                });
              }}
              onAddWarmupSets={() => {
                if (!active) return;
                const newWarmups: SetEntry[] = [
                  { id: `w_${Date.now()}_a`, weight: 0, reps: 0, completed: false, is_warmup: true } as any,
                  { id: `w_${Date.now()}_b`, weight: 0, reps: 0, completed: false, is_warmup: true } as any,
                ];
                setActive({
                  ...active,
                  exercises: active.exercises.map((e: any) =>
                    e.id === ex.id ? { ...e, sets: [...newWarmups, ...e.sets] } : e
                  ),
                });
              }}
              onUpdateRestTimer={(seconds) => {
                if (!active) return;
                setActive({
                  ...active,
                  exercises: active.exercises.map((e: any) =>
                    e.id === ex.id ? { ...e, rest_seconds: seconds } : e
                  ),
                });
              }}
              onReplaceExercise={() => {
                // Open the exercise picker; on selection we'll swap by id
                setReplaceTargetId(ex.id);
                setShowExercisePicker(true);
              }}
              onCreateSuperset={() => {
                if (!active) return;
                const idx = active.exercises.findIndex((e: any) => e.id === ex.id);
                if (idx < 0 || idx >= active.exercises.length - 1) {
                  Alert.alert('Need a next exercise', 'Add another exercise after this one to create a superset.');
                  return;
                }
                const nextId = active.exercises[idx + 1].id;
                setActive({
                  ...active,
                  exercises: active.exercises.map((e: any) =>
                    e.id === ex.id ? { ...e, superset_with: nextId } : e
                  ),
                });
              }}
              onWhyExercise={
                isSportProgram(programContext?.program)
                  ? () => setWhyExercise({ name: ex.exercise_name })
                  : undefined
              }
            />
          ))}

          <TouchableOpacity
            style={styles.addExerciseBtn}
            onPress={() => setShowExercisePicker(true)}
          >
            <Ionicons name="add" size={22} color={ACCENT} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rest timer overlay */}
        {restTimer.active && (
          <RestTimerBar
            secs={restTimer.secs}
            total={restTimer.total}
            onSkip={skipRest}
            onAdjust={adjustRest}
          />
        )}

        {/* PR toast */}
        {prToast.visible && <PRToast name={prToast.exerciseName} oneRm={prToast.oneRm} />}

        {/* Modals */}
        <ExercisePickerModal
          visible={showExercisePicker}
          onClose={() => {
            setShowExercisePicker(false);
            setReplaceTargetId(null);
          }}
          onSelect={addExercise}
          sessionToken={sessionToken}
        />
        <PlateCalcModal
          visible={showPlateCalc.open}
          weight={showPlateCalc.weight}
          onClose={() => setShowPlateCalc({ open: false, weight: 100 })}
        />
        <WhyExerciseModal
          visible={!!whyExercise}
          exerciseName={whyExercise?.name || ''}
          programId={programContext?.program}
          onClose={() => setWhyExercise(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============== WHY THIS EXERCISE? ==============
function WhyExerciseModal({
  visible,
  exerciseName,
  programId,
  onClose,
}: {
  visible: boolean;
  exerciseName: string;
  programId?: string | null;
  onClose: () => void;
}) {
  if (!visible) return null;
  const { citation } = getExerciseCitation(exerciseName, programId);
  // Split "Authors year — plain language" into source + reason
  const dashIdx = citation.indexOf(' — ');
  const source = dashIdx >= 0 ? citation.slice(0, dashIdx) : citation;
  const reason = dashIdx >= 0 ? citation.slice(dashIdx + 3) : '';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={whyStyles.backdrop}>
        <TouchableOpacity activeOpacity={1} style={whyStyles.backdropTouch} onPress={onClose} />
        <View style={whyStyles.sheet}>
          <View style={whyStyles.handle} />
          <View style={whyStyles.header}>
            <View style={whyStyles.iconBox}>
              <MaterialCommunityIcons name="flask-outline" size={20} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={whyStyles.kicker}>WHY THIS EXERCISE?</Text>
              <Text style={whyStyles.title} numberOfLines={2}>
                {exerciseName}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          <View style={whyStyles.card}>
            <Text style={whyStyles.sourceLabel}>RESEARCH SOURCE</Text>
            <Text style={whyStyles.source}>{source}</Text>
            {!!reason && (
              <>
                <View style={whyStyles.divider} />
                <Text style={whyStyles.reasonLabel}>WHY IT MATTERS FOR YOUR SPORT</Text>
                <Text style={whyStyles.reason}>{reason}</Text>
              </>
            )}
          </View>

          <TouchableOpacity style={whyStyles.gotItBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={whyStyles.gotItText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const whyStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 32 : 22,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginBottom: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: { color: ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginTop: 2 },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  sourceLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  source: { color: ACCENT, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 12 },
  reasonLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 6,
  },
  reason: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, fontWeight: '500' },
  gotItBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  gotItText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

// ============== PULSING TIMER ==============
function PulsingTimer({ elapsedMs, completedSets, totalSets, totalVolume }: { elapsedMs: number; completedSets: number; totalSets: number; totalVolume: number }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View style={{ alignItems: 'center', transform: [{ scale: pulse }] }}>
      <Text style={styles.timerText}>{fmtDur(elapsedMs)}</Text>
      <Text style={styles.timerSub}>
        {completedSets}/{totalSets} sets · {Math.round(totalVolume)} kg
      </Text>
    </Animated.View>
  );
}

// ============== EXERCISE CARD ==============
function ExerciseCard({
  exercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleComplete,
  onRemove,
  onPlateCalc,
  onShowDetail,
  onAddNote,
  onAddWarmupSets,
  onUpdateRestTimer,
  onReplaceExercise,
  onCreateSuperset,
  onWhyExercise,
  invalidSetId,
  invalidSetMsg,
}: {
  exercise: ExerciseEntry;
  onAddSet: () => void;
  onRemoveSet: (sid: string) => void;
  onUpdateSet: (sid: string, patch: Partial<SetEntry>) => void;
  onToggleComplete: (sid: string) => void;
  onRemove: () => void;
  onPlateCalc: (weight: number) => void;
  onShowDetail: () => void;
  onAddNote?: (note: string) => void;
  onAddWarmupSets?: () => void;
  onUpdateRestTimer?: (seconds: number) => void;
  onReplaceExercise?: () => void;
  onCreateSuperset?: () => void;
  onWhyExercise?: () => void;
  invalidSetId?: string | null;
  invalidSetMsg?: string | null;
}) {
  const [musclePri, setMusclePri] = useState<MuscleEntry[]>([]);
  const [muscleSec, setMuscleSec] = useState<MuscleEntry[]>([]);
  const [showTooltip, setShowTooltip] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Single-pulse animation when exercise is first added
  const pulseScale = useRef(new Animated.Value(1)).current;
  const tooltipOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Single gentle pulse — scale up then back to normal over 1 second
    Animated.sequence([
      Animated.timing(pulseScale, { toValue: 1.18, duration: 500, useNativeDriver: true }),
      Animated.timing(pulseScale, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // First-time tooltip — only ever shown once
    (async () => {
      try {
        const seen = await Storage.getItem('seen_exercise_tooltip');
        if (!seen) {
          setShowTooltip(true);
          Animated.sequence([
            Animated.timing(tooltipOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
            Animated.delay(2700),
            Animated.timing(tooltipOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
          ]).start(() => {
            setShowTooltip(false);
          });
          await Storage.setItem('seen_exercise_tooltip', '1');
        }
      } catch {
        // ignore
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await authFetch(
          `${BACKEND_URL}/api/exercises/muscles-thumbnail?name=${encodeURIComponent(exercise.exercise_name)}`
        );
        const j = await r.json();
        if (cancelled) return;
        setMusclePri(j.primary_muscles || []);
        setMuscleSec(j.secondary_muscles || []);
      } catch (e) {
        // ignore — thumbnail just won't render
      }
    })();
    return () => { cancelled = true; };
  }, [exercise.exercise_name]);

  return (
    <View style={styles.exCard}>
      <View style={styles.exHeader}>
        {/* Tiny muscle thumbnail with red play badge + one-time pulse */}
        <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
          <TouchableOpacity onPress={onShowDetail} style={styles.muscleThumb} activeOpacity={0.7}>
            {(musclePri.length > 0 || muscleSec.length > 0) ? (
              <MuscleMap primary={musclePri} secondary={muscleSec} size="thumb" />
            ) : (
              <Ionicons name="body-outline" size={28} color={TEXT_MUTED} />
            )}
            {/* Red play badge — signals tappable for video/guide */}
            <View style={styles.playBadge}>
              <Ionicons name="play" size={9} color="#fff" />
            </View>
          </TouchableOpacity>
          {/* First-time tooltip */}
          {showTooltip && (
            <Animated.View style={[styles.tooltip, { opacity: tooltipOpacity }]} pointerEvents="none">
              <View style={styles.tooltipArrow} />
              <Text style={styles.tooltipText}>Tap for form guide and video</Text>
            </Animated.View>
          )}
        </Animated.View>
        <TouchableOpacity onPress={onShowDetail} style={{ flex: 1 }} activeOpacity={0.7}>
          <View style={styles.exNameRow}>
            <Text style={styles.exName}>{exercise.exercise_name}</Text>
            <Ionicons name="information-circle-outline" size={16} color={ACCENT} style={{ marginLeft: 6 }} />
          </View>
          {exercise.muscle_group && (
            <Text style={styles.exMuscle}>{exercise.muscle_group}</Text>
          )}
          {!!(exercise as any).note && (
            <View style={styles.noteRow}>
              <MaterialCommunityIcons name="note-text-outline" size={11} color={ACCENT} />
              <Text style={styles.noteText} numberOfLines={2}>{(exercise as any).note}</Text>
            </View>
          )}
          {!!(exercise as any).superset_with && (
            <View style={styles.noteRow}>
              <MaterialCommunityIcons name="link-variant" size={11} color={ACCENT} />
              <Text style={styles.noteText}>Superset with next exercise</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setMenuOpen(true)}
          style={styles.iconBtnSmall}
          hitSlop={8}
          testID={`exercise-options-${exercise.id}`}
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>

      {/* Header row */}
      <View style={styles.setHeader}>
        <Text style={[styles.setHeadCol, { width: 30 }]}>SET</Text>
        <Text style={[styles.setHeadCol, { flex: 1.2 }]}>PREV</Text>
        <Text style={[styles.setHeadCol, { flex: 1 }]}>KG</Text>
        <Text style={[styles.setHeadCol, { flex: 1 }]}>REPS</Text>
        <Text style={[styles.setHeadCol, { width: 44, textAlign: 'center' }]}>✓</Text>
      </View>

      {exercise.sets.map((s) => (
        <SetRow
          key={s.id}
          set={s}
          prev={exercise.prev}
          onChange={(patch) => onUpdateSet(s.id, patch)}
          onToggle={() => onToggleComplete(s.id)}
          onRemove={() => onRemoveSet(s.id)}
          onPlate={() => onPlateCalc(s.weight)}
          invalid={invalidSetId === s.id}
        />
      ))}
      {invalidSetMsg && (
        <Text style={{ color: '#FF3B30', fontSize: 12, fontWeight: '600', marginTop: 4, marginLeft: 38 }}>
          {invalidSetMsg}
        </Text>
      )}

      <TouchableOpacity style={styles.addSetBtn} onPress={onAddSet}>
        <Ionicons name="add" size={18} color={ACCENT} />
        <Text style={styles.addSetText}>Add Set</Text>
      </TouchableOpacity>

      {/* Options menu (... in header) */}
      <ExerciseOptionsMenu
        visible={menuOpen}
        exerciseName={exercise.exercise_name}
        currentRestSeconds={(exercise as any).rest_seconds}
        currentNote={(exercise as any).note}
        onClose={() => setMenuOpen(false)}
        onAddNote={onAddNote}
        onAddWarmupSets={onAddWarmupSets}
        onUpdateRestTimer={onUpdateRestTimer}
        onReplaceExercise={onReplaceExercise}
        onCreateSuperset={onCreateSuperset}
        onRemoveExercise={onRemove}
        onWhyExercise={onWhyExercise}
      />
    </View>
  );
}

function SetRow({
  set,
  prev,
  onChange,
  onToggle,
  onRemove,
  onPlate,
  invalid,
}: {
  set: SetEntry;
  prev?: { weight: number; reps: number } | null;
  onChange: (patch: Partial<SetEntry>) => void;
  onToggle: () => void;
  onRemove: () => void;
  onPlate: () => void;
  invalid?: boolean;
}) {
  const [w, setW] = useState(String(set.weight || ''));
  const [r, setR] = useState(String(set.reps || ''));
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => setW(String(set.weight || '')), [set.weight]);
  useEffect(() => setR(String(set.reps || '')), [set.reps]);

  // Trigger shake animation when an invalid attempt is made
  useEffect(() => {
    if (invalid) {
      Animated.sequence([
        Animated.timing(shake, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [invalid, shake]);

  const canComplete = (set.weight || 0) > 0 && (set.reps || 0) > 0;
  const checkBg = set.completed
    ? (set.is_pr ? GOLD : ACCENT)
    : canComplete
      ? '#1F1F22'
      : '#15151A';

  const commitW = (v: string) => {
    const n = parseFloat(v) || 0;
    onChange({ weight: n });
  };
  const commitR = (v: string) => {
    const n = parseInt(v) || 0;
    onChange({ reps: n });
  };

  return (
    <Animated.View style={[styles.setRow, set.completed && styles.setRowDone, set.is_pr && styles.setRowPR, invalid && { borderColor: '#FF3B30', borderWidth: 1, transform: [{ translateX: shake }] }]}>
      <Pressable onLongPress={onRemove} style={{ width: 30 }}>
        <Text style={styles.setNum}>{set.set_number}</Text>
      </Pressable>
      <TouchableOpacity style={{ flex: 1.2 }} onPress={onPlate}>
        <Text style={styles.prevText}>
          {prev ? `${prev.weight}kg × ${prev.reps}` : '—'}
        </Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.setInput, { flex: 1 }, invalid && !set.weight && { borderColor: '#FF3B30', borderWidth: 1 }]}
        value={w}
        onChangeText={setW}
        onBlur={() => commitW(w)}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor="#444"
        selectTextOnFocus
      />
      <TextInput
        style={[styles.setInput, { flex: 1 }, invalid && !set.reps && { borderColor: '#FF3B30', borderWidth: 1 }]}
        value={r}
        onChangeText={setR}
        onBlur={() => commitR(r)}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#444"
        selectTextOnFocus
      />
      <TouchableOpacity
        onPress={onToggle}
        style={[
          styles.checkBtn,
          { backgroundColor: checkBg, opacity: canComplete || set.completed ? 1 : 0.5 },
          set.completed && { borderColor: 'transparent' },
        ]}
      >
        {set.is_pr ? (
          <Ionicons name="trophy" size={18} color="#000" />
        ) : (
          <Ionicons
            name={set.completed ? 'checkmark' : 'checkmark-outline'}
            size={20}
            color={set.completed ? '#000' : canComplete ? ACCENT : '#444'}
          />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ============== EXERCISE PICKER MODAL ==============
function ExercisePickerModal({
  visible,
  onClose,
  onSelect,
  sessionToken,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (name: string, muscle_group?: string) => void;
  sessionToken: string | null;
}) {
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [results, setResults] = useState<{ name: string; muscle_group: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    authFetch(`${BACKEND_URL}/api/exercises/library`)
      .then((r) => r.json())
      .then((d) => {
        setGroups(Object.keys(d.library || {}));
        // Cache the full library — used as fallback if /search fails
        const allExercises: { name: string; muscle_group: string }[] = [];
        Object.entries(d.library || {}).forEach(([group, list]) => {
          (list as string[]).forEach((name) => {
            allExercises.push({ name, muscle_group: group });
          });
        });
        // Use as initial results
        if (allExercises.length > 0 && results.length === 0) {
          setResults(allExercises);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (muscleGroup) params.append('muscle_group', muscleGroup);
    const url = `${BACKEND_URL}/api/exercises/library/search?${params.toString()}`;
    authFetch(url)
      .then(async (r) => {
        if (!r.ok) {
          // Fallback: filter cached library directly when /search fails (auth race, network, etc.)
          const libRes = await authFetch(`${BACKEND_URL}/api/exercises/library`);
          const libJson = await libRes.json();
          const all: { name: string; muscle_group: string }[] = [];
          Object.entries(libJson.library || {}).forEach(([group, list]) => {
            if (muscleGroup && group !== muscleGroup) return;
            (list as string[]).forEach((name) => {
              if (!query || name.toLowerCase().includes(query.toLowerCase())) {
                all.push({ name, muscle_group: group });
              }
            });
          });
          setResults(all);
          return;
        }
        const d = await r.json();
        setResults(d.exercises || []);
      })
      .catch(() => {
        // Network error → keep prior results to avoid empty state flicker
      })
      .finally(() => setLoading(false));
  }, [query, muscleGroup, visible, sessionToken]);

  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Pick Exercise</Text>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color={TEXT_MUTED} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises…"
            placeholderTextColor={TEXT_MUTED}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.groupsRow}>
          <TouchableOpacity
            style={[styles.groupChip, !muscleGroup && styles.groupChipActive]}
            onPress={() => setMuscleGroup(null)}
          >
            <Text style={[styles.groupChipText, !muscleGroup && styles.groupChipTextActive]}>All</Text>
          </TouchableOpacity>
          {groups.map((g) => (
            <TouchableOpacity
              key={g}
              style={[styles.groupChip, muscleGroup === g && styles.groupChipActive]}
              onPress={() => setMuscleGroup(muscleGroup === g ? null : g)}
            >
              <Text
                style={[styles.groupChipText, muscleGroup === g && styles.groupChipTextActive]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading ? (
          <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, idx) => `${item.name}_${idx}`}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.exerciseRow}
                onPress={() => {
                  haptic('light');
                  onSelect(item.name, item.muscle_group);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.exerciseRowName}>{item.name}</Text>
                  <Text style={styles.exerciseRowMuscle}>{item.muscle_group}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={ACCENT} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyResults}>No exercises found</Text>
            }
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </Modal>
  );
}

// ============== TEMPLATE PREVIEW MODAL ==============
// Helper: summarize muscles targeted by a template by inspecting exercise names
const summarizeMuscles = (t: Template): string => {
  const lower = t.exercises.map((e) => e.exercise_name.toLowerCase()).join(' ');
  const groups: string[] = [];
  if (/bench|press|fly|chest|push.?up/.test(lower)) groups.push('chest');
  if (/row|pull|lat|deadlift/.test(lower)) groups.push('back');
  if (/shoulder|raise|press/.test(lower)) groups.push('shoulders');
  if (/curl/.test(lower)) groups.push('biceps');
  if (/tricep|extension|pushdown/.test(lower)) groups.push('triceps');
  if (/squat|leg press|lunge|split squat|extension/.test(lower)) groups.push('quads');
  if (/deadlift|leg curl|romanian|nordic/.test(lower)) groups.push('hamstrings');
  if (/glute|hip thrust/.test(lower)) groups.push('glutes');
  if (/calf/.test(lower)) groups.push('calves');
  if (/face pull/.test(lower)) groups.push('rear delts');
  return Array.from(new Set(groups)).slice(0, 4).join(' · ') || 'full body';
};

function TemplatePreviewModal({
  template,
  onClose,
  onStart,
  onEdit,
  lastPerformed,
}: {
  template: Template | null;
  onClose: () => void;
  onStart: (t: Template) => void;
  onEdit?: (t: Template) => void;
  lastPerformed?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const [exerciseImages, setExerciseImages] = useState<Record<string, string>>({});
  const [detailExercise, setDetailExercise] = useState<string | null>(null);

  // Pre-fetch GIF thumbs for the listed exercises (best-effort)
  useEffect(() => {
    if (!template) return;
    let cancelled = false;
    (async () => {
      const newMap: Record<string, string> = {};
      await Promise.all(
        template.exercises.slice(0, 12).map(async (ex) => {
          try {
            const r = await authFetch(
              `${BACKEND_URL}/api/exercises/details?name=${encodeURIComponent(ex.exercise_name)}`
            );
            if (r.ok) {
              const j = await r.json();
              const frames: string[] = j?.frames || [];
              if (frames[0]) newMap[ex.exercise_name] = frames[0];
            }
          } catch {}
        })
      );
      if (!cancelled) setExerciseImages((prev) => ({ ...prev, ...newMap }));
    })();
    return () => {
      cancelled = true;
    };
  }, [template]);

  if (!template) return null;
  const research = TEMPLATE_RESEARCH[template.template_id] || ['volume_schoenfeld_2017'];
  const totalSets = template.exercises.reduce((sum, e) => sum + (e.sets || 0), 0);
  const estMin = Math.round(template.exercises.length * 6 + 5);
  return (
    <Modal visible={!!template} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { paddingTop: insets.top || 16 }]}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{template.name}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onEdit ? (
              <TouchableOpacity
                onPress={() => onEdit(template)}
                style={[styles.iconBtn, { backgroundColor: '#222' }]}
                hitSlop={10}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700', marginLeft: 4 }}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* meta row */}
          <View style={styles.tplPreviewMetaRow}>
            <View style={styles.metaPill}>
              <Ionicons name="barbell" size={14} color={ACCENT} />
              <Text style={styles.metaPillText}>{template.exercises.length} exercises</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="repeat" size={14} color={ACCENT} />
              <Text style={styles.metaPillText}>{totalSets} sets</Text>
            </View>
            <View style={styles.metaPill}>
              <Ionicons name="time-outline" size={14} color={ACCENT} />
              <Text style={styles.metaPillText}>~{estMin} min</Text>
            </View>
          </View>
          {lastPerformed ? (
            <View style={[styles.metaPill, { alignSelf: 'flex-start', marginTop: 8 }]}>
              <Ionicons name="checkmark-done" size={12} color={ACCENT} />
              <Text style={styles.metaPillText}>Last performed: {lastPerformed}</Text>
            </View>
          ) : null}
          <Text style={styles.tplMusclesLine}>Targets: {summarizeMuscles(template)}</Text>
          {!!template.description && (
            <Text style={styles.tplDesc}>{template.description}</Text>
          )}
          <View style={{ marginTop: 8 }}>
            <ScienceBadge refKeys={research} size="medium" />
          </View>

          {/* exercise list */}
          <Text style={[styles.section, { marginTop: 18, marginBottom: 8 }]}>Exercises</Text>
          {template.exercises.map((ex, i) => {
            const thumb = exerciseImages[ex.exercise_name];
            return (
              <View key={`${ex.exercise_name}_${i}`} style={styles.previewExRow}>
                {/* GIF thumbnail or numbered fallback */}
                {thumb ? (
                  <Image source={{ uri: thumb }} style={styles.previewExThumb} />
                ) : (
                  <View style={[styles.previewExThumb, { backgroundColor: '#1a1a1c', alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={styles.previewExNumText}>{i + 1}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.previewExName}>{ex.exercise_name}</Text>
                  <Text style={styles.previewExMeta}>
                    {ex.sets} sets
                    {ex.reps ? ` × ${ex.reps} reps` : ''}
                    {ex.rest_seconds ? ` · ${formatRestShort(ex.rest_seconds)} rest` : ''}
                  </Text>
                  {!!ex.cue && <Text style={styles.previewExCue}>{ex.cue}</Text>}
                </View>
                {/* Help/details button */}
                <TouchableOpacity
                  onPress={() => setDetailExercise(ex.exercise_name)}
                  style={styles.previewExHelp}
                  hitSlop={8}
                >
                  <Ionicons name="help-circle" size={22} color="#5B8CFF" />
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
        <View style={styles.tplPreviewFooter}>
          <TouchableOpacity
            style={styles.startBtn}
            onPress={() => onStart(template)}
            activeOpacity={0.85}
          >
            <Ionicons name="play" size={20} color="#000" />
            <Text style={styles.startBtnText}>Start Workout</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise detail popup */}
        <ExerciseQuickDetail
          exerciseName={detailExercise}
          onClose={() => setDetailExercise(null)}
        />
      </View>
    </Modal>
  );
}

const formatRestShort = (s: number) => (s >= 60 ? `${Math.round(s / 60)}m` : `${s}s`);

// ============== PLATE CALCULATOR MODAL ==============
function PlateCalcModal({
  visible,
  weight,
  onClose,
}: {
  visible: boolean;
  weight: number;
  onClose: () => void;
}) {
  const [w, setW] = useState(weight || 100);
  useEffect(() => setW(weight || 100), [weight]);
  const calc = calcPlates(w);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.plateModal} onPress={() => {}}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Plate Calculator</Text>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.plateInputRow}>
            <Text style={styles.plateLabel}>Target Weight (kg)</Text>
            <TextInput
              style={styles.plateInput}
              value={String(w)}
              onChangeText={(v) => setW(parseFloat(v) || 0)}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.plateQuickRow}>
            {[60, 80, 100, 120, 140].map((v) => (
              <TouchableOpacity key={v} style={styles.plateQuick} onPress={() => setW(v)}>
                <Text style={styles.plateQuickText}>{v}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bar visualization */}
          <View style={styles.barContainer}>
            {/* Left side plates (mirrored order) */}
            <View style={styles.plateSide}>
              {[...calc.perSide].reverse().map((p, i) => (
                <View
                  key={`l_${i}`}
                  style={[
                    styles.plate,
                    {
                      backgroundColor: PLATE_COLORS[p],
                      height: 36 + p * 1.2,
                      width: 8 + p * 0.4,
                    },
                  ]}
                />
              ))}
            </View>
            {/* Bar */}
            <View style={styles.bar} />
            {/* Right side plates */}
            <View style={styles.plateSide}>
              {calc.perSide.map((p, i) => (
                <View
                  key={`r_${i}`}
                  style={[
                    styles.plate,
                    {
                      backgroundColor: PLATE_COLORS[p],
                      height: 36 + p * 1.2,
                      width: 8 + p * 0.4,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={styles.plateSummary}>
            Bar 20 kg + {calc.perSide.length * 2} plates ={' '}
            <Text style={{ color: ACCENT, fontWeight: '700' }}>{w} kg</Text>
          </Text>
          <Text style={styles.plateBreakdown}>
            Per side:{' '}
            {calc.perSide.length === 0
              ? 'just the bar'
              : calc.perSide.map((p) => `${p}kg`).join(' + ')}
            {calc.remainder > 0 ? ` (+${calc.remainder}kg short)` : ''}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============== REST TIMER (circular gold ring) ==============
function RestTimerBar({
  secs,
  total,
  onSkip,
  onAdjust,
}: {
  secs: number;
  total: number;
  onSkip: () => void;
  onAdjust: (delta: number) => void;
}) {
  const pct = total > 0 ? secs / total : 0;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - pct);
  return (
    <View style={styles.restBar}>
      <View style={styles.restRow}>
        <TouchableOpacity onPress={() => onAdjust(-15)} style={styles.restBtn}>
          <Text style={styles.restBtnText}>−15</Text>
        </TouchableOpacity>
        <View style={styles.ringWrap}>
          <Svg width={90} height={90} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r={radius} stroke="#222" strokeWidth="6" fill="none" />
            <Circle
              cx="50"
              cy="50"
              r={radius}
              stroke={GOLD}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${circ}`}
              strokeDashoffset={offset}
              transform="rotate(-90 50 50)"
            />
          </Svg>
          <View style={styles.ringInner} pointerEvents="none">
            <Text style={styles.ringTime}>{fmtDur(secs * 1000)}</Text>
            <Text style={styles.ringLabel}>REST</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => onAdjust(15)} style={styles.restBtn}>
          <Text style={styles.restBtnText}>+15</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
          <Ionicons name="play-skip-forward" size={18} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============== PR TOAST ==============
function PRToast({ name, oneRm }: { name: string; oneRm: number }) {
  const scale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 90, friction: 6 }).start();
  }, []);
  return (
    <Animated.View style={[styles.prToast, { transform: [{ scale }] }]}>
      <Ionicons name="trophy" size={28} color="#000" />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={styles.prTitle}>NEW PR! 🎉</Text>
        <Text style={styles.prSub}>
          {name} · est. 1RM {oneRm}kg
        </Text>
      </View>
    </Animated.View>
  );
}

// ============== STYLES ==============
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 64 },
  h1: { color: '#fff', fontSize: 32, fontWeight: '900', letterSpacing: 0.5 },
  h2: { color: TEXT_MUTED, fontSize: 14, marginBottom: 18 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 18,
    borderRadius: 14,
    gap: 8,
    marginBottom: 24,
  },
  startBtnText: { color: '#000', fontWeight: '800', fontSize: 16 },
  section: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionSub: { color: TEXT_MUTED, fontSize: 11, fontWeight: '600' },
  // FIX 3 — Pre-Made Templates collapsible button
  preMadeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  preMadeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preMadeTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  preMadeSub: { color: TEXT_MUTED, fontSize: 11, marginTop: 2, fontWeight: '600' },
  linkText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    width: '48%',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 14,
    minHeight: 142,
  },
  tplIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tplCardName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tplCardMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 4, fontWeight: '500' },
  tplCardMuscles: { color: ACCENT, fontSize: 11, marginTop: 4, fontWeight: '600', textTransform: 'capitalize' },
  tmplChip: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginRight: 10,
    minWidth: 130,
  },
  tmplName: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 8 },
  tmplMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 8 },
  emptySub: { color: TEXT_MUTED, fontSize: 13, marginTop: 4, textAlign: 'center' },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  recentName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  recentMeta: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  iconBtnSmall: { width: 30, height: 30, justifyContent: 'center', alignItems: 'center' },
  timerText: { color: ACCENT, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  timerSub: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  finishBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  finishBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  workoutName: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  exCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  exHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  exName: { color: '#fff', fontSize: 17, fontWeight: '800' },
  exNameRow: { flexDirection: 'row', alignItems: 'center' },
  exMuscle: { color: ACCENT, fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  noteText: { color: ACCENT, fontSize: 11, fontWeight: '600', flexShrink: 1 },
  warmupBadge: {
    backgroundColor: '#FF8C42',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 5,
  },
  warmupBadgeText: { color: '#000', fontSize: 9, fontWeight: '800' },
  muscleThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#0F0F11',
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  playBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF0000',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
    paddingLeft: 1, // optical centering for play triangle
  },
  tooltip: {
    position: 'absolute',
    top: -42,
    left: -22,
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 180,
    zIndex: 50,
    elevation: 6,
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -6,
    left: 30,
    width: 10,
    height: 10,
    backgroundColor: '#000',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: ACCENT,
    transform: [{ rotate: '45deg' }],
  },
  tooltipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  setHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 4,
  },
  setHeadCol: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  setRowDone: { backgroundColor: 'rgba(245,166,35,0.06)', borderRadius: 8 },
  setRowPR: { backgroundColor: 'rgba(245,166,35,0.10)', borderRadius: 8 },
  setNum: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  prevText: { color: TEXT_MUTED, fontSize: 12 },
  setInput: {
    backgroundColor: '#1A1A1A',
    color: '#fff',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  checkBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(245,166,35,0.08)',
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  addSetText: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245,166,35,0.10)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  addExerciseText: { color: ACCENT, fontWeight: '700', fontSize: 15 },
  // Modals
  modalContainer: { flex: 1, backgroundColor: BG },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  groupsRow: { paddingHorizontal: 16, marginBottom: 8, flexGrow: 0, height: 44 },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    marginRight: 8,
  },
  groupChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  groupChipText: { color: '#bbb', fontWeight: '600', fontSize: 13, textTransform: 'capitalize' },
  groupChipTextActive: { color: '#000' },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  exerciseRowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  exerciseRowMuscle: { color: TEXT_MUTED, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  sep: { height: 1, backgroundColor: BORDER, marginHorizontal: 16 },
  emptyResults: { color: TEXT_MUTED, textAlign: 'center', marginTop: 40 },
  // Templates modal
  tmplCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tmplCardName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  tmplCardMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  tplPreviewMetaRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  metaPillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  tplMusclesLine: { color: ACCENT, fontSize: 12, marginTop: 4, fontWeight: '600', textTransform: 'capitalize' },
  tplDesc: { color: TEXT_MUTED, fontSize: 13, marginTop: 8, lineHeight: 18 },
  previewExRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  previewExNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  previewExNumText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  previewExThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#1a1a1c',
    marginRight: 12,
    overflow: 'hidden',
  },
  previewExHelp: {
    paddingLeft: 8,
    paddingTop: 2,
  },
  previewExName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  previewExMeta: { color: TEXT_MUTED, fontSize: 12, marginTop: 3 },
  previewExCue: { color: ACCENT, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  tplPreviewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  // Plate modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  plateModal: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 0,
    borderWidth: 1,
    borderColor: BORDER,
  },
  plateInputRow: { paddingHorizontal: 16, paddingTop: 12 },
  plateLabel: { color: TEXT_MUTED, fontSize: 12, marginBottom: 6 },
  plateInput: {
    backgroundColor: '#1A1A1A',
    color: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: '700',
  },
  plateQuickRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 10, gap: 8 },
  plateQuick: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  plateQuickText: { color: '#fff', fontWeight: '700' },
  barContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 12,
  },
  plateSide: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  plate: { borderRadius: 4, borderWidth: 1, borderColor: '#000' },
  bar: { height: 6, width: 80, backgroundColor: '#888', borderRadius: 3 },
  plateSummary: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 16,
  },
  plateBreakdown: {
    color: TEXT_MUTED,
    textAlign: 'center',
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
    marginTop: 4,
  },
  // Rest timer
  restBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  restRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  restBtn: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  restBtnText: { color: '#fff', fontWeight: '700' },
  ringWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ringInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringTime: { color: GOLD, fontSize: 18, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ringLabel: { color: TEXT_MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  skipBtn: { backgroundColor: GOLD, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  // PR toast
  prToast: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: GOLD,
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  prTitle: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  prSub: { color: '#000', fontSize: 12, fontWeight: '600', opacity: 0.85 },
});
