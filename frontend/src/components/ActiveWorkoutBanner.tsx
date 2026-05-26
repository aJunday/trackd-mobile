/**
 * ActiveWorkoutBanner — floating gold pill shown across every screen while
 * the user has a workout in progress. Tap to return to the workout.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useActiveWorkout } from '../context/WorkoutContext';

const ACCENT = '#F5A623';

function formatMMSS(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function ActiveWorkoutBanner() {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { active, elapsed } = useActiveWorkout();

  // Hide on the workout screen itself (already there)
  if (!active) return null;
  if (pathname.includes('/workout')) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.pill}
        onPress={() => router.push('/(auth)/workout')}
      >
        <View style={styles.dot} />
        <MaterialCommunityIcons name="dumbbell" size={16} color="#000" />
        <Text style={styles.label}>Ongoing Workout</Text>
        <Text style={styles.timer}>{formatMMSS(elapsed)}</Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color="#000" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 12,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
  },
  label: {
    color: '#000',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  timer: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginLeft: 4,
  },
});
