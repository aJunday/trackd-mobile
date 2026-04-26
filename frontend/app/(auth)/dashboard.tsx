import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#F5A623';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Workout {
  workout_id: string;
  name: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  exercises: Array<{
    exercise_name: string;
    sets: Array<{ weight: number; reps: number; completed: boolean }>;
  }>;
}

export default function DashboardScreen() {
  const { user, sessionToken } = useAuth();
  const router = useRouter();
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchWorkouts = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/workouts`, {
        headers,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRecentWorkouts(data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
    }
  };

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWorkouts();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalSets = (workout: Workout) => {
    return workout.exercises.reduce((acc, ex) => {
      return acc + ex.sets.filter(s => s.completed).length;
    }, 0);
  };

  const getTotalVolume = (workout: Workout) => {
    let volume = 0;
    workout.exercises.forEach(ex => {
      ex.sets.forEach(set => {
        if (set.completed) {
          volume += set.weight * set.reps;
        }
      });
    });
    return volume;
  };

  // Get greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT_COLOR}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userName}>{user?.name || 'Athlete'}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <Ionicons name="person-circle" size={48} color={ACCENT_COLOR} />
          </View>
        </View>

        {/* Quick Start */}
        <TouchableOpacity
          style={styles.quickStartCard}
          onPress={() => router.push('/(auth)/workout')}
          activeOpacity={0.8}
        >
          <View style={styles.quickStartContent}>
            <View style={styles.quickStartIcon}>
              <Ionicons name="add" size={32} color="#000000" />
            </View>
            <View style={styles.quickStartText}>
              <Text style={styles.quickStartTitle}>Start Workout</Text>
              <Text style={styles.quickStartSubtitle}>Begin a new training session</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#000000" />
        </TouchableOpacity>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{recentWorkouts.length}</Text>
              <Text style={styles.statLabel}>Workouts</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {recentWorkouts.reduce((acc, w) => acc + getTotalSets(w), 0)}
              </Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {Math.round(
                  recentWorkouts.reduce((acc, w) => acc + getTotalVolume(w), 0) / 1000
                )}k
              </Text>
              <Text style={styles.statLabel}>Volume (kg)</Text>
            </View>
          </View>
        </View>

        {/* Recent Workouts */}
        <View style={styles.recentContainer}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {recentWorkouts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="barbell-outline" size={48} color="#333333" />
              <Text style={styles.emptyText}>No workouts yet</Text>
              <Text style={styles.emptySubtext}>Start your first workout above!</Text>
            </View>
          ) : (
            recentWorkouts.map((workout) => (
              <TouchableOpacity
                key={workout.workout_id}
                style={styles.workoutCard}
                onPress={() => router.push(`/(auth)/workout?id=${workout.workout_id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.workoutHeader}>
                  <View>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                    <Text style={styles.workoutDate}>
                      {formatDate(workout.started_at)}
                      {workout.duration_minutes && ` • ${workout.duration_minutes} min`}
                    </Text>
                  </View>
                  {workout.completed_at ? (
                    <View style={styles.completedBadge}>
                      <Ionicons name="checkmark" size={14} color="#00FF87" />
                    </View>
                  ) : (
                    <View style={styles.inProgressBadge}>
                      <Text style={styles.inProgressText}>In Progress</Text>
                    </View>
                  )}
                </View>
                <View style={styles.workoutStats}>
                  <Text style={styles.workoutStatText}>
                    {workout.exercises.length} exercises • {getTotalSets(workout)} sets
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#888888',
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStartCard: {
    backgroundColor: ACCENT_COLOR,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  quickStartContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quickStartIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  quickStartText: {},
  quickStartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
  },
  quickStartSubtitle: {
    fontSize: 14,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  recentContainer: {
    marginBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  workoutCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDate: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  completedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 255, 135, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inProgressBadge: {
    backgroundColor: 'rgba(255, 170, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  inProgressText: {
    fontSize: 12,
    color: '#FFAA00',
    fontWeight: '500',
  },
  workoutStats: {
    marginTop: 8,
  },
  workoutStatText: {
    fontSize: 14,
    color: '#888888',
  },
});
