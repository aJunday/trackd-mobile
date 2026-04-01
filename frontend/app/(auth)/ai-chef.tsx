import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const WARNING_COLOR = '#FF8C00';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Meal {
  name: string;
  ingredients: string[];
  instructions: string;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  };
}

interface SuggestionResponse {
  success: boolean;
  meals?: Meal[];
  remaining?: {
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
  };
  pantry_items_used?: number;
  message?: string;
}

export default function AIChefScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(3);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const fetchSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry/ai-chef/suggest`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ count: mealCount }),
      });

      if (!response.ok) {
        throw new Error('Failed to get suggestions');
      }

      const data = await response.json();
      
      if (data.success) {
        setSuggestions(data);
      } else {
        setError(data.message || 'No suggestions available');
      }
    } catch (err) {
      console.error('AI Chef error:', err);
      setError('Failed to generate meal suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const MealCountSelector = () => (
    <View style={styles.countSelector}>
      {[1, 2, 3].map((count) => (
        <TouchableOpacity
          key={count}
          style={[styles.countButton, mealCount === count && styles.countButtonActive]}
          onPress={() => setMealCount(count)}
        >
          <Text style={[styles.countText, mealCount === count && styles.countTextActive]}>
            {count}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>AI Chef</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={fetchSuggestions}
            tintColor={ACCENT_COLOR}
          />
        }
      >
        {/* Intro Card */}
        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <Ionicons name="sparkles" size={32} color={ACCENT_COLOR} />
          </View>
          <Text style={styles.introTitle}>Smart Meal Suggestions</Text>
          <Text style={styles.introText}>
            AI Chef analyzes your pantry and remaining calories to suggest high-protein meals
            you can make right now.
          </Text>
        </View>

        {/* Meal Count Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How many meals?</Text>
          <MealCountSelector />
        </View>

        {/* Generate Button */}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={fetchSuggestions}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <ActivityIndicator size="small" color="#000000" />
              <Text style={styles.generateText}>Thinking...</Text>
            </>
          ) : (
            <>
              <Ionicons name="restaurant" size={24} color="#000000" />
              <Text style={styles.generateText}>Generate Suggestions</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Error Message */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={WARNING_COLOR} />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.pantryLink}
              onPress={() => router.push('/(auth)/pantry')}
            >
              <Text style={styles.pantryLinkText}>Go to Pantry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Suggestions */}
        {suggestions?.success && suggestions.meals && (
          <>
            {/* Remaining Stats */}
            {suggestions.remaining && (
              <View style={styles.remainingCard}>
                <Text style={styles.remainingTitle}>Remaining Today</Text>
                <View style={styles.remainingRow}>
                  <View style={styles.remainingStat}>
                    <Text style={styles.remainingValue}>{suggestions.remaining.calories}</Text>
                    <Text style={styles.remainingLabel}>cal</Text>
                  </View>
                  <View style={styles.remainingStat}>
                    <Text style={styles.remainingValue}>{suggestions.remaining.protein}g</Text>
                    <Text style={styles.remainingLabel}>P</Text>
                  </View>
                  <View style={styles.remainingStat}>
                    <Text style={styles.remainingValue}>{suggestions.remaining.carbs}g</Text>
                    <Text style={styles.remainingLabel}>C</Text>
                  </View>
                  <View style={styles.remainingStat}>
                    <Text style={styles.remainingValue}>{suggestions.remaining.fats}g</Text>
                    <Text style={styles.remainingLabel}>F</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Meal Cards */}
            <Text style={styles.sectionTitle}>Suggested Meals</Text>
            {suggestions.meals.map((meal, index) => (
              <View key={index} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealNumber}>
                    <Text style={styles.mealNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.mealName}>{meal.name}</Text>
                </View>

                {/* Macros */}
                <View style={styles.mealMacros}>
                  <View style={styles.macroItem}>
                    <Text style={styles.macroValue}>{meal.macros.calories}</Text>
                    <Text style={styles.macroLabel}>cal</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: '#FF6B6B' }]}>
                      {meal.macros.protein}g
                    </Text>
                    <Text style={styles.macroLabel}>P</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: ACCENT_COLOR }]}>
                      {meal.macros.carbs}g
                    </Text>
                    <Text style={styles.macroLabel}>C</Text>
                  </View>
                  <View style={styles.macroItem}>
                    <Text style={[styles.macroValue, { color: '#FFE066' }]}>
                      {meal.macros.fats}g
                    </Text>
                    <Text style={styles.macroLabel}>F</Text>
                  </View>
                </View>

                {/* Ingredients */}
                <View style={styles.ingredientsSection}>
                  <Text style={styles.ingredientsTitle}>Ingredients</Text>
                  <View style={styles.ingredientsList}>
                    {meal.ingredients.map((ingredient, i) => (
                      <View key={i} style={styles.ingredientChip}>
                        <Text style={styles.ingredientText}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Instructions */}
                <View style={styles.instructionsSection}>
                  <Text style={styles.instructionsTitle}>Instructions</Text>
                  <Text style={styles.instructionsText}>{meal.instructions}</Text>
                </View>
              </View>
            ))}

            {/* Pantry info */}
            <View style={styles.pantryInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#666666" />
              <Text style={styles.pantryInfoText}>
                Based on {suggestions.pantry_items_used} items in your pantry
              </Text>
            </View>
          </>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(auth)/pantry')}
          >
            <Ionicons name="basket-outline" size={20} color={ACCENT_COLOR} />
            <Text style={styles.quickActionText}>View Pantry</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(auth)/scanner')}
          >
            <Ionicons name="scan-outline" size={20} color={ACCENT_COLOR} />
            <Text style={styles.quickActionText}>Add Items</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  introCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  introTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  introText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  countSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  countButton: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  countButtonActive: {
    borderColor: ACCENT_COLOR,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
  },
  countText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
  },
  countTextActive: {
    color: ACCENT_COLOR,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 24,
  },
  generateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  errorCard: {
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: WARNING_COLOR,
  },
  errorText: {
    fontSize: 14,
    color: WARNING_COLOR,
    textAlign: 'center',
    marginTop: 8,
  },
  pantryLink: {
    marginTop: 12,
    padding: 8,
  },
  pantryLinkText: {
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
  remainingCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  remainingTitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 12,
  },
  remainingRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  remainingStat: {
    alignItems: 'center',
  },
  remainingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  remainingLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  mealCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  mealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  mealNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  mealNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  mealMacros: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  macroLabel: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  ingredientsSection: {
    marginBottom: 16,
  },
  ingredientsTitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  ingredientText: {
    fontSize: 13,
    color: ACCENT_COLOR,
  },
  instructionsSection: {},
  instructionsTitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 6,
  },
  instructionsText: {
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 22,
  },
  pantryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 24,
  },
  pantryInfoText: {
    fontSize: 13,
    color: '#666666',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    color: ACCENT_COLOR,
    fontWeight: '500',
    fontSize: 14,
  },
});
