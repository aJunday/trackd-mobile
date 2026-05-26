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
  Modal,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const WARNING_COLOR = '#FF8C00';
const MISSING_YELLOW = '#FFD93D';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Meal {
  name: string;
  ingredients: string[];
  recipe: string[];  // Step-by-step instructions
  cook_time: number; // Minutes
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

interface MatchedItem {
  raw: string;
  parsed_name: string;
  pantry_item_id: string;
  pantry_name: string;
  pantry_unit?: string;
  available: number;
  deduct: number;
  after: number;
}

interface UnmatchedItem {
  raw: string;
  parsed_name: string;
  quantity?: number;
  unit?: string;
}

interface CookPreview {
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
}

export default function AIChefScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mealCount, setMealCount] = useState(3);

  // Cook-meal modal state
  const [cookModal, setCookModal] = useState<{ visible: boolean; meal: Meal | null; preview: CookPreview | null; loading: boolean; submitting: boolean; addedToList: Record<string, boolean> }>(
    { visible: false, meal: null, preview: null, loading: false, submitting: false, addedToList: {} }
  );

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const openCookModal = async (meal: Meal) => {
    setCookModal({ visible: true, meal, preview: null, loading: true, submitting: false, addedToList: {} });
    try {
      const r = await fetch(`${BACKEND_URL}/api/pantry/cook-meal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          meal_name: meal.name,
          ingredients: meal.ingredients,
          macros: meal.macros,
          meal_type: guessMealType(),
          dry_run: true,
        }),
      });
      const data = await r.json();
      if (data.success) {
        setCookModal((s) => ({ ...s, preview: { matched: data.matched || [], unmatched: data.unmatched || [] }, loading: false }));
      } else {
        setCookModal((s) => ({ ...s, loading: false }));
        Alert.alert('Error', data.message || 'Could not preview the meal');
      }
    } catch (e) {
      console.error(e);
      setCookModal((s) => ({ ...s, loading: false }));
      Alert.alert('Error', 'Failed to check pantry. Please try again.');
    }
  };

  const closeCookModal = () => {
    setCookModal({ visible: false, meal: null, preview: null, loading: false, submitting: false, addedToList: {} });
  };

  const confirmCookMeal = async () => {
    if (!cookModal.meal) return;
    setCookModal((s) => ({ ...s, submitting: true }));
    try {
      const r = await fetch(`${BACKEND_URL}/api/pantry/cook-meal`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          meal_name: cookModal.meal.name,
          ingredients: cookModal.meal.ingredients,
          macros: cookModal.meal.macros,
          meal_type: guessMealType(),
          dry_run: false,
        }),
      });
      const data = await r.json();
      if (data.success) {
        const deducted = (data.matched || []).length;
        const missingCount = (data.unmatched || []).length;
        closeCookModal();
        Alert.alert(
          'Meal Logged 🍴',
          `${deducted} item${deducted === 1 ? '' : 's'} deducted from pantry.${missingCount ? `  ${missingCount} missing item${missingCount === 1 ? '' : 's'} not deducted.` : ''}\n\nThis meal was added to today's nutrition log.`,
        );
      } else {
        setCookModal((s) => ({ ...s, submitting: false }));
        Alert.alert('Error', data.message || 'Could not log the meal');
      }
    } catch (e) {
      console.error(e);
      setCookModal((s) => ({ ...s, submitting: false }));
      Alert.alert('Error', 'Failed to deduct ingredients. Please try again.');
    }
  };

  const addToShoppingList = async (item: UnmatchedItem) => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/shopping-list`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          name: item.parsed_name || item.raw,
          quantity: item.quantity || null,
          unit: item.unit || null,
          source: 'ai_chef',
        }),
      });
      if (r.ok) {
        setCookModal((s) => ({ ...s, addedToList: { ...s.addedToList, [item.raw]: true } }));
      }
    } catch (e) {
      console.error('shopping list add error', e);
    }
  };

  const addAllMissingToShoppingList = async () => {
    if (!cookModal.preview?.unmatched?.length) return;
    const items = cookModal.preview.unmatched.map((u) => ({
      name: u.parsed_name || u.raw,
      quantity: u.quantity || null,
      unit: u.unit || null,
      source: 'ai_chef',
    }));
    try {
      const r = await fetch(`${BACKEND_URL}/api/shopping-list/bulk`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ items }),
      });
      if (r.ok) {
        const flagged: Record<string, boolean> = {};
        cookModal.preview.unmatched.forEach((u) => { flagged[u.raw] = true; });
        setCookModal((s) => ({ ...s, addedToList: { ...s.addedToList, ...flagged } }));
      }
    } catch (e) {
      console.error('shopping list bulk add error', e);
    }
  };

  const guessMealType = (): string => {
    const h = new Date().getHours();
    if (h < 11) return 'breakfast';
    if (h < 16) return 'lunch';
    if (h < 21) return 'dinner';
    return 'snack';
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
                  <View style={styles.mealTitleSection}>
                    <Text style={styles.mealName}>{meal.name}</Text>
                    {meal.cook_time > 0 && (
                      <View style={styles.cookTimeTag}>
                        <Ionicons name="time-outline" size={12} color="#888888" />
                        <Text style={styles.cookTimeText}>{meal.cook_time} min</Text>
                      </View>
                    )}
                  </View>
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
                  <Text style={styles.sectionLabel}>
                    <Ionicons name="list-outline" size={14} color="#888888" /> Ingredients
                  </Text>
                  <View style={styles.ingredientsList}>
                    {meal.ingredients.map((ingredient, i) => (
                      <View key={i} style={styles.ingredientChip}>
                        <Text style={styles.ingredientText}>{ingredient}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Recipe Steps */}
                <View style={styles.recipeSection}>
                  <Text style={styles.sectionLabel}>
                    <Ionicons name="restaurant-outline" size={14} color="#888888" /> Recipe
                  </Text>
                  {meal.recipe && meal.recipe.length > 0 ? (
                    meal.recipe.map((step, i) => (
                      <View key={i} style={styles.recipeStep}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noRecipeText}>Quick meal - no cooking required!</Text>
                  )}
                </View>

                {/* Make This Meal button */}
                <TouchableOpacity
                  style={styles.makeMealButton}
                  onPress={() => openCookModal(meal)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#000000" />
                  <Text style={styles.makeMealText}>Make This Meal</Text>
                </TouchableOpacity>
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
            onPress={() => router.push('/(auth)/shopping-list' as any)}
          >
            <Ionicons name="list-outline" size={20} color={ACCENT_COLOR} />
            <Text style={styles.quickActionText}>Shopping List</Text>
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

      {/* Cook-Meal Confirmation Modal */}
      <Modal
        visible={cookModal.visible}
        animationType="slide"
        transparent
        onRequestClose={closeCookModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Make This Meal</Text>
                {cookModal.meal && (
                  <Text style={styles.modalSubtitle} numberOfLines={1}>{cookModal.meal.name}</Text>
                )}
              </View>
              <TouchableOpacity onPress={closeCookModal} style={styles.modalClose}>
                <Ionicons name="close" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {cookModal.loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={ACCENT_COLOR} />
                <Text style={{ color: '#888888', marginTop: 12 }}>Checking your pantry…</Text>
              </View>
            ) : cookModal.preview ? (
              <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ paddingBottom: 12 }}>
                {/* Matched section */}
                {cookModal.preview.matched.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.modalSection}>
                      <Ionicons name="checkmark-circle" size={14} color={SUCCESS_COLOR} />{'  '}
                      Will be deducted ({cookModal.preview.matched.length})
                    </Text>
                    {cookModal.preview.matched.map((m, i) => (
                      <View key={i} style={styles.modalRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.modalRowName}>{m.pantry_name}</Text>
                          <Text style={styles.modalRowSub}>
                            {m.available.toFixed(1)} {m.pantry_unit || ''} → {m.after.toFixed(1)} {m.pantry_unit || ''}
                          </Text>
                        </View>
                        <View style={styles.modalRowBadge}>
                          <Text style={styles.modalRowBadgeText}>
                            −{m.deduct.toFixed(1)} {m.pantry_unit || ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                {/* Missing/Unmatched section */}
                {cookModal.preview.unmatched.length > 0 && (
                  <View style={{ marginBottom: 8 }}>
                    <View style={styles.missingHeaderRow}>
                      <Text style={[styles.modalSection, { color: MISSING_YELLOW }]}>
                        <Ionicons name="alert-circle" size={14} color={MISSING_YELLOW} />{'  '}
                        Missing from pantry ({cookModal.preview.unmatched.length})
                      </Text>
                      {cookModal.preview.unmatched.length > 1 && (
                        <TouchableOpacity onPress={addAllMissingToShoppingList}>
                          <Text style={styles.addAllText}>Add all</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {cookModal.preview.unmatched.map((u, i) => {
                      const added = !!cookModal.addedToList[u.raw];
                      return (
                        <View key={i} style={[styles.modalRow, styles.modalRowMissing]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.modalRowName, { color: MISSING_YELLOW }]}>{u.raw}</Text>
                            <Text style={[styles.modalRowSub, { color: '#B89A2A' }]}>
                              Not in pantry — add to shopping list?
                            </Text>
                          </View>
                          <TouchableOpacity
                            onPress={() => addToShoppingList(u)}
                            disabled={added}
                            style={[styles.shopBtn, added && styles.shopBtnAdded]}
                          >
                            {added ? (
                              <Ionicons name="checkmark" size={16} color="#000" />
                            ) : (
                              <Ionicons name="add" size={16} color="#000" />
                            )}
                            <Text style={styles.shopBtnText}>{added ? 'Added' : 'Add'}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}

                {cookModal.preview.matched.length === 0 && cookModal.preview.unmatched.length === 0 && (
                  <Text style={{ color: '#888', textAlign: 'center', padding: 20 }}>
                    No ingredients to process.
                  </Text>
                )}

                <Text style={styles.modalFooterNote}>
                  This will log {cookModal.meal?.macros.calories || 0} cal to today's nutrition.
                </Text>
              </ScrollView>
            ) : null}

            {/* Footer buttons */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={closeCookModal}
                disabled={cookModal.submitting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (cookModal.submitting || cookModal.loading) && { opacity: 0.6 }]}
                onPress={confirmCookMeal}
                disabled={cookModal.submitting || cookModal.loading}
              >
                {cookModal.submitting ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <>
                    <Ionicons name="restaurant" size={18} color="#000" />
                    <Text style={styles.modalConfirmText}>
                      {cookModal.preview && cookModal.preview.matched.length > 0
                        ? `Deduct ${cookModal.preview.matched.length} & Log Meal`
                        : 'Log Meal'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    alignItems: 'flex-start',
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
    marginTop: 2,
  },
  mealNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  mealTitleSection: {
    flex: 1,
  },
  mealName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cookTimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  cookTimeText: {
    fontSize: 12,
    color: '#888888',
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
  sectionLabel: {
    fontSize: 13,
    color: '#888888',
    marginBottom: 10,
    fontWeight: '500',
  },
  ingredientsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  ingredientText: {
    fontSize: 13,
    color: ACCENT_COLOR,
  },
  recipeSection: {
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 16,
  },
  recipeStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: ACCENT_COLOR,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#CCCCCC',
    lineHeight: 20,
  },
  noRecipeText: {
    fontSize: 14,
    color: '#888888',
    fontStyle: 'italic',
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
  // Make Meal button + modal styles
  makeMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  makeMealText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: '#1A1A1A',
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSection: {
    fontSize: 12,
    fontWeight: '700',
    color: SUCCESS_COLOR,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141414',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  modalRowMissing: {
    backgroundColor: 'rgba(255, 217, 61, 0.07)',
    borderColor: 'rgba(255, 217, 61, 0.3)',
  },
  modalRowName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  modalRowSub: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  modalRowBadge: {
    backgroundColor: 'rgba(0, 255, 135, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modalRowBadgeText: {
    color: SUCCESS_COLOR,
    fontSize: 12,
    fontWeight: '700',
  },
  missingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  addAllText: {
    color: MISSING_YELLOW,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MISSING_YELLOW,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  shopBtnAdded: {
    backgroundColor: '#7AB728',
  },
  shopBtnText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  modalFooterNote: {
    color: '#666666',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  modalCancel: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirm: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SUCCESS_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalConfirmText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
});
