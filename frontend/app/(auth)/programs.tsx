import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

const ACCENT = '#F5A623';
const PR_ORANGE = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

type Level = 'beginner' | 'intermediate' | 'advanced';

interface DayPlan {
  day: string;
  focus: string;
  exercises: { name: string; sets: number; reps: string; rest: string; cue?: string }[];
}
interface Program {
  level: Level;
  duration_weeks: number;
  days_per_week: number;
  weekly: DayPlan[];
}
interface Sport {
  id: string;
  name: string;
  icon: any; // Ionicons name
  category: 'strength' | 'endurance' | 'team' | 'combat' | 'general';
  blurb: string;
  programs: Record<Level, Program>;
}

const REST_DAY: DayPlan = { day: 'Rest', focus: 'Recovery', exercises: [] };

// Helper to make a basic program shell
const makeProgram = (
  level: Level,
  weekly: DayPlan[],
  weeks = 8
): Program => ({
  level,
  duration_weeks: weeks,
  days_per_week: weekly.filter((d) => d.exercises.length > 0).length,
  weekly,
});

// ==== Detailed programs for primary sports ====
const POWERLIFTING: Record<Level, Program> = {
  beginner: makeProgram('beginner', [
    {
      day: 'Mon',
      focus: 'Squat',
      exercises: [
        { name: 'Squat', sets: 3, reps: '5', rest: '3 min', cue: 'Drive knees out, brace core' },
        { name: 'Bench Press', sets: 3, reps: '5', rest: '3 min', cue: 'Tuck elbows, leg drive' },
        { name: 'Barbell Row', sets: 3, reps: '5', rest: '2 min' },
      ],
    },
    REST_DAY,
    {
      day: 'Wed',
      focus: 'Press',
      exercises: [
        { name: 'Squat', sets: 3, reps: '5', rest: '3 min' },
        { name: 'Overhead Press', sets: 3, reps: '5', rest: '3 min', cue: 'Pack lats' },
        { name: 'Deadlift', sets: 1, reps: '5', rest: '5 min', cue: 'Tight bar path' },
      ],
    },
    REST_DAY,
    {
      day: 'Fri',
      focus: 'Squat',
      exercises: [
        { name: 'Squat', sets: 3, reps: '5', rest: '3 min' },
        { name: 'Bench Press', sets: 3, reps: '5', rest: '3 min' },
        { name: 'Barbell Row', sets: 3, reps: '5', rest: '2 min' },
      ],
    },
    REST_DAY,
    REST_DAY,
  ]),
  intermediate: makeProgram('intermediate', [
    {
      day: 'Mon',
      focus: 'Squat focus',
      exercises: [
        { name: 'Squat', sets: 5, reps: '3', rest: '4 min', cue: 'Pause at bottom' },
        { name: 'Front Squat', sets: 3, reps: '6', rest: '3 min' },
        { name: 'Romanian Deadlift', sets: 3, reps: '8', rest: '2 min' },
        { name: 'Leg Curl', sets: 3, reps: '12', rest: '90s' },
      ],
    },
    {
      day: 'Tue',
      focus: 'Bench focus',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: '3', rest: '4 min' },
        { name: 'Incline DB Press', sets: 4, reps: '8', rest: '2 min' },
        { name: 'Tricep Pushdown', sets: 4, reps: '10', rest: '90s' },
      ],
    },
    REST_DAY,
    {
      day: 'Thu',
      focus: 'Deadlift focus',
      exercises: [
        { name: 'Deadlift', sets: 4, reps: '3', rest: '4 min', cue: 'Wedge into bar' },
        { name: 'Pause Squat', sets: 3, reps: '5', rest: '3 min' },
        { name: 'Barbell Row', sets: 4, reps: '6', rest: '2 min' },
      ],
    },
    {
      day: 'Fri',
      focus: 'OHP + accessories',
      exercises: [
        { name: 'Overhead Press', sets: 5, reps: '5', rest: '3 min' },
        { name: 'Close-Grip Bench', sets: 4, reps: '6', rest: '2 min' },
        { name: 'Pull-up', sets: 4, reps: 'AMRAP', rest: '2 min' },
      ],
    },
    REST_DAY,
    REST_DAY,
  ]),
  advanced: makeProgram('advanced', [
    {
      day: 'Mon',
      focus: 'Squat heavy',
      exercises: [
        { name: 'Squat', sets: 6, reps: '2-3', rest: '5 min', cue: 'RPE 8' },
        { name: 'Pause Squat', sets: 4, reps: '4', rest: '3 min' },
        { name: 'Good Morning', sets: 3, reps: '8', rest: '2 min' },
      ],
    },
    {
      day: 'Tue',
      focus: 'Bench heavy',
      exercises: [
        { name: 'Bench Press', sets: 6, reps: '2-3', rest: '5 min' },
        { name: 'Spoto Press', sets: 4, reps: '5', rest: '3 min' },
        { name: 'JM Press', sets: 4, reps: '8', rest: '2 min' },
      ],
    },
    {
      day: 'Wed',
      focus: 'Pull / accessory',
      exercises: [
        { name: 'Deficit Deadlift', sets: 4, reps: '3', rest: '4 min' },
        { name: 'Barbell Row', sets: 4, reps: '5', rest: '2 min' },
        { name: 'Lat Pulldown', sets: 4, reps: '10', rest: '90s' },
      ],
    },
    REST_DAY,
    {
      day: 'Fri',
      focus: 'Squat volume',
      exercises: [
        { name: 'Squat', sets: 5, reps: '5', rest: '3 min', cue: 'RPE 7' },
        { name: 'Front Squat', sets: 4, reps: '6', rest: '3 min' },
        { name: 'Leg Press', sets: 4, reps: '10', rest: '2 min' },
      ],
    },
    {
      day: 'Sat',
      focus: 'Bench volume + DL',
      exercises: [
        { name: 'Bench Press', sets: 5, reps: '5', rest: '3 min' },
        { name: 'Conventional Deadlift', sets: 4, reps: '4', rest: '4 min' },
        { name: 'Tricep Extension', sets: 4, reps: '12', rest: '90s' },
      ],
    },
    REST_DAY,
  ], 12),
};

const RUNNING: Record<Level, Program> = {
  beginner: makeProgram('beginner', [
    { day: 'Mon', focus: 'Easy run', exercises: [{ name: 'Easy Run', sets: 1, reps: '20 min', rest: '—', cue: 'Conversational pace' }] },
    REST_DAY,
    { day: 'Wed', focus: 'Intervals', exercises: [{ name: 'Run/Walk Intervals', sets: 8, reps: '1 min run / 1 min walk', rest: '—' }] },
    REST_DAY,
    { day: 'Fri', focus: 'Easy run', exercises: [{ name: 'Easy Run', sets: 1, reps: '25 min', rest: '—' }] },
    { day: 'Sat', focus: 'Long', exercises: [{ name: 'Long Run', sets: 1, reps: '30-40 min', rest: '—', cue: 'Build aerobic base' }] },
    REST_DAY,
  ]),
  intermediate: makeProgram('intermediate', [
    { day: 'Mon', focus: 'Easy', exercises: [{ name: 'Easy Run', sets: 1, reps: '45 min', rest: '—' }] },
    { day: 'Tue', focus: 'Tempo', exercises: [{ name: 'Tempo Run', sets: 1, reps: '20 min @ threshold', rest: '—', cue: 'Comfortably hard' }] },
    REST_DAY,
    { day: 'Thu', focus: 'Intervals', exercises: [{ name: '400m Repeats', sets: 8, reps: '400m', rest: '90s jog' }] },
    { day: 'Fri', focus: 'Easy', exercises: [{ name: 'Recovery Run', sets: 1, reps: '30 min', rest: '—' }] },
    { day: 'Sat', focus: 'Long', exercises: [{ name: 'Long Run', sets: 1, reps: '60-75 min', rest: '—' }] },
    REST_DAY,
  ]),
  advanced: makeProgram('advanced', [
    { day: 'Mon', focus: 'Easy', exercises: [{ name: 'Easy Run', sets: 1, reps: '60 min', rest: '—' }] },
    { day: 'Tue', focus: 'Threshold', exercises: [{ name: 'Threshold Run', sets: 1, reps: '4x8 min @ T-pace', rest: '90s jog' }] },
    { day: 'Wed', focus: 'Easy + strides', exercises: [{ name: 'Easy + 6x100m strides', sets: 1, reps: '45 min', rest: '—' }] },
    { day: 'Thu', focus: 'VO2', exercises: [{ name: '1km Repeats', sets: 5, reps: '1km @ 5k pace', rest: '3 min jog' }] },
    REST_DAY,
    { day: 'Sat', focus: 'Long', exercises: [{ name: 'Long Run + surges', sets: 1, reps: '90-110 min', rest: '—', cue: 'Last 20 min uptempo' }] },
    { day: 'Sun', focus: 'Recovery', exercises: [{ name: 'Recovery Run', sets: 1, reps: '40 min', rest: '—' }] },
  ], 12),
};

const BODYBUILDING: Record<Level, Program> = {
  beginner: makeProgram('beginner', [
    { day: 'Mon', focus: 'Full body A', exercises: [
      { name: 'Squat', sets: 3, reps: '8-10', rest: '2 min' },
      { name: 'Bench Press', sets: 3, reps: '8-10', rest: '2 min' },
      { name: 'Lat Pulldown', sets: 3, reps: '10-12', rest: '90s' },
    ]},
    REST_DAY,
    { day: 'Wed', focus: 'Full body B', exercises: [
      { name: 'Romanian Deadlift', sets: 3, reps: '8-10', rest: '2 min' },
      { name: 'Overhead Press', sets: 3, reps: '8-10', rest: '90s' },
      { name: 'Seated Row', sets: 3, reps: '10-12', rest: '90s' },
    ]},
    REST_DAY,
    { day: 'Fri', focus: 'Full body C', exercises: [
      { name: 'Leg Press', sets: 3, reps: '10-12', rest: '90s' },
      { name: 'Incline DB Press', sets: 3, reps: '10', rest: '90s' },
      { name: 'Bicep Curl', sets: 3, reps: '12', rest: '60s' },
    ]},
    REST_DAY, REST_DAY,
  ]),
  intermediate: makeProgram('intermediate', [
    { day: 'Mon', focus: 'Push', exercises: [
      { name: 'Bench Press', sets: 4, reps: '6-8', rest: '2 min' },
      { name: 'Incline DB Press', sets: 4, reps: '8-10', rest: '90s' },
      { name: 'Lateral Raise', sets: 4, reps: '12-15', rest: '60s' },
      { name: 'Tricep Pushdown', sets: 4, reps: '10-12', rest: '60s' },
    ]},
    { day: 'Tue', focus: 'Pull', exercises: [
      { name: 'Deadlift', sets: 3, reps: '5', rest: '3 min' },
      { name: 'Pull-up', sets: 4, reps: '8-10', rest: '2 min' },
      { name: 'Barbell Row', sets: 4, reps: '8', rest: '90s' },
      { name: 'Bicep Curl', sets: 4, reps: '10-12', rest: '60s' },
    ]},
    REST_DAY,
    { day: 'Thu', focus: 'Legs', exercises: [
      { name: 'Squat', sets: 4, reps: '6-8', rest: '3 min' },
      { name: 'Romanian Deadlift', sets: 3, reps: '8', rest: '2 min' },
      { name: 'Leg Press', sets: 3, reps: '12', rest: '2 min' },
      { name: 'Calf Raise', sets: 4, reps: '15', rest: '60s' },
    ]},
    { day: 'Fri', focus: 'Push', exercises: [
      { name: 'Overhead Press', sets: 4, reps: '6-8', rest: '2 min' },
      { name: 'DB Bench', sets: 4, reps: '10', rest: '90s' },
      { name: 'Cable Fly', sets: 3, reps: '12', rest: '60s' },
    ]},
    { day: 'Sat', focus: 'Pull', exercises: [
      { name: 'Lat Pulldown', sets: 4, reps: '10', rest: '90s' },
      { name: 'Seated Row', sets: 4, reps: '10', rest: '90s' },
      { name: 'Face Pull', sets: 4, reps: '15', rest: '60s' },
    ]},
    REST_DAY,
  ]),
  advanced: makeProgram('advanced', [
    { day: 'Mon', focus: 'Chest+Tri', exercises: [
      { name: 'Bench Press', sets: 5, reps: '5-6', rest: '3 min' },
      { name: 'Incline Bench', sets: 4, reps: '8', rest: '2 min' },
      { name: 'Cable Fly', sets: 4, reps: '12', rest: '60s' },
      { name: 'Skull Crusher', sets: 4, reps: '10', rest: '90s' },
    ]},
    { day: 'Tue', focus: 'Back+Bi', exercises: [
      { name: 'Pull-up', sets: 5, reps: '6-8', rest: '2 min' },
      { name: 'Barbell Row', sets: 4, reps: '8', rest: '90s' },
      { name: 'T-Bar Row', sets: 4, reps: '10', rest: '90s' },
      { name: 'Barbell Curl', sets: 4, reps: '8-10', rest: '90s' },
    ]},
    { day: 'Wed', focus: 'Legs', exercises: [
      { name: 'Squat', sets: 5, reps: '5', rest: '3 min' },
      { name: 'Romanian Deadlift', sets: 4, reps: '8', rest: '2 min' },
      { name: 'Leg Press', sets: 4, reps: '12', rest: '2 min' },
      { name: 'Leg Curl', sets: 4, reps: '12', rest: '90s' },
    ]},
    { day: 'Thu', focus: 'Shoulders', exercises: [
      { name: 'OHP', sets: 5, reps: '5', rest: '2 min' },
      { name: 'Lateral Raise', sets: 5, reps: '12-15', rest: '60s' },
      { name: 'Rear Delt Fly', sets: 4, reps: '15', rest: '60s' },
    ]},
    { day: 'Fri', focus: 'Arms', exercises: [
      { name: 'Close-Grip Bench', sets: 4, reps: '8', rest: '90s' },
      { name: 'Bicep Curl', sets: 5, reps: '10', rest: '60s' },
      { name: 'Hammer Curl', sets: 4, reps: '10', rest: '60s' },
      { name: 'Tricep Pushdown', sets: 5, reps: '12', rest: '60s' },
    ]},
    { day: 'Sat', focus: 'Legs/glutes', exercises: [
      { name: 'Front Squat', sets: 4, reps: '8', rest: '2 min' },
      { name: 'Hip Thrust', sets: 4, reps: '10', rest: '2 min' },
      { name: 'Lunges', sets: 3, reps: '12 each', rest: '90s' },
    ]},
    REST_DAY,
  ], 12),
};

// Generic placeholder programs for the remaining sports
const placeholderProgram = (sport: string, level: Level): Program => {
  const reps = level === 'beginner' ? '10-12' : level === 'intermediate' ? '8-10' : '5-8';
  const sets = level === 'beginner' ? 3 : level === 'intermediate' ? 4 : 5;
  return makeProgram(level, [
    { day: 'Mon', focus: `${sport} skill`, exercises: [
      { name: `${sport} Skill Drill`, sets, reps, rest: '90s' },
      { name: 'Conditioning', sets: 1, reps: '15 min', rest: '—' },
    ]},
    { day: 'Tue', focus: 'Strength', exercises: [
      { name: 'Squat', sets, reps, rest: '2 min' },
      { name: 'Push-up', sets, reps: '15-20', rest: '90s' },
    ]},
    REST_DAY,
    { day: 'Thu', focus: `${sport} practice`, exercises: [
      { name: `${sport} Drill`, sets, reps, rest: '90s' },
    ]},
    { day: 'Fri', focus: 'Strength', exercises: [
      { name: 'Deadlift', sets, reps, rest: '2 min' },
      { name: 'Pull-up', sets, reps: '6-10', rest: '90s' },
    ]},
    { day: 'Sat', focus: 'Conditioning', exercises: [
      { name: 'Sprint Intervals', sets: 6, reps: '30s on / 60s off', rest: '—' },
    ]},
    REST_DAY,
  ]);
};

const SPORTS: Sport[] = [
  { id: 'powerlifting', name: 'Powerlifting', icon: 'barbell-outline', category: 'strength', blurb: 'Build the big 3', programs: POWERLIFTING },
  { id: 'bodybuilding', name: 'Bodybuilding', icon: 'body-outline', category: 'strength', blurb: 'Hypertrophy focused', programs: BODYBUILDING },
  { id: 'running', name: 'Running', icon: 'walk-outline', category: 'endurance', blurb: '5K → marathon', programs: RUNNING },
  { id: 'crossfit', name: 'CrossFit', icon: 'flash-outline', category: 'strength', blurb: 'Mixed modal fitness', programs: { beginner: placeholderProgram('CrossFit', 'beginner'), intermediate: placeholderProgram('CrossFit', 'intermediate'), advanced: placeholderProgram('CrossFit', 'advanced') } },
  { id: 'cycling', name: 'Cycling', icon: 'bicycle-outline', category: 'endurance', blurb: 'Road & gravel', programs: { beginner: placeholderProgram('Cycling', 'beginner'), intermediate: placeholderProgram('Cycling', 'intermediate'), advanced: placeholderProgram('Cycling', 'advanced') } },
  { id: 'swimming', name: 'Swimming', icon: 'water-outline', category: 'endurance', blurb: 'Pool & open water', programs: { beginner: placeholderProgram('Swimming', 'beginner'), intermediate: placeholderProgram('Swimming', 'intermediate'), advanced: placeholderProgram('Swimming', 'advanced') } },
  { id: 'soccer', name: 'Soccer', icon: 'football-outline', category: 'team', blurb: 'Speed + agility', programs: { beginner: placeholderProgram('Soccer', 'beginner'), intermediate: placeholderProgram('Soccer', 'intermediate'), advanced: placeholderProgram('Soccer', 'advanced') } },
  { id: 'basketball', name: 'Basketball', icon: 'basketball-outline', category: 'team', blurb: 'Vertical + skill', programs: { beginner: placeholderProgram('Basketball', 'beginner'), intermediate: placeholderProgram('Basketball', 'intermediate'), advanced: placeholderProgram('Basketball', 'advanced') } },
  { id: 'tennis', name: 'Tennis', icon: 'tennisball-outline', category: 'team', blurb: 'Power & rotation', programs: { beginner: placeholderProgram('Tennis', 'beginner'), intermediate: placeholderProgram('Tennis', 'intermediate'), advanced: placeholderProgram('Tennis', 'advanced') } },
  { id: 'boxing', name: 'Boxing', icon: 'fitness-outline', category: 'combat', blurb: 'Cardio & explosivity', programs: { beginner: placeholderProgram('Boxing', 'beginner'), intermediate: placeholderProgram('Boxing', 'intermediate'), advanced: placeholderProgram('Boxing', 'advanced') } },
  { id: 'mma', name: 'MMA', icon: 'flame-outline', category: 'combat', blurb: 'Mixed disciplines', programs: { beginner: placeholderProgram('MMA', 'beginner'), intermediate: placeholderProgram('MMA', 'intermediate'), advanced: placeholderProgram('MMA', 'advanced') } },
  { id: 'bjj', name: 'BJJ', icon: 'shield-outline', category: 'combat', blurb: 'Grappling fitness', programs: { beginner: placeholderProgram('BJJ', 'beginner'), intermediate: placeholderProgram('BJJ', 'intermediate'), advanced: placeholderProgram('BJJ', 'advanced') } },
  { id: 'climbing', name: 'Climbing', icon: 'trending-up-outline', category: 'general', blurb: 'Bouldering & sport', programs: { beginner: placeholderProgram('Climbing', 'beginner'), intermediate: placeholderProgram('Climbing', 'intermediate'), advanced: placeholderProgram('Climbing', 'advanced') } },
  { id: 'volleyball', name: 'Volleyball', icon: 'baseball-outline', category: 'team', blurb: 'Jump & power', programs: { beginner: placeholderProgram('Volleyball', 'beginner'), intermediate: placeholderProgram('Volleyball', 'intermediate'), advanced: placeholderProgram('Volleyball', 'advanced') } },
  { id: 'golf', name: 'Golf', icon: 'golf-outline', category: 'general', blurb: 'Mobility & rotation', programs: { beginner: placeholderProgram('Golf', 'beginner'), intermediate: placeholderProgram('Golf', 'intermediate'), advanced: placeholderProgram('Golf', 'advanced') } },
  { id: 'cricket', name: 'Cricket', icon: 'baseball-outline', category: 'team', blurb: 'Bat / bowl power', programs: { beginner: placeholderProgram('Cricket', 'beginner'), intermediate: placeholderProgram('Cricket', 'intermediate'), advanced: placeholderProgram('Cricket', 'advanced') } },
  { id: 'rugby', name: 'Rugby', icon: 'football-outline', category: 'team', blurb: 'Strength & contact', programs: { beginner: placeholderProgram('Rugby', 'beginner'), intermediate: placeholderProgram('Rugby', 'intermediate'), advanced: placeholderProgram('Rugby', 'advanced') } },
  { id: 'general', name: 'General Fitness', icon: 'pulse-outline', category: 'general', blurb: 'Health + longevity', programs: { beginner: placeholderProgram('General', 'beginner'), intermediate: placeholderProgram('General', 'intermediate'), advanced: placeholderProgram('General', 'advanced') } },
];

const CATEGORIES: { id: 'all' | Sport['category']; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'endurance', label: 'Endurance' },
  { id: 'team', label: 'Team' },
  { id: 'combat', label: 'Combat' },
  { id: 'general', label: 'General' },
];

export default function ProgramsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | Sport['category']>('all');
  const [selected, setSelected] = useState<Sport | null>(null);
  const [level, setLevel] = useState<Level>('beginner');

  const sports = useMemo(
    () => (filter === 'all' ? SPORTS : SPORTS.filter((s) => s.category === filter)),
    [filter]
  );

  const startTodaysWorkout = (program: Program) => {
    haptic();
    // pick first day with exercises
    const today = program.weekly.find((d) => d.exercises.length > 0);
    if (!today) return;
    // Pre-fill via URL (workout screen could read params, but for now just navigate)
    router.push('/(auth)/workout');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={styles.h1}>Programs</Text>
        <Text style={styles.h2}>18 sports · 3 levels each · weekly schedules</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 14 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity
              key={c.id}
              style={[styles.catChip, filter === c.id && styles.catChipActive]}
              onPress={() => {
                haptic();
                setFilter(c.id);
              }}
            >
              <Text style={[styles.catText, filter === c.id && styles.catTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {sports.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={styles.sportCard}
              onPress={() => {
                haptic();
                setSelected(s);
                setLevel('beginner');
              }}
            >
              <View style={styles.sportIconWrap}>
                <Ionicons name={s.icon} size={26} color={ACCENT} />
              </View>
              <Text style={styles.sportName}>{s.name}</Text>
              <Text style={styles.sportBlurb}>{s.blurb}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Program detail modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <ProgramDetail
            sport={selected}
            level={level}
            onChangeLevel={setLevel}
            onClose={() => setSelected(null)}
            onStart={(p) => startTodaysWorkout(p)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

function ProgramDetail({
  sport,
  level,
  onChangeLevel,
  onClose,
  onStart,
}: {
  sport: Sport;
  level: Level;
  onChangeLevel: (l: Level) => void;
  onClose: () => void;
  onStart: (p: Program) => void;
}) {
  const insets = useSafeAreaInsets();
  const program = sport.programs[level];
  return (
    <View style={[styles.detailContainer, { paddingTop: insets.top || 16 }]}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.detailTitle}>{sport.name}</Text>
          <Text style={styles.detailSub}>
            {program.duration_weeks} weeks · {program.days_per_week} days/wk
          </Text>
        </View>
      </View>

      <View style={styles.levelRow}>
        {(['beginner', 'intermediate', 'advanced'] as Level[]).map((l) => (
          <TouchableOpacity
            key={l}
            style={[styles.levelChip, level === l && styles.levelChipActive]}
            onPress={() => {
              haptic();
              onChangeLevel(l);
            }}
          >
            <Text style={[styles.levelText, level === l && styles.levelTextActive]}>
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {program.weekly.map((d, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{d.day}</Text>
              <Text style={styles.dayFocus}>{d.focus}</Text>
            </View>
            {d.exercises.length === 0 ? (
              <Text style={styles.restText}>—</Text>
            ) : (
              d.exercises.map((ex, j) => (
                <View key={j} style={styles.exRow}>
                  <Text style={styles.exName}>{ex.name}</Text>
                  <Text style={styles.exMeta}>
                    {ex.sets} × {ex.reps} · rest {ex.rest}
                  </Text>
                  {ex.cue && <Text style={styles.exCue}>💡 {ex.cue}</Text>}
                </View>
              ))
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.startWrap, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={styles.startBtn} onPress={() => onStart(program)}>
          <Ionicons name="play" size={22} color="#000" />
          <Text style={styles.startText}>Start Today&apos;s Workout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  h1: { color: '#fff', fontSize: 30, fontWeight: '900' },
  h2: { color: TEXT_MUTED, fontSize: 13, marginTop: 2 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 8,
  },
  catChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  catText: { color: '#bbb', fontWeight: '700', fontSize: 12 },
  catTextActive: { color: '#000' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sportCard: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sportIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(245,166,35,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  sportName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sportBlurb: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  // Detail modal
  detailContainer: { flex: 1, backgroundColor: BG },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  detailTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  detailSub: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  levelRow: { flexDirection: 'row', padding: 12, gap: 6 },
  levelChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  levelChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  levelText: { color: '#bbb', fontWeight: '700', fontSize: 13 },
  levelTextActive: { color: '#000' },
  dayCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  dayName: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  dayFocus: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  restText: { color: TEXT_MUTED, textAlign: 'center', paddingVertical: 4 },
  exRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BORDER },
  exName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exMeta: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  exCue: { color: '#bbb', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  startWrap: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#0A0A0A',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
  },
  startText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
