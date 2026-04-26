import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { useAuth } from '../_layout';

const ACCENT = '#F5A623';
const ACCENT_RED = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const PROTEIN = '#FF6B6B';
const CARBS = '#FFD166';
const FATS = '#06D6A0';
const WATER = '#4FC3F7';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Dashboard {
  consumed: { calories: number; protein: number; carbs: number; fats: number };
  goals: { calories: number; protein: number; carbs: number; fats: number };
  remaining: { calories: number; protein: number; carbs: number; fats: number };
  over_goal: boolean;
  water_ml: number;
  water_goal_ml: number;
  streak_days: number;
  meal_count: number;
}

const haptic = (t: 'light' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function KitchenScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      const res = await fetch(`${BACKEND_URL}/api/nutrition/dashboard`, {
        headers: apiHeaders(),
      });
      if (res.ok) setData(await res.json());
    } catch (e) {
      console.log('load dashboard err', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sessionToken, apiHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const addWater = async (ml: number) => {
    haptic();
    try {
      await fetch(`${BACKEND_URL}/api/nutrition/water`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ ml }),
      });
      load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{ color: '#fff' }}>Could not load dashboard</Text>
        </View>
      </SafeAreaView>
    );
  }

  const calorieRingColor = data.over_goal ? ACCENT_RED : ACCENT;
  const calPct = Math.min(100, (data.consumed.calories / data.goals.calories) * 100);
  const proteinPct = Math.min(100, (data.consumed.protein / data.goals.protein) * 100);
  const carbsPct = Math.min(100, (data.consumed.carbs / data.goals.carbs) * 100);
  const fatsPct = Math.min(100, (data.consumed.fats / data.goals.fats) * 100);
  const waterPct = Math.min(100, (data.water_ml / data.water_goal_ml) * 100);

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
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.h1}>Today</Text>
            <Text style={styles.h2}>
              {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          </View>
          {data.streak_days > 0 && (
            <View style={styles.streakChip}>
              <MaterialCommunityIcons name="fire" size={18} color={ACCENT} />
              <Text style={styles.streakText}>{data.streak_days} day{data.streak_days > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* Calorie ring */}
        <View style={styles.ringCard}>
          <View style={styles.ringWrap}>
            <Svg width={180} height={180} viewBox="0 0 100 100">
              <Circle
                cx="50"
                cy="50"
                r="42"
                stroke="#222"
                strokeWidth="8"
                fill="none"
              />
              <Circle
                cx="50"
                cy="50"
                r="42"
                stroke={calorieRingColor}
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${(calPct / 100) * 264} 264`}
                transform="rotate(-90 50 50)"
              />
            </Svg>
            <View style={styles.ringCenter}>
              <Text style={[styles.ringValue, { color: calorieRingColor }]}>
                {Math.round(data.consumed.calories)}
              </Text>
              <Text style={styles.ringLabel}>of {data.goals.calories} kcal</Text>
              <Text style={[styles.ringRem, { color: data.over_goal ? ACCENT_RED : '#bbb' }]}>
                {data.over_goal
                  ? `+${data.consumed.calories - data.goals.calories} over`
                  : `${data.remaining.calories} left`}
              </Text>
            </View>
          </View>
        </View>

        {/* Macros */}
        <Text style={styles.section}>Macros</Text>
        <MacroBar
          label="Protein"
          color={PROTEIN}
          consumed={data.consumed.protein}
          goal={data.goals.protein}
          pct={proteinPct}
        />
        <MacroBar
          label="Carbs"
          color={CARBS}
          consumed={data.consumed.carbs}
          goal={data.goals.carbs}
          pct={carbsPct}
        />
        <MacroBar
          label="Fats"
          color={FATS}
          consumed={data.consumed.fats}
          goal={data.goals.fats}
          pct={fatsPct}
        />

        {/* Water */}
        <Text style={[styles.section, { marginTop: 24 }]}>Water</Text>
        <View style={styles.waterCard}>
          <View style={styles.waterRow}>
            <Ionicons name="water" size={28} color={WATER} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.waterValue}>
                {data.water_ml} <Text style={styles.waterGoal}>/ {data.water_goal_ml} ml</Text>
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${waterPct}%`, backgroundColor: WATER }]} />
              </View>
            </View>
          </View>
          <View style={styles.waterBtns}>
            {[250, 500, 750].map((ml) => (
              <TouchableOpacity key={ml} style={styles.waterBtn} onPress={() => addWater(ml)}>
                <Text style={styles.waterBtnText}>+{ml}ml</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={[styles.section, { marginTop: 24 }]}>Log a meal</Text>

        {/* Big Scan Food CTA */}
        <TouchableOpacity
          style={styles.scanCta}
          onPress={() => router.push('/(auth)/meal-scanner')}
          activeOpacity={0.85}
        >
          <View style={styles.scanCtaIcon}>
            <Ionicons name="scan" size={28} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.scanCtaTitle}>Scan Food</Text>
            <Text style={styles.scanCtaSub}>Photo · Barcode · Label · Indian DB</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#000" />
        </TouchableOpacity>

        <View style={styles.actionsGrid}>
          <ActionTile
            icon="restaurant"
            label="Manual"
            sub="Add by name"
            onPress={() => router.push('/(auth)/log-meal')}
          />
          <ActionTile
            icon="basket"
            label="Pantry"
            sub="From inventory"
            onPress={() => router.push('/(auth)/pantry')}
          />
          <ActionTile
            icon="sparkles"
            label="AI Chef"
            sub="Get a recipe"
            onPress={() => router.push('/(auth)/ai-chef')}
          />
          <ActionTile
            icon="time"
            label="History"
            sub="Past meals"
            onPress={() => router.push('/(auth)/history')}
          />
        </View>

        {data.meal_count > 0 && (
          <Text style={styles.meta}>
            ✓ Logged {data.meal_count} meal{data.meal_count > 1 ? 's' : ''} today
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroBar({
  label,
  color,
  consumed,
  goal,
  pct,
}: {
  label: string;
  color: string;
  consumed: number;
  goal: number;
  pct: number;
}) {
  return (
    <View style={styles.macroCard}>
      <View style={styles.macroHead}>
        <Text style={[styles.macroLabel, { color }]}>{label}</Text>
        <Text style={styles.macroNum}>
          {Math.round(consumed)}
          <Text style={styles.macroGoal}> / {goal}g</Text>
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

function ActionTile({
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
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <Ionicons name={icon} size={22} color={ACCENT} />
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileSub}>{sub}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { padding: 16, paddingBottom: 64 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  h1: { color: '#fff', fontSize: 30, fontWeight: '900', letterSpacing: 0.5 },
  h2: { color: TEXT_MUTED, fontSize: 13, marginTop: 2 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245,166,35,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  streakText: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  ringCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 8,
  },
  ringWrap: { justifyContent: 'center', alignItems: 'center', position: 'relative' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringValue: { fontSize: 36, fontWeight: '900' },
  ringLabel: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  ringRem: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  section: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 10, marginTop: 16 },
  macroCard: {
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  macroHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  macroLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  macroNum: { color: '#fff', fontSize: 14, fontWeight: '700' },
  macroGoal: { color: TEXT_MUTED, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: '#1F1F1F', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  waterCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  waterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  waterValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
  waterGoal: { color: TEXT_MUTED, fontSize: 13, fontWeight: '600' },
  waterBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  waterBtn: {
    flex: 1,
    backgroundColor: 'rgba(79,195,247,0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(79,195,247,0.3)',
  },
  waterBtnText: { color: WATER, fontWeight: '800', fontSize: 13 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  scanCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  scanCtaIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanCtaTitle: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 0.3 },
  scanCtaSub: { color: 'rgba(0,0,0,0.7)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  tile: {
    width: '48%',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  tileLabel: { color: '#fff', fontSize: 14, fontWeight: '800', marginTop: 6 },
  tileSub: { color: TEXT_MUTED, fontSize: 11 },
  meta: { color: TEXT_MUTED, fontSize: 12, marginTop: 16, textAlign: 'center' },
});
