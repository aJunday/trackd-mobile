import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import Svg, { Circle, G } from 'react-native-svg';

const ACCENT_COLOR = '#00D4FF';
const WARNING_COLOR = '#FF8C00';
const SUCCESS_COLOR = '#00FF87';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface NutritionData {
  date: string;
  consumed: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  remaining: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  progress: {
    calories_percent: number;
    exceeded: boolean;
  };
  meals: any[];
}

// Circular Progress Ring Component
function ProgressRing({
  progress,
  exceeded,
  size = 180,
  strokeWidth = 12,
}: {
  progress: number;
  exceeded: boolean;
  size?: number;
  strokeWidth?: number;
}) {
  const animatedProgress = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: Math.min(progress, 100),
      duration: 1000,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const strokeColor = exceeded ? WARNING_COLOR : ACCENT_COLOR;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          {/* Background Circle */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1A1A1A"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {/* Progress Circle */}
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
    </View>
  );
}

export default function KitchenScreen() {
  const { sessionToken, user } = useAuth();
  const router = useRouter();
  const [nutritionData, setNutritionData] = useState<NutritionData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const fetchNutritionData = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/nutrition/today`, {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setNutritionData(data);
      }
    } catch (error) {
      console.error('Error fetching nutrition data:', error);
    }
  };

  useEffect(() => {
    fetchNutritionData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNutritionData();
    setRefreshing(false);
  };

  const getMacroProgress = (consumed: number, goal: number) => {
    if (goal === 0) return 0;
    return Math.min(100, (consumed / goal) * 100);
  };

  const MacroBar = ({
    label,
    consumed,
    goal,
    color,
  }: {
    label: string;
    consumed: number;
    goal: number;
    color: string;
  }) => {
    const progress = getMacroProgress(consumed, goal);
    const remaining = goal - consumed;
    
    return (
      <View style={styles.macroBarContainer}>
        <View style={styles.macroBarHeader}>
          <Text style={styles.macroBarLabel}>{label}</Text>
          <Text style={styles.macroBarValues}>
            <Text style={{ color }}>{Math.round(consumed)}g</Text>
            <Text style={styles.macroBarGoal}> / {goal}g</Text>
          </Text>
        </View>
        <View style={styles.macroBarTrack}>
          <View
            style={[
              styles.macroBarFill,
              { width: `${progress}%`, backgroundColor: color },
            ]}
          />
        </View>
        <Text style={styles.macroBarRemaining}>
          {remaining > 0 ? `${Math.round(remaining)}g remaining` : 'Goal reached!'}
        </Text>
      </View>
    );
  };

  if (!nutritionData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { consumed, goals, remaining, progress } = nutritionData;

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
          <Text style={styles.title}>Kitchen Dashboard</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
        </View>

        {/* Remaining Calories Card with Progress Ring */}
        <View style={[styles.remainingCard, progress.exceeded && styles.remainingCardExceeded]}>
          <View style={styles.ringContainer}>
            <ProgressRing
              progress={progress.calories_percent}
              exceeded={progress.exceeded}
            />
            <View style={styles.ringContent}>
              <Text style={[styles.remainingValue, progress.exceeded && styles.remainingValueExceeded]}>
                {Math.abs(Math.round(remaining.calories))}
              </Text>
              <Text style={styles.remainingLabel}>
                {remaining.calories >= 0 ? 'calories left' : 'over budget'}
              </Text>
            </View>
          </View>

          <View style={styles.consumedSummary}>
            <View style={styles.consumedItem}>
              <Text style={styles.consumedValue}>{Math.round(consumed.calories)}</Text>
              <Text style={styles.consumedLabel}>Consumed</Text>
            </View>
            <View style={styles.goalItem}>
              <Text style={styles.goalValue}>{goals.calories}</Text>
              <Text style={styles.goalLabel}>Daily Goal</Text>
            </View>
          </View>

          {progress.exceeded && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={18} color={WARNING_COLOR} />
              <Text style={styles.warningText}>
                You've exceeded your daily goal by more than 10%
              </Text>
            </View>
          )}
        </View>

        {/* Macro Breakdown */}
        <View style={styles.macrosCard}>
          <Text style={styles.cardTitle}>Macro Breakdown</Text>
          <MacroBar
            label="Protein"
            consumed={consumed.protein}
            goal={goals.protein}
            color="#FF6B6B"
          />
          <MacroBar
            label="Carbs"
            consumed={consumed.carbs}
            goal={goals.carbs}
            color={ACCENT_COLOR}
          />
          <MacroBar
            label="Fats"
            consumed={consumed.fats}
            goal={goals.fats}
            color="#FFE066"
          />
        </View>

        {/* Today's Meals */}
        <View style={styles.mealsSection}>
          <View style={styles.mealsSectionHeader}>
            <Text style={styles.cardTitle}>Today's Meals</Text>
            <TouchableOpacity
              style={styles.addMealButton}
              onPress={() => router.push('/(auth)/log-meal')}
            >
              <Ionicons name="add" size={20} color="#000000" />
              <Text style={styles.addMealText}>Log Meal</Text>
            </TouchableOpacity>
          </View>

          {nutritionData.meals.length === 0 ? (
            <View style={styles.emptyMeals}>
              <Ionicons name="restaurant-outline" size={48} color="#333333" />
              <Text style={styles.emptyMealsText}>No meals logged today</Text>
              <Text style={styles.emptyMealsSubtext}>
                Tap "Log Meal" to start tracking
              </Text>
            </View>
          ) : (
            nutritionData.meals.map((meal, index) => (
              <View key={meal.meal_id || index} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealType}>
                    <Ionicons
                      name={
                        meal.meal_type === 'breakfast'
                          ? 'sunny-outline'
                          : meal.meal_type === 'lunch'
                          ? 'partly-sunny-outline'
                          : meal.meal_type === 'dinner'
                          ? 'moon-outline'
                          : 'cafe-outline'
                      }
                      size={20}
                      color={ACCENT_COLOR}
                    />
                    <Text style={styles.mealTypeName}>
                      {meal.meal_type.charAt(0).toUpperCase() + meal.meal_type.slice(1)}
                    </Text>
                  </View>
                  <Text style={styles.mealCalories}>{Math.round(meal.total_calories)} cal</Text>
                </View>
                <View style={styles.mealMacros}>
                  <Text style={styles.mealMacro}>P: {Math.round(meal.total_protein)}g</Text>
                  <Text style={styles.mealMacro}>C: {Math.round(meal.total_carbs)}g</Text>
                  <Text style={styles.mealMacro}>F: {Math.round(meal.total_fats)}g</Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(auth)/goals')}
          >
            <Ionicons name="settings-outline" size={24} color={ACCENT_COLOR} />
            <Text style={styles.actionText}>Edit Goals</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  date: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  remainingCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    alignItems: 'center',
  },
  remainingCardExceeded: {
    borderColor: WARNING_COLOR,
  },
  ringContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  ringContent: {
    position: 'absolute',
    alignItems: 'center',
  },
  remainingValue: {
    fontSize: 42,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  remainingValueExceeded: {
    color: WARNING_COLOR,
  },
  remainingLabel: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  consumedSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  consumedItem: {
    alignItems: 'center',
  },
  consumedValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  consumedLabel: {
    fontSize: 12,
    color: '#666666',
  },
  goalItem: {
    alignItems: 'center',
  },
  goalValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  goalLabel: {
    fontSize: 12,
    color: '#666666',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    width: '100%',
    gap: 8,
  },
  warningText: {
    fontSize: 13,
    color: WARNING_COLOR,
    flex: 1,
  },
  macrosCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  macroBarContainer: {
    marginBottom: 16,
  },
  macroBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  macroBarLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  macroBarValues: {
    fontSize: 14,
  },
  macroBarGoal: {
    color: '#666666',
  },
  macroBarTrack: {
    height: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroBarRemaining: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  mealsSection: {
    marginBottom: 20,
  },
  mealsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addMealText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyMeals: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  emptyMealsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 12,
  },
  emptyMealsSubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  mealCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealTypeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  mealMacros: {
    flexDirection: 'row',
    gap: 16,
  },
  mealMacro: {
    fontSize: 13,
    color: '#888888',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  actionText: {
    color: ACCENT_COLOR,
    fontWeight: '500',
    fontSize: 14,
  },
});
