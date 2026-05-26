import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#F5A623';
const WARNING_COLOR = '#FF8C00';
const SUCCESS_COLOR = '#2ECC71';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface UserGoals {
  weight?: number;
  height?: number;
  age?: number;
  gender?: string;
  activity_level?: string;
  goal_type: string;
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fats: number;
  protein_percent: number;
  carbs_percent: number;
  fats_percent: number;
}

interface Preset {
  calories: number;
  protein: number;
  description: string;
}

interface TDEEResult {
  tdee: number;
  presets: {
    cutting: Preset;
    maintenance: Preset;
    bulking: Preset;
  };
}

export default function GoalsScreen() {
  const { user, sessionToken, checkAuth } = useAuth();
  const router = useRouter();
  
  const [goals, setGoals] = useState<UserGoals>({
    weight: user?.weight,
    height: user?.height,
    age: user?.age,
    gender: user?.gender,
    activity_level: user?.activity_level || 'moderate',
    goal_type: user?.goal_type || 'maintenance',
    goal_calories: user?.goal_calories || 2200,
    goal_protein: user?.goal_protein || 150,
    goal_carbs: user?.goal_carbs || 250,
    goal_fats: user?.goal_fats || 70,
    protein_percent: user?.protein_percent || 30,
    carbs_percent: user?.carbs_percent || 40,
    fats_percent: user?.fats_percent || 30,
  });
  
  const [tdeeResult, setTdeeResult] = useState<TDEEResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  // Calculate TDEE when body stats change
  const calculateTDEE = async () => {
    if (!goals.weight || !goals.height || !goals.age || !goals.gender) {
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/users/calculate-tdee`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          weight: goals.weight,
          height: goals.height,
          age: goals.age,
          gender: goals.gender,
          activity_level: goals.activity_level || 'moderate',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTdeeResult(data);
      }
    } catch (error) {
      console.error('Error calculating TDEE:', error);
    }
  };

  useEffect(() => {
    if (goals.weight && goals.height && goals.age && goals.gender) {
      calculateTDEE();
    }
  }, [goals.weight, goals.height, goals.age, goals.gender, goals.activity_level]);

  const applyPreset = async (presetType: 'cutting' | 'maintenance' | 'bulking') => {
    if (!tdeeResult) {
      Alert.alert('Missing Info', 'Please enter your weight, height, age, and gender first.');
      return;
    }

    try {
      const response = await fetch(`${BACKEND_URL}/api/users/apply-preset/${presetType}`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setGoals(prev => ({
          ...prev,
          goal_type: presetType,
          goal_calories: data.goals.goal_calories,
          goal_protein: data.goals.goal_protein,
          goal_carbs: data.goals.goal_carbs,
          goal_fats: data.goals.goal_fats,
        }));
        await checkAuth();
        Alert.alert('Success', `Applied ${presetType} preset!`);
      }
    } catch (error) {
      console.error('Error applying preset:', error);
    }
  };

  const saveGoals = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/users/goals`, {
        method: 'PUT',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify(goals),
      });

      if (response.ok) {
        await checkAuth();
        Alert.alert('Success', 'Goals saved successfully!');
      }
    } catch (error) {
      console.error('Error saving goals:', error);
      Alert.alert('Error', 'Failed to save goals');
    } finally {
      setIsSaving(false);
    }
  };

  const updateGoal = (key: keyof UserGoals, value: any) => {
    setGoals(prev => ({ ...prev, [key]: value }));
  };

  const activityLevels = [
    { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
    { value: 'light', label: 'Light', desc: '1-3 days/week' },
    { value: 'moderate', label: 'Moderate', desc: '3-5 days/week' },
    { value: 'active', label: 'Active', desc: '6-7 days/week' },
    { value: 'very_active', label: 'Very Active', desc: 'Athlete level' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Goals & Targets</Text>
          <TouchableOpacity onPress={saveGoals} style={styles.saveButton} disabled={isSaving}>
            <Text style={styles.saveButtonText}>{isSaving ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Body Stats Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Body Stats</Text>
            <Text style={styles.sectionSubtitle}>Used to calculate your TDEE</Text>

            <View style={styles.statsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={goals.weight?.toString() || ''}
                  onChangeText={(v) => updateGoal('weight', parseFloat(v) || undefined)}
                  keyboardType="numeric"
                  placeholder="75"
                  placeholderTextColor="#444444"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Height (cm)</Text>
                <TextInput
                  style={styles.input}
                  value={goals.height?.toString() || ''}
                  onChangeText={(v) => updateGoal('height', parseFloat(v) || undefined)}
                  keyboardType="numeric"
                  placeholder="175"
                  placeholderTextColor="#444444"
                />
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Age</Text>
                <TextInput
                  style={styles.input}
                  value={goals.age?.toString() || ''}
                  onChangeText={(v) => updateGoal('age', parseInt(v) || undefined)}
                  keyboardType="numeric"
                  placeholder="25"
                  placeholderTextColor="#444444"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Gender</Text>
                <View style={styles.genderButtons}>
                  <TouchableOpacity
                    style={[styles.genderButton, goals.gender === 'male' && styles.genderButtonActive]}
                    onPress={() => updateGoal('gender', 'male')}
                  >
                    <Ionicons name="male" size={20} color={goals.gender === 'male' ? '#000' : '#888'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.genderButton, goals.gender === 'female' && styles.genderButtonActive]}
                    onPress={() => updateGoal('gender', 'female')}
                  >
                    <Ionicons name="female" size={20} color={goals.gender === 'female' ? '#000' : '#888'} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Activity Level */}
            <Text style={styles.inputLabel}>Activity Level</Text>
            <View style={styles.activityLevels}>
              {activityLevels.map((level) => (
                <TouchableOpacity
                  key={level.value}
                  style={[
                    styles.activityButton,
                    goals.activity_level === level.value && styles.activityButtonActive,
                  ]}
                  onPress={() => updateGoal('activity_level', level.value)}
                >
                  <Text
                    style={[
                      styles.activityLabel,
                      goals.activity_level === level.value && styles.activityLabelActive,
                    ]}
                  >
                    {level.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quick Presets */}
          {tdeeResult && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Presets</Text>
              <Text style={styles.sectionSubtitle}>
                Your estimated TDEE: <Text style={styles.tdeeValue}>{tdeeResult.tdee} cal</Text>
              </Text>

              <View style={styles.presetsContainer}>
                {/* Cutting */}
                <TouchableOpacity
                  style={[styles.presetCard, goals.goal_type === 'cutting' && styles.presetCardActive]}
                  onPress={() => applyPreset('cutting')}
                >
                  <Ionicons name="trending-down" size={24} color={goals.goal_type === 'cutting' ? '#000' : SUCCESS_COLOR} />
                  <Text style={[styles.presetTitle, goals.goal_type === 'cutting' && styles.presetTitleActive]}>
                    Cutting
                  </Text>
                  <Text style={[styles.presetCalories, goals.goal_type === 'cutting' && styles.presetCaloriesActive]}>
                    {tdeeResult.presets.cutting.calories} cal
                  </Text>
                  <Text style={[styles.presetDesc, goals.goal_type === 'cutting' && styles.presetDescActive]}>
                    TDEE - 500
                  </Text>
                </TouchableOpacity>

                {/* Maintenance */}
                <TouchableOpacity
                  style={[styles.presetCard, goals.goal_type === 'maintenance' && styles.presetCardActive]}
                  onPress={() => applyPreset('maintenance')}
                >
                  <Ionicons name="remove" size={24} color={goals.goal_type === 'maintenance' ? '#000' : ACCENT_COLOR} />
                  <Text style={[styles.presetTitle, goals.goal_type === 'maintenance' && styles.presetTitleActive]}>
                    Maintain
                  </Text>
                  <Text style={[styles.presetCalories, goals.goal_type === 'maintenance' && styles.presetCaloriesActive]}>
                    {tdeeResult.presets.maintenance.calories} cal
                  </Text>
                  <Text style={[styles.presetDesc, goals.goal_type === 'maintenance' && styles.presetDescActive]}>
                    TDEE
                  </Text>
                </TouchableOpacity>

                {/* Bulking */}
                <TouchableOpacity
                  style={[styles.presetCard, goals.goal_type === 'bulking' && styles.presetCardActive]}
                  onPress={() => applyPreset('bulking')}
                >
                  <Ionicons name="trending-up" size={24} color={goals.goal_type === 'bulking' ? '#000' : WARNING_COLOR} />
                  <Text style={[styles.presetTitle, goals.goal_type === 'bulking' && styles.presetTitleActive]}>
                    Bulking
                  </Text>
                  <Text style={[styles.presetCalories, goals.goal_type === 'bulking' && styles.presetCaloriesActive]}>
                    {tdeeResult.presets.bulking.calories} cal
                  </Text>
                  <Text style={[styles.presetDesc, goals.goal_type === 'bulking' && styles.presetDescActive]}>
                    TDEE + 500
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Custom Goals */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <View>
                <Text style={styles.sectionTitle}>Custom Goals</Text>
                <Text style={styles.sectionSubtitle}>Fine-tune your targets</Text>
              </View>
              <Ionicons
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={24}
                color="#888888"
              />
            </TouchableOpacity>

            {showAdvanced && (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Daily Calories</Text>
                  <TextInput
                    style={styles.input}
                    value={goals.goal_calories?.toString() || ''}
                    onChangeText={(v) => updateGoal('goal_calories', parseInt(v) || 0)}
                    keyboardType="numeric"
                    placeholder="2200"
                    placeholderTextColor="#444444"
                  />
                </View>

                <Text style={styles.macroTitle}>Macro Targets (grams)</Text>
                <View style={styles.macroRow}>
                  <View style={styles.macroInput}>
                    <Text style={styles.macroLabel}>Protein</Text>
                    <TextInput
                      style={styles.macroInputField}
                      value={goals.goal_protein?.toString() || ''}
                      onChangeText={(v) => updateGoal('goal_protein', parseInt(v) || 0)}
                      keyboardType="numeric"
                      placeholder="150"
                      placeholderTextColor="#444444"
                    />
                    <Text style={styles.macroUnit}>g</Text>
                  </View>
                  <View style={styles.macroInput}>
                    <Text style={styles.macroLabel}>Carbs</Text>
                    <TextInput
                      style={styles.macroInputField}
                      value={goals.goal_carbs?.toString() || ''}
                      onChangeText={(v) => updateGoal('goal_carbs', parseInt(v) || 0)}
                      keyboardType="numeric"
                      placeholder="250"
                      placeholderTextColor="#444444"
                    />
                    <Text style={styles.macroUnit}>g</Text>
                  </View>
                  <View style={styles.macroInput}>
                    <Text style={styles.macroLabel}>Fats</Text>
                    <TextInput
                      style={styles.macroInputField}
                      value={goals.goal_fats?.toString() || ''}
                      onChangeText={(v) => updateGoal('goal_fats', parseInt(v) || 0)}
                      keyboardType="numeric"
                      placeholder="70"
                      placeholderTextColor="#444444"
                    />
                    <Text style={styles.macroUnit}>g</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          {/* Current Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Current Daily Targets</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{goals.goal_calories}</Text>
                <Text style={styles.summaryLabel}>Calories</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{goals.goal_protein}g</Text>
                <Text style={styles.summaryLabel}>Protein</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{goals.goal_carbs}g</Text>
                <Text style={styles.summaryLabel}>Carbs</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{goals.goal_fats}g</Text>
                <Text style={styles.summaryLabel}>Fats</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonText: {
    color: '#000000',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 16,
  },
  tdeeValue: {
    color: ACCENT_COLOR,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  genderButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  genderButtonActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  activityLevels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  activityButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  activityButtonActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  activityLabel: {
    fontSize: 14,
    color: '#888888',
  },
  activityLabelActive: {
    color: '#000000',
    fontWeight: '600',
  },
  presetsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  presetCard: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1A1A1A',
  },
  presetCardActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  presetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 8,
  },
  presetTitleActive: {
    color: '#000000',
  },
  presetCalories: {
    fontSize: 16,
    fontWeight: '700',
    color: ACCENT_COLOR,
    marginTop: 4,
  },
  presetCaloriesActive: {
    color: '#000000',
  },
  presetDesc: {
    fontSize: 11,
    color: '#666666',
    marginTop: 4,
  },
  presetDescActive: {
    color: 'rgba(0,0,0,0.6)',
  },
  macroTitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 16,
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroInput: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  macroInputField: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  macroUnit: {
    fontSize: 12,
    color: '#666666',
  },
  summaryCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: ACCENT_COLOR,
  },
  summaryTitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#1A1A1A',
  },
});
