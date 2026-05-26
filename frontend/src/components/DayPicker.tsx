/**
 * DayPicker — user picks exactly N training days out of the 7 weekdays.
 *
 * Behavior:
 *  - Must select exactly `requiredCount` days.
 *  - If user taps a day when already at quota, the *earliest* selected day is auto-deselected.
 *  - Live preview shows split assignment ("Mon → Push, Wed → Pull, Fri → Legs").
 *  - `onConfirm(days)` is called when the gold confirm button is tapped (only enabled
 *    when exactly the required number of days are selected).
 *
 *  `days` is an ordered array of day indices the user tapped (0=Mon … 6=Sun).
 *  The split sessions are mapped to those days in order.
 */
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#F5A623';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface DayPickerProps {
  requiredCount: number;            // number of training days from the chosen split
  sessionLabels: string[];          // training sessions in order, e.g. ["Push", "Pull", "Legs"]
  initialDays?: number[];           // optional starting selection (day indices)
  confirmLabel?: string;            // label for the confirm button
  onConfirm: (dayIndices: number[]) => void;
}

export default function DayPicker({
  requiredCount,
  sessionLabels,
  initialDays = [],
  confirmLabel = 'Confirm Training Days',
  onConfirm,
}: DayPickerProps) {
  // We track selection AS AN ORDERED ARRAY so we can auto-evict the oldest.
  const [selected, setSelected] = useState<number[]>(
    (initialDays || []).slice(0, requiredCount),
  );

  const isSelected = (idx: number) => selected.includes(idx);

  const toggle = (idx: number) => {
    setSelected((prev) => {
      if (prev.includes(idx)) {
        return prev.filter((d) => d !== idx);
      }
      // Adding — if at quota, evict the earliest tap
      if (prev.length >= requiredCount) {
        return [...prev.slice(1), idx];
      }
      return [...prev, idx];
    });
  };

  // Sorted ascending Mon → Sun for the live preview display
  const sortedSelected = useMemo(
    () => [...selected].sort((a, b) => a - b),
    [selected],
  );

  // Map sessions to chosen days: sessions stay in their original order,
  // mapped to days in ascending day order.
  const assignments = useMemo(() => {
    return sortedSelected.map((dayIdx, i) => ({
      day: DAY_LABELS[dayIdx],
      session: sessionLabels[i] || sessionLabels[i % Math.max(1, sessionLabels.length)],
    }));
  }, [sortedSelected, sessionLabels]);

  const canConfirm = selected.length === requiredCount;

  return (
    <View style={{ width: '100%' }}>
      <Text style={styles.title}>Choose your training days</Text>
      <Text style={styles.subtitle}>
        Pick exactly {requiredCount} day{requiredCount === 1 ? '' : 's'} — we'll assign your sessions to those days.
      </Text>

      {/* 7-day pill row */}
      <View style={styles.pillRow}>
        {DAY_LABELS.map((lbl, idx) => {
          const on = isSelected(idx);
          return (
            <TouchableOpacity
              key={lbl}
              onPress={() => toggle(idx)}
              activeOpacity={0.85}
              style={[styles.pill, on && styles.pillOn]}
            >
              <Text style={[styles.pillText, on && styles.pillTextOn]}>{lbl}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Counter */}
      <View style={styles.counterRow}>
        <Ionicons
          name={canConfirm ? 'checkmark-circle' : 'ellipse-outline'}
          size={14}
          color={canConfirm ? '#2ECC71' : TEXT_MUTED}
        />
        <Text style={[styles.counterText, canConfirm && { color: '#2ECC71' }]}>
          {selected.length}/{requiredCount} selected
        </Text>
      </View>

      {/* Live assignment preview */}
      <View style={styles.assignBox}>
        <Text style={styles.assignLabel}>YOUR WEEK</Text>
        {assignments.length === 0 ? (
          <Text style={styles.assignEmpty}>
            Tap days above to see your schedule preview.
          </Text>
        ) : (
          <View style={styles.assignList}>
            {assignments.map((a) => (
              <View key={a.day} style={styles.assignRow}>
                <Text style={styles.assignDay}>{a.day}</Text>
                <Ionicons name="arrow-forward" size={12} color={TEXT_MUTED} />
                <Text style={styles.assignSession}>{a.session}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Confirm */}
      <TouchableOpacity
        onPress={() => canConfirm && onConfirm(sortedSelected)}
        disabled={!canConfirm}
        activeOpacity={0.85}
        style={[styles.confirmBtn, !canConfirm && { opacity: 0.5 }]}
      >
        <Text style={styles.confirmText}>{confirmLabel}</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
  },
  pillOn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  pillTextOn: { color: '#000000', fontWeight: '900' },

  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  counterText: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '600',
  },

  assignBox: {
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 20,
  },
  assignLabel: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  assignEmpty: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontStyle: 'italic',
  },
  assignList: { gap: 8 },
  assignRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  assignDay: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 40,
  },
  assignSession: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '700',
  },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
  },
  confirmText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
});
