import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const BACKGROUND_COLOR = '#000000';
const CARD_BG = '#0A0A0A';
const BORDER_COLOR = '#1A1A1A';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface SetData {
  set_number: number;
  weight: number;
  reps: number;
  rpe?: number;
  completed: boolean;
  completed_at?: string;
}

interface Exercise {
  exercise_id: string;
  exercise_name: string;
  sets: SetData[];
  notes?: string;
  order: number;
}

interface Workout {
  workout_id: string;
  name: string;
  exercises: Exercise[];
  started_at: string;
  completed_at?: string;
}

interface PreviousExercise {
  exercise_name: string;
  sets: SetData[];
  workout_date: string;
  workout_name: string;
}

export default function WorkoutScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();
  const workoutId = params.id as string | undefined;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [previousData, setPreviousData] = useState<Record<string, PreviousExercise | null>>({});
  
  // Rest Timer State
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTime, setRestTime] = useState(90); // Default 90 seconds
  const [currentRestTime, setCurrentRestTime] = useState(90);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timerAnimation = useRef(new Animated.Value(1)).current;

  const getHeaders = useCallback(() => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  }, [sessionToken]);

  // Fetch or create workout
  useEffect(() => {
    const initWorkout = async () => {
      try {
        if (workoutId) {
          // Fetch existing workout
          const response = await fetch(
            `${BACKEND_URL}/api/workouts/${workoutId}`,
            { headers: getHeaders(), credentials: 'include' }
          );
          if (response.ok) {
            const data = await response.json();
            setWorkout(data);
          }
        } else {
          // Create new workout
          const response = await fetch(`${BACKEND_URL}/api/workouts`, {
            method: 'POST',
            headers: getHeaders(),
            credentials: 'include',
            body: JSON.stringify({ name: 'Workout' }),
          });
          if (response.ok) {
            const data = await response.json();
            setWorkout(data);
          }
        }
      } catch (error) {
        console.error('Error initializing workout:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initWorkout();
  }, [workoutId, getHeaders]);

  // Fetch exercise suggestions
  const fetchSuggestions = async (query: string) => {
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exercises/suggestions?q=${encodeURIComponent(query)}`,
        { headers: getHeaders(), credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  useEffect(() => {
    fetchSuggestions(exerciseSearch);
  }, [exerciseSearch]);

  // Fetch previous exercise data (Copy Previous feature)
  const fetchPreviousData = async (exerciseName: string) => {
    if (previousData[exerciseName] !== undefined) return;
    
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/exercises/history/${encodeURIComponent(exerciseName)}`,
        { headers: getHeaders(), credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        setPreviousData(prev => ({
          ...prev,
          [exerciseName]: data.previous,
        }));
      }
    } catch (error) {
      console.error('Error fetching previous data:', error);
    }
  };

  // Save workout to backend
  const saveWorkout = async (updatedWorkout: Workout) => {
    if (!updatedWorkout.workout_id) return;
    
    try {
      await fetch(`${BACKEND_URL}/api/workouts/${updatedWorkout.workout_id}`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          name: updatedWorkout.name,
          exercises: updatedWorkout.exercises,
        }),
      });
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  // Add exercise
  const addExercise = (exerciseName: string) => {
    if (!workout) return;

    const newExercise: Exercise = {
      exercise_id: `ex_${Date.now()}`,
      exercise_name: exerciseName,
      sets: [
        { set_number: 1, weight: 0, reps: 0, completed: false },
        { set_number: 2, weight: 0, reps: 0, completed: false },
        { set_number: 3, weight: 0, reps: 0, completed: false },
      ],
      order: workout.exercises.length,
    };

    const updatedWorkout = {
      ...workout,
      exercises: [...workout.exercises, newExercise],
    };

    setWorkout(updatedWorkout);
    saveWorkout(updatedWorkout);
    fetchPreviousData(exerciseName);
    setShowExerciseModal(false);
    setExerciseSearch('');
  };

  // Add set to exercise
  const addSet = (exerciseId: string) => {
    if (!workout) return;

    const updatedWorkout = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.exercise_id === exerciseId) {
          const lastSet = ex.sets[ex.sets.length - 1];
          return {
            ...ex,
            sets: [
              ...ex.sets,
              {
                set_number: ex.sets.length + 1,
                weight: lastSet?.weight || 0,
                reps: lastSet?.reps || 0,
                completed: false,
              },
            ],
          };
        }
        return ex;
      }),
    };

    setWorkout(updatedWorkout);
    saveWorkout(updatedWorkout);
  };

  // Update set
  const updateSet = (
    exerciseId: string,
    setIndex: number,
    field: 'weight' | 'reps',
    value: string
  ) => {
    if (!workout) return;

    const numValue = parseFloat(value) || 0;

    const updatedWorkout = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.exercise_id === exerciseId) {
          return {
            ...ex,
            sets: ex.sets.map((set, idx) => {
              if (idx === setIndex) {
                return { ...set, [field]: numValue };
              }
              return set;
            }),
          };
        }
        return ex;
      }),
    };

    setWorkout(updatedWorkout);
    // Debounced save
    saveWorkout(updatedWorkout);
  };

  // Complete set with haptic feedback and rest timer
  const completeSet = (exerciseId: string, setIndex: number) => {
    if (!workout) return;

    // Trigger haptic feedback
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    const updatedWorkout = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.exercise_id === exerciseId) {
          return {
            ...ex,
            sets: ex.sets.map((set, idx) => {
              if (idx === setIndex) {
                return {
                  ...set,
                  completed: !set.completed,
                  completed_at: !set.completed ? new Date().toISOString() : undefined,
                };
              }
              return set;
            }),
          };
        }
        return ex;
      }),
    };

    setWorkout(updatedWorkout);
    saveWorkout(updatedWorkout);

    // Start rest timer if completing set
    const exercise = workout.exercises.find(e => e.exercise_id === exerciseId);
    const set = exercise?.sets[setIndex];
    if (!set?.completed) {
      startRestTimer();
    }
  };

  // Copy previous data
  const copyPrevious = (exercise: Exercise) => {
    const previous = previousData[exercise.exercise_name];
    if (!previous || !workout) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    const updatedWorkout = {
      ...workout,
      exercises: workout.exercises.map(ex => {
        if (ex.exercise_id === exercise.exercise_id) {
          return {
            ...ex,
            sets: previous.sets.map((prevSet, idx) => ({
              set_number: idx + 1,
              weight: prevSet.weight,
              reps: prevSet.reps,
              rpe: prevSet.rpe,
              completed: false,
            })),
          };
        }
        return ex;
      }),
    };

    setWorkout(updatedWorkout);
    saveWorkout(updatedWorkout);
  };

  // Rest timer functions
  const startRestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setCurrentRestTime(restTime);
    setRestTimerActive(true);
    timerAnimation.setValue(1);

    Animated.timing(timerAnimation, {
      toValue: 0,
      duration: restTime * 1000,
      useNativeDriver: false,
    }).start();

    timerRef.current = setInterval(() => {
      setCurrentRestTime(prev => {
        if (prev <= 1) {
          stopRestTimer();
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopRestTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRestTimerActive(false);
  };

  const adjustRestTime = (delta: number) => {
    const newTime = Math.max(15, Math.min(300, restTime + delta));
    setRestTime(newTime);
    if (restTimerActive) {
      setCurrentRestTime(prev => Math.max(0, prev + delta));
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Delete exercise
  const deleteExercise = (exerciseId: string) => {
    if (!workout) return;

    Alert.alert(
      'Delete Exercise',
      'Are you sure you want to delete this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedWorkout = {
              ...workout,
              exercises: workout.exercises.filter(ex => ex.exercise_id !== exerciseId),
            };
            setWorkout(updatedWorkout);
            saveWorkout(updatedWorkout);
          },
        },
      ]
    );
  };

  // Finish workout
  const finishWorkout = async () => {
    if (!workout) return;

    Alert.alert(
      'Finish Workout',
      'Are you sure you want to finish this workout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finish',
          onPress: async () => {
            try {
              await fetch(
                `${BACKEND_URL}/api/workouts/${workout.workout_id}/complete`,
                {
                  method: 'POST',
                  headers: getHeaders(),
                  credentials: 'include',
                }
              );
              
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              
              router.replace('/(auth)/dashboard');
            } catch (error) {
              console.error('Error finishing workout:', error);
            }
          },
        },
      ]
    );
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.workoutTitle}
            value={workout?.name || ''}
            onChangeText={(text) => {
              if (workout) {
                const updated = { ...workout, name: text };
                setWorkout(updated);
                saveWorkout(updated);
              }
            }}
            placeholder="Workout Name"
            placeholderTextColor="#666666"
          />
          <TouchableOpacity
            onPress={finishWorkout}
            style={styles.finishButton}
          >
            <Text style={styles.finishButtonText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Exercises */}
          {workout?.exercises.map((exercise) => (
            <View key={exercise.exercise_id} style={styles.exerciseCard}>
              {/* Exercise Header */}
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.exercise_name}</Text>
                <View style={styles.exerciseActions}>
                  {previousData[exercise.exercise_name] && (
                    <TouchableOpacity
                      onPress={() => copyPrevious(exercise)}
                      style={styles.copyButton}
                    >
                      <Ionicons name="copy-outline" size={18} color={ACCENT_COLOR} />
                      <Text style={styles.copyButtonText}>Copy Previous</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => deleteExercise(exercise.exercise_id)}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Previous Data Hint */}
              {previousData[exercise.exercise_name] && (
                <View style={styles.previousHint}>
                  <Ionicons name="time-outline" size={14} color="#666666" />
                  <Text style={styles.previousHintText}>
                    Last: {previousData[exercise.exercise_name]?.sets
                      .map(s => `${s.weight}kg × ${s.reps}`)
                      .join(', ')}
                  </Text>
                </View>
              )}

              {/* Sets Header */}
              <View style={styles.setsHeader}>
                <Text style={[styles.setHeaderText, { flex: 0.5 }]}>SET</Text>
                <Text style={[styles.setHeaderText, { flex: 1 }]}>PREVIOUS</Text>
                <Text style={[styles.setHeaderText, { flex: 1 }]}>KG</Text>
                <Text style={[styles.setHeaderText, { flex: 1 }]}>REPS</Text>
                <Text style={[styles.setHeaderText, { flex: 0.5 }]}></Text>
              </View>

              {/* Sets */}
              {exercise.sets.map((set, setIndex) => {
                const prevSet = previousData[exercise.exercise_name]?.sets[setIndex];
                
                return (
                  <View
                    key={setIndex}
                    style={[
                      styles.setRow,
                      set.completed && styles.setRowCompleted,
                    ]}
                  >
                    <Text style={[styles.setNumber, { flex: 0.5 }]}>
                      {set.set_number}
                    </Text>
                    <Text style={[styles.previousValue, { flex: 1 }]}>
                      {prevSet ? `${prevSet.weight} × ${prevSet.reps}` : '-'}
                    </Text>
                    <TextInput
                      style={[
                        styles.setInput,
                        { flex: 1 },
                        set.completed && styles.setInputCompleted,
                      ]}
                      value={set.weight > 0 ? set.weight.toString() : ''}
                      onChangeText={(v) => updateSet(exercise.exercise_id, setIndex, 'weight', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#444444"
                    />
                    <TextInput
                      style={[
                        styles.setInput,
                        { flex: 1 },
                        set.completed && styles.setInputCompleted,
                      ]}
                      value={set.reps > 0 ? set.reps.toString() : ''}
                      onChangeText={(v) => updateSet(exercise.exercise_id, setIndex, 'reps', v)}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor="#444444"
                    />
                    <TouchableOpacity
                      style={[
                        styles.checkButton,
                        { flex: 0.5 },
                        set.completed && styles.checkButtonCompleted,
                      ]}
                      onPress={() => completeSet(exercise.exercise_id, setIndex)}
                    >
                      <Ionicons
                        name={set.completed ? 'checkmark' : 'checkmark-outline'}
                        size={20}
                        color={set.completed ? '#000000' : '#666666'}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add Set Button */}
              <TouchableOpacity
                style={styles.addSetButton}
                onPress={() => addSet(exercise.exercise_id)}
              >
                <Ionicons name="add" size={18} color={ACCENT_COLOR} />
                <Text style={styles.addSetText}>Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Add Exercise Button */}
          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={() => setShowExerciseModal(true)}
          >
            <Ionicons name="add-circle" size={24} color={ACCENT_COLOR} />
            <Text style={styles.addExerciseText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Floating Rest Timer */}
        {restTimerActive && (
          <View style={styles.restTimerContainer}>
            <Animated.View
              style={[
                styles.restTimerProgress,
                {
                  width: timerAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
            <View style={styles.restTimerContent}>
              <TouchableOpacity
                onPress={() => adjustRestTime(-15)}
                style={styles.timerAdjustButton}
              >
                <Text style={styles.timerAdjustText}>-15s</Text>
              </TouchableOpacity>
              <View style={styles.timerCenter}>
                <Text style={styles.restTimerLabel}>Rest Timer</Text>
                <Text style={styles.restTimerValue}>{formatTime(currentRestTime)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => adjustRestTime(15)}
                style={styles.timerAdjustButton}
              >
                <Text style={styles.timerAdjustText}>+15s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={stopRestTimer}
                style={styles.timerCloseButton}
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Add Exercise Modal */}
        <Modal
          visible={showExerciseModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowExerciseModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Exercise</Text>
                <TouchableOpacity
                  onPress={() => setShowExerciseModal(false)}
                  style={styles.modalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#666666" />
                <TextInput
                  style={styles.searchInput}
                  value={exerciseSearch}
                  onChangeText={setExerciseSearch}
                  placeholder="Search exercises..."
                  placeholderTextColor="#666666"
                  autoFocus
                />
              </View>

              <ScrollView style={styles.suggestionsList}>
                {exerciseSearch.length > 0 && !suggestions.includes(exerciseSearch) && (
                  <TouchableOpacity
                    style={styles.suggestionItem}
                    onPress={() => addExercise(exerciseSearch)}
                  >
                    <Ionicons name="add" size={20} color={ACCENT_COLOR} />
                    <Text style={styles.suggestionText}>Create "{exerciseSearch}"</Text>
                  </TouchableOpacity>
                )}
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionItem}
                    onPress={() => addExercise(suggestion)}
                  >
                    <Ionicons name="barbell-outline" size={20} color="#666666" />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_COLOR,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  backButton: {
    padding: 8,
  },
  workoutTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginHorizontal: 12,
  },
  finishButton: {
    backgroundColor: SUCCESS_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  finishButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  exerciseCard: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER_COLOR,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  copyButtonText: {
    fontSize: 12,
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
  deleteButton: {
    padding: 8,
  },
  previousHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  previousHintText: {
    fontSize: 12,
    color: '#666666',
  },
  setsHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
    marginBottom: 4,
  },
  setHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  setRowCompleted: {
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  setNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  previousValue: {
    fontSize: 13,
    color: '#555555',
    textAlign: 'center',
  },
  setInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginHorizontal: 4,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  setInputCompleted: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkButtonCompleted: {
    backgroundColor: SUCCESS_COLOR,
  },
  addSetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 4,
  },
  addSetText: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 20,
    gap: 8,
  },
  addExerciseText: {
    fontSize: 16,
    color: ACCENT_COLOR,
    fontWeight: '600',
  },
  // Rest Timer Styles
  restTimerContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  restTimerProgress: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
  },
  restTimerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  timerAdjustButton: {
    padding: 8,
  },
  timerAdjustText: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  timerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  restTimerLabel: {
    fontSize: 12,
    color: '#888888',
  },
  restTimerValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timerCloseButton: {
    padding: 8,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_COLOR,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalCloseButton: {
    padding: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  suggestionsList: {
    maxHeight: 400,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  suggestionText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});
