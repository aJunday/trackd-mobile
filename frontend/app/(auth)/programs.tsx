import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SPORTS, LEVEL_DESCRIPTIONS, Level, Sport, Program, DayPlan } from '../../src/data/programs';
import { useAuth } from '../_layout';

const ACCENT = '#F5A623';
const PR_ORANGE = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const SUCCESS = '#06D6A0';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const haptic = (t: 'light' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

interface CurrentProgramData {
  active: any | null;
  completed_count?: number;
  total_days?: number;
  completion_pct?: number;
  current_week?: number;
  current_day?: number;
}

export default function ProgramsScreen() {
  const router = useRouter();
  const { sessionToken } = useAuth();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Sport | null>(null);
  const [level, setLevel] = useState<Level>('beginner');
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const [currentProgram, setCurrentProgram] = useState<CurrentProgramData | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const apiHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  const loadCurrent = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/programs/current`, { headers: apiHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCurrentProgram(data);
      }
    } catch (e) {
      console.log('loadCurrent err', e);
    } finally {
      setLoadingCurrent(false);
      setRefreshing(false);
    }
  }, [sessionToken, apiHeaders]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SPORTS;
    return SPORTS.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.blurb.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [search]);

  const openSport = (sport: Sport) => {
    haptic();
    setSelected(sport);
    setLevel('beginner');
    setShowLevelPicker(true);
  };

  const confirmLevel = (lvl: Level) => {
    haptic('success');
    setLevel(lvl);
    setShowLevelPicker(false);
    setShowDetail(true);
  };

  const startProgram = async (sport: Sport, program: Program) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/programs/start`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          sport_id: sport.id,
          sport_name: sport.name,
          level: program.level,
          total_weeks: program.duration_weeks,
          days_per_week: program.sessions_per_week,
        }),
      });
      if (res.ok) {
        haptic('success');
        await loadCurrent();
      }
    } catch {
      /* ignore */
    }
  };

  const restartProgram = async () => {
    Alert.alert('Restart program?', 'Completed days will be cleared.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${BACKEND_URL}/api/programs/restart`, {
            method: 'POST',
            headers: apiHeaders(),
          });
          loadCurrent();
        },
      },
    ]);
  };

  const abandonProgram = async () => {
    Alert.alert('Abandon program?', 'You can pick a new one anytime.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Abandon',
        style: 'destructive',
        onPress: async () => {
          await fetch(`${BACKEND_URL}/api/programs/current`, {
            method: 'DELETE',
            headers: apiHeaders(),
          });
          loadCurrent();
        },
      },
    ]);
  };

  const startDayWorkout = async (sport: Sport, program: Program, week: number, dayIdx: number, dayPlan: DayPlan) => {
    haptic('success');
    if (dayPlan.exercises.length === 0) {
      Alert.alert('Rest Day', 'No exercises scheduled. Take a recovery day.');
      return;
    }
    // Ensure the program is started (so complete-day works)
    if (!currentProgram?.active || currentProgram.active.sport_id !== sport.id || currentProgram.active.level !== program.level) {
      await startProgram(sport, program);
    }
    // Pre-fill workout via URL params
    const params = new URLSearchParams({
      program: sport.id,
      level: program.level,
      name: `${sport.name} ${program.level} — W${week}D${dayIdx + 1}: ${dayPlan.focus}`,
      week: String(week),
      day: String(dayIdx + 1),
      exercises: JSON.stringify(
        dayPlan.exercises.map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          rest: e.rest,
          cue: e.cue || '',
        }))
      ),
    });
    setShowDetail(false);
    setTimeout(() => {
      router.push(`/(auth)/workout?${params.toString()}` as any);
    }, 150);
  };

  const completeDayManual = async (week: number, day: number) => {
    try {
      await fetch(`${BACKEND_URL}/api/programs/complete-day`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ week, day }),
      });
      haptic('success');
      loadCurrent();
    } catch {
      /* ignore */
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            tintColor={ACCENT}
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCurrent();
            }}
          />
        }
      >
        <View style={{ padding: 16 }}>
          <Text style={styles.h1}>Programs</Text>
          <Text style={styles.h2}>18 sports · 3 levels · research-backed</Text>

          {/* Active program card */}
          {!loadingCurrent && currentProgram?.active && (
            <ActiveProgramCard
              data={currentProgram}
              onRestart={restartProgram}
              onAbandon={abandonProgram}
              onStartToday={() => {
                const sport = SPORTS.find((s) => s.id === currentProgram.active.sport_id);
                if (!sport) return;
                const program = sport.programs[currentProgram.active.level as Level];
                // Find the day for current_week/current_day
                const w = currentProgram.current_week || 1;
                const d = currentProgram.current_day || 1;
                // day maps to Nth non-rest day? Actually we number days 1..days_per_week.
                // Use the weekly plan's Nth non-rest day
                const nonRest = program.weekly.filter((dd) => dd.exercises.length > 0);
                const plan = nonRest[d - 1];
                if (!plan) return;
                startDayWorkout(sport, program, w, program.weekly.indexOf(plan), plan);
              }}
            />
          )}

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={TEXT_MUTED} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search a sport…"
              placeholderTextColor={TEXT_MUTED}
              value={search}
              onChangeText={setSearch}
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sport grid */}
          <View style={styles.grid}>
            {filtered.map((s) => (
              <TouchableOpacity key={s.id} style={styles.card} onPress={() => openSport(s)}>
                <Text style={styles.emoji}>{s.emoji}</Text>
                <Text style={styles.sportName}>{s.name}</Text>
                <Text style={styles.sportBlurb}>{s.blurb}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {filtered.length === 0 && (
            <Text style={styles.empty}>No sports match &quot;{search}&quot;.</Text>
          )}
        </View>
      </ScrollView>

      {/* Level picker */}
      <Modal
        visible={showLevelPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLevelPicker(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setShowLevelPicker(false)}
        >
          <View style={styles.levelModal}>
            {selected && (
              <>
                <View style={styles.levelHeader}>
                  <Text style={{ fontSize: 48 }}>{selected.emoji}</Text>
                  <Text style={styles.levelSport}>{selected.name}</Text>
                  <Text style={styles.levelSub}>Pick your level</Text>
                </View>
                {(['beginner', 'intermediate', 'advanced'] as Level[]).map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={styles.levelOption}
                    onPress={() => confirmLevel(lvl)}
                  >
                    <Text style={styles.levelOptionName}>
                      {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                    </Text>
                    <Text style={styles.levelOptionDesc}>{LEVEL_DESCRIPTIONS[lvl]}</Text>
                    <Text style={styles.levelMeta}>
                      {selected.programs[lvl].duration_weeks}w ·{' '}
                      {selected.programs[lvl].sessions_per_week}/wk
                    </Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Program detail */}
      <Modal
        visible={showDetail}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetail(false)}
      >
        {selected && (
          <ProgramDetail
            sport={selected}
            program={selected.programs[level]}
            currentProgram={currentProgram}
            onClose={() => setShowDetail(false)}
            onStartProgram={() => startProgram(selected, selected.programs[level])}
            onStartDay={(w, dIdx, plan) =>
              startDayWorkout(selected, selected.programs[level], w, dIdx, plan)
            }
            onMarkDayComplete={(w, d) => completeDayManual(w, d)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ============================================================
// Active program card
// ============================================================
function ActiveProgramCard({
  data,
  onRestart,
  onAbandon,
  onStartToday,
}: {
  data: CurrentProgramData;
  onRestart: () => void;
  onAbandon: () => void;
  onStartToday: () => void;
}) {
  const sport = SPORTS.find((s) => s.id === data.active.sport_id);
  const emoji = sport?.emoji || '💪';
  return (
    <View style={styles.activeCard}>
      <View style={styles.activeHead}>
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.activeName}>{data.active.sport_name}</Text>
          <Text style={styles.activeLevel}>
            {String(data.active.level).toUpperCase()} · Week {data.current_week} Day{' '}
            {data.current_day}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.pctNum}>{data.completion_pct ?? 0}%</Text>
          <Text style={styles.pctMeta}>
            {data.completed_count}/{data.total_days}
          </Text>
        </View>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${data.completion_pct ?? 0}%` },
          ]}
        />
      </View>
      <View style={styles.activeActions}>
        <TouchableOpacity style={styles.activeBtn} onPress={onStartToday}>
          <Ionicons name="play" size={16} color="#000" />
          <Text style={styles.activeBtnText}>Start Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.activeBtnAlt, { marginLeft: 8 }]}
          onPress={onRestart}
        >
          <Ionicons name="refresh" size={16} color={ACCENT} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.activeBtnAlt} onPress={onAbandon}>
          <Ionicons name="close" size={16} color={PR_ORANGE} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ============================================================
// Program detail (weekly schedule + calendar)
// ============================================================
function ProgramDetail({
  sport,
  program,
  currentProgram,
  onClose,
  onStartProgram,
  onStartDay,
  onMarkDayComplete,
}: {
  sport: Sport;
  program: Program;
  currentProgram: CurrentProgramData | null;
  onClose: () => void;
  onStartProgram: () => void;
  onStartDay: (week: number, dayIdx: number, plan: DayPlan) => void;
  onMarkDayComplete: (week: number, day: number) => void;
}) {
  const insets = useSafeAreaInsets();

  const isActiveForThis =
    currentProgram?.active?.sport_id === sport.id &&
    currentProgram.active.level === program.level;
  const completedDays: { week: number; day: number }[] = isActiveForThis
    ? currentProgram?.active?.completed_days || []
    : [];
  const completedSet = new Set(completedDays.map((c: any) => `${c.week}_${c.day}`));

  // non-rest days in weekly array (these are the trainable days, numbered 1..sessions_per_week)
  const trainableDays = program.weekly
    .map((d, i) => ({ ...d, originalIdx: i }))
    .filter((d) => d.exercises.length > 0);

  return (
    <View style={[styles.detailContainer, { paddingTop: insets.top || 16 }]}>
      {/* Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
          <Ionicons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.detailTitle}>
            {sport.emoji} {sport.name}
          </Text>
          <Text style={styles.detailSub}>
            {String(program.level).toUpperCase()} · {program.duration_weeks}w ·{' '}
            {program.sessions_per_week}/wk
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        {/* Overview */}
        <View style={styles.overviewCard}>
          <Text style={styles.overviewGoal}>{program.goal}</Text>
          {program.research_backed && (
            <View style={styles.researchBadge}>
              <Ionicons name="school" size={14} color={ACCENT} />
              <Text style={styles.researchText}>Based on peer-reviewed research</Text>
            </View>
          )}
        </View>

        {/* Calendar (only if active for this program) */}
        {isActiveForThis && (
          <>
            <Text style={styles.sectionTitle}>Progress</Text>
            <View style={styles.calendarWrap}>
              {Array.from({ length: program.duration_weeks }).map((_, weekIdx) => {
                const week = weekIdx + 1;
                return (
                  <View key={week} style={styles.calWeek}>
                    <Text style={styles.calWeekLabel}>W{week}</Text>
                    <View style={styles.calDays}>
                      {Array.from({ length: program.sessions_per_week }).map((__, dayIdx) => {
                        const d = dayIdx + 1;
                        const done = completedSet.has(`${week}_${d}`);
                        const isCurrent =
                          currentProgram?.current_week === week &&
                          currentProgram?.current_day === d;
                        return (
                          <TouchableOpacity
                            key={d}
                            style={[
                              styles.calDay,
                              done && styles.calDayDone,
                              isCurrent && !done && styles.calDayCurrent,
                            ]}
                            onLongPress={() => onMarkDayComplete(week, d)}
                          >
                            {done ? (
                              <Ionicons name="checkmark" size={12} color="#000" />
                            ) : (
                              <Text style={styles.calDayNum}>{d}</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>Long-press any day to manually mark complete.</Text>
          </>
        )}

        {/* Weekly schedule */}
        <Text style={styles.sectionTitle}>Weekly Schedule</Text>
        {program.weekly.map((d, i) => {
          const isRest = d.exercises.length === 0;
          // trainable index
          const trainIdx = trainableDays.findIndex((t) => t.originalIdx === i);
          const dayNumber = trainIdx + 1;
          return (
            <View key={i} style={[styles.dayCard, isRest && styles.dayCardRest]}>
              <View style={styles.dayHead}>
                <View>
                  <Text style={styles.dayName}>
                    {d.day}
                    {!isRest && (
                      <Text style={styles.dayNumInline}> · Day {dayNumber}</Text>
                    )}
                  </Text>
                  <Text style={styles.dayFocus}>{d.focus}</Text>
                </View>
                {!isRest && (
                  <TouchableOpacity
                    style={styles.startDayBtn}
                    onPress={() => onStartDay(currentProgram?.current_week || 1, i, d)}
                  >
                    <Ionicons name="play" size={14} color="#000" />
                    <Text style={styles.startDayText}>Start</Text>
                  </TouchableOpacity>
                )}
              </View>
              {d.exercises.map((ex, j) => (
                <View key={j} style={styles.exRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.exName}>{ex.name}</Text>
                    <Text style={styles.exMeta}>
                      {ex.sets} × {ex.reps} · rest {ex.rest}
                    </Text>
                    {!!ex.cue && <Text style={styles.exCue}>💡 {ex.cue}</Text>}
                  </View>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Footer: Start Program (only shows if not yet started) */}
      {!isActiveForThis && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <TouchableOpacity style={styles.startBtn} onPress={onStartProgram}>
            <Ionicons name="flag" size={20} color="#000" />
            <Text style={styles.startBtnText}>Start This Program</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  h1: { color: '#fff', fontSize: 30, fontWeight: '900' },
  h2: { color: TEXT_MUTED, fontSize: 13, marginTop: 2, marginBottom: 14 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  emoji: { fontSize: 30, marginBottom: 4 },
  sportName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sportBlurb: { color: TEXT_MUTED, fontSize: 11 },
  empty: { color: TEXT_MUTED, textAlign: 'center', marginTop: 24 },

  // Active program card
  activeCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: ACCENT,
    marginBottom: 16,
  },
  activeHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  activeName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  activeLevel: { color: ACCENT, fontSize: 11, fontWeight: '700', marginTop: 2, letterSpacing: 0.5 },
  pctNum: { color: ACCENT, fontSize: 22, fontWeight: '900' },
  pctMeta: { color: TEXT_MUTED, fontSize: 11 },
  progressBar: { height: 8, backgroundColor: '#1F1F1F', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: ACCENT, borderRadius: 4 },
  activeActions: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  activeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 10,
    borderRadius: 10,
  },
  activeBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },
  activeBtnAlt: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },

  // Level modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 16 },
  levelModal: { backgroundColor: CARD, borderRadius: 20, borderWidth: 1, borderColor: BORDER, padding: 18 },
  levelHeader: { alignItems: 'center', marginBottom: 14 },
  levelSport: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 8 },
  levelSub: { color: TEXT_MUTED, fontSize: 13, marginTop: 4 },
  levelOption: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  levelOptionName: { color: ACCENT, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  levelOptionDesc: { color: '#bbb', fontSize: 12, marginTop: 4, lineHeight: 18 },
  levelMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 6, fontWeight: '700' },

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
  detailSub: { color: TEXT_MUTED, fontSize: 12, marginTop: 2, letterSpacing: 0.5 },
  overviewCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
  },
  overviewGoal: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  researchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(245,166,35,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
  },
  researchText: { color: ACCENT, fontSize: 11, fontWeight: '700' },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 4, marginBottom: 10 },

  // Calendar
  calendarWrap: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  calWeek: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  calWeekLabel: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', width: 30 },
  calDays: { flexDirection: 'row', flex: 1, gap: 4 },
  calDay: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  calDayNum: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700' },
  calDayDone: { backgroundColor: SUCCESS, borderColor: SUCCESS },
  calDayCurrent: { borderColor: ACCENT, borderWidth: 2 },
  hint: { color: TEXT_MUTED, fontSize: 11, marginBottom: 16, fontStyle: 'italic' },

  // Days
  dayCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  dayCardRest: { opacity: 0.5 },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  dayName: { color: '#fff', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  dayNumInline: { color: ACCENT, fontWeight: '700', fontSize: 12 },
  dayFocus: { color: ACCENT, fontWeight: '700', fontSize: 12, marginTop: 2 },
  startDayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  startDayText: { color: '#000', fontWeight: '800', fontSize: 12 },
  exRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: BORDER },
  exName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exMeta: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  exCue: { color: '#bbb', fontSize: 11, marginTop: 4, fontStyle: 'italic' },

  // Footer
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
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
  startBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
});
