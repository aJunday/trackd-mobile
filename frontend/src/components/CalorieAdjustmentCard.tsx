import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ACCENT = '#F5A623';
const SUCCESS = '#2ECC71';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';
const REDUCE_RED = '#FF6B6B';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Suggestion {
  direction: 'reduce' | 'increase';
  goal_type: 'lose_fat' | 'build_muscle' | 'maintain';
  current_weight_kg: number;
  current_calorie_goal?: number | null;
  current_tdee?: number | null;
  new_tdee: number;
  proposed_calories: number;
  proposed_protein: number;
  proposed_carbs: number;
  proposed_fats: number;
  copy: string;
  delta_kg_21d: number;
}

interface Props {
  sessionToken: string | null;
  onApplied?: () => void;
}

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
};

export default function CalorieAdjustmentCard({ sessionToken, onApplied }: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  const load = useCallback(async () => {
    if (!sessionToken) return;
    try {
      const r = await fetch(`${BACKEND_URL}/api/coach/calorie-adjustment`, {
        headers: headers(),
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.suggestion) {
        setSuggestion(data.suggestion);
      } else {
        setSuggestion(null);
      }
    } catch (e) {
      // silent
    }
  }, [sessionToken, headers]);

  useEffect(() => {
    load();
  }, [load]);

  if (!suggestion || dismissed) return null;

  const apply = async () => {
    setApplying(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/coach/apply-calorie-adjustment`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          calories: suggestion.proposed_calories,
          protein: suggestion.proposed_protein,
          carbs: suggestion.proposed_carbs,
          fats: suggestion.proposed_fats,
          tdee: suggestion.new_tdee,
          weight_kg: suggestion.current_weight_kg,
        }),
      });
      if (r.ok) {
        haptic();
        setApplied(true);
        // Hide after 2.5s
        setTimeout(() => {
          setDismissed(true);
          onApplied?.();
        }, 2500);
      }
    } catch (e) {
      console.error('apply calorie adjustment error', e);
    } finally {
      setApplying(false);
    }
  };

  const dirColor = suggestion.direction === 'reduce' ? REDUCE_RED : SUCCESS;
  const dirLabel = suggestion.direction === 'reduce' ? 'REDUCE CALORIES' : 'INCREASE CALORIES';
  const dirIcon = suggestion.direction === 'reduce' ? 'trending-down' : 'trending-up';

  if (applied) {
    return (
      <View style={[styles.card, { borderColor: SUCCESS }]}>
        <View style={styles.successRow}>
          <Ionicons name="checkmark-circle" size={26} color={SUCCESS} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.successTitle}>Goal Updated</Text>
            <Text style={styles.successSub}>
              New calorie goal: {suggestion.proposed_calories} cal · P {suggestion.proposed_protein}g · C {suggestion.proposed_carbs}g · F {suggestion.proposed_fats}g
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.dot, { backgroundColor: dirColor }]} />
        <Text style={[styles.label, { color: dirColor }]}>{dirLabel}</Text>
        <TouchableOpacity onPress={() => setDismissed(true)} style={styles.closeBtn}>
          <Ionicons name="close" size={18} color={TEXT_MUTED} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Time to recalibrate</Text>
      <Text style={styles.body}>{suggestion.copy}</Text>

      {/* Comparison row */}
      <View style={styles.compareRow}>
        <View style={styles.compareCol}>
          <Text style={styles.compareLabel}>WEIGHT</Text>
          <Text style={styles.compareValue}>{suggestion.current_weight_kg.toFixed(1)}<Text style={styles.compareUnit}> kg</Text></Text>
          <Text style={styles.compareDelta}>
            {suggestion.delta_kg_21d > 0 ? '+' : ''}{suggestion.delta_kg_21d.toFixed(1)} kg / 21d
          </Text>
        </View>
        <View style={styles.compareCol}>
          <Text style={styles.compareLabel}>CURRENT</Text>
          <Text style={styles.compareValue}>{suggestion.current_calorie_goal ?? '—'}<Text style={styles.compareUnit}> cal</Text></Text>
          <Text style={styles.compareDelta}>your goal</Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color={TEXT_MUTED} style={{ alignSelf: 'center', marginTop: 18 }} />
        <View style={styles.compareCol}>
          <Text style={styles.compareLabel}>NEW</Text>
          <Text style={[styles.compareValue, { color: dirColor }]}>
            {suggestion.proposed_calories}<Text style={[styles.compareUnit, { color: dirColor }]}> cal</Text>
          </Text>
          <Text style={[styles.compareDelta, { color: dirColor }]}>
            <Ionicons name={dirIcon} size={11} color={dirColor} /> suggested
          </Text>
        </View>
      </View>

      {/* Macro preview */}
      <View style={styles.macroRow}>
        <Text style={styles.macroChip}>
          <Text style={{ color: '#FF6B6B', fontWeight: '800' }}>P</Text>  {suggestion.proposed_protein}g
        </Text>
        <Text style={styles.macroChip}>
          <Text style={{ color: ACCENT, fontWeight: '800' }}>C</Text>  {suggestion.proposed_carbs}g
        </Text>
        <Text style={styles.macroChip}>
          <Text style={{ color: '#FFE066', fontWeight: '800' }}>F</Text>  {suggestion.proposed_fats}g
        </Text>
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.notNowBtn}
          onPress={() => setDismissed(true)}
          disabled={applying}
        >
          <Text style={styles.notNowText}>Not now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyBtn, applying && { opacity: 0.6 }]}
          onPress={apply}
          disabled={applying}
        >
          {applying ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <>
              <Ionicons name="checkmark" size={18} color="#000" />
              <Text style={styles.applyText}>Yes, update my goal</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  body: {
    color: '#CCCCCC',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0D0D0F',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  compareCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  compareLabel: {
    color: TEXT_MUTED,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    marginBottom: 4,
  },
  compareValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  compareUnit: {
    fontSize: 11,
    fontWeight: '600',
    color: TEXT_MUTED,
  },
  compareDelta: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  macroChip: {
    backgroundColor: '#0D0D0F',
    color: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: BORDER,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  notNowBtn: {
    flex: 1,
    backgroundColor: '#1F1F22',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notNowText: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '600',
  },
  applyBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 12,
  },
  applyText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  successSub: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
});
