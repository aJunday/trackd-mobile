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

const ACCENT_COLOR = '#00D4FF';
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

export default function HistoryScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
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
        setWorkouts(data);
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
      weekday: 'long',
      year: 'numeric',
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

  // Group workouts by month
  const groupedWorkouts = workouts.reduce((groups, workout) => {
    const date = new Date(workout.started_at);
    const monthYear = date.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    groups[monthYear].push(workout);
    return groups;
  }, {} as Record<string, Workout[]>);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Workout History</Text>
        <Text style={styles.subtitle}>{workouts.length} workouts logged</Text>
      </View>

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
        {workouts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#333333" />
            <Text style={styles.emptyTitle}>No Workouts Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start logging your workouts to see your history here
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => router.push('/(auth)/workout')}
            >
              <Text style={styles.startButtonText}>Start First Workout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          Object.entries(groupedWorkouts).map(([monthYear, monthWorkouts]) => (
            <View key={monthYear} style={styles.monthSection}>
              <Text style={styles.monthTitle}>{monthYear}</Text>
              {monthWorkouts.map((workout) => (
                <TouchableOpacity
                  key={workout.workout_id}
                  style={styles.workoutCard}
                  onPress={() => router.push(`/(auth)/workout?id=${workout.workout_id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.workoutMain}>
                    <View style={styles.workoutInfo}>
                      <Text style={styles.workoutName}>{workout.name}</Text>
                      <Text style={styles.workoutDate}>
                        {formatDate(workout.started_at)}
                      </Text>
                    </View>
                    {workout.completed_at ? (
                      <View style={styles.completedBadge}>
                        <Ionicons name="checkmark" size={16} color="#00FF87" />
                      </View>
                    ) : (
                      <View style={styles.inProgressBadge}>
                        <Ionicons name="ellipsis-horizontal" size={16} color="#FFAA00" />
                      </View>
                    )}
                  </View>

                  <View style={styles.workoutDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="barbell-outline" size={16} color="#666666" />
                      <Text style={styles.detailText}>
                        {workout.exercises.length} exercises
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="layers-outline" size={16} color="#666666" />
                      <Text style={styles.detailText}>
                        {getTotalSets(workout)} sets
                      </Text>
                    </View>
                    {workout.duration_minutes && (
                      <View style={styles.detailItem}>
                        <Ionicons name="time-outline" size={16} color="#666666" />
                        <Text style={styles.detailText}>
                          {workout.duration_minutes} min
                        </Text>
                      </View>
                    )}
                    <View style={styles.detailItem}>
                      <Ionicons name="trending-up-outline" size={16} color="#666666" />
                      <Text style={styles.detailText}>
                        {Math.round(getTotalVolume(workout))} kg
                      </Text>
                    </View>
                  </View>

                  {/* Exercise preview */}
                  <View style={styles.exercisePreview}>
                    {workout.exercises.slice(0, 3).map((ex, idx) => (
                      <Text key={idx} style={styles.exercisePreviewText}>
                        {ex.exercise_name}
                      </Text>
                    ))}
                    {workout.exercises.length > 3 && (
                      <Text style={styles.moreExercises}>
                        +{workout.exercises.length - 3} more
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    padding: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    padding: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 8,
  },
  startButton: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  startButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  monthSection: {
    marginBottom: 24,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 12,
  },
  workoutCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  workoutMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  workoutDate: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 255, 135, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inProgressBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 170, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workoutDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: '#888888',
  },
  exercisePreview: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exercisePreviewText: {
    fontSize: 12,
    color: ACCENT_COLOR,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  moreExercises: {
    fontSize: 12,
    color: '#666666',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
