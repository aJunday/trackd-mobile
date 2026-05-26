import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#F5A623';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface MealItem {
  item_id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  quantity: number;
  unit: string;
}

export default function LogMealScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();

  const [mealType, setMealType] = useState<string>('lunch');
  const [items, setItems] = useState<MealItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    quantity: '1',
    unit: 'serving',
  });
  const [isLogging, setIsLogging] = useState(false);

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { value: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
    { value: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { value: 'snack', label: 'Snack', icon: 'cafe-outline' },
  ];

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const addItem = () => {
    if (!currentItem.name.trim()) {
      Alert.alert('Error', 'Please enter a food name');
      return;
    }

    const newItem: MealItem = {
      item_id: `mi_${Date.now()}`,
      name: currentItem.name.trim(),
      calories: parseFloat(currentItem.calories) || 0,
      protein: parseFloat(currentItem.protein) || 0,
      carbs: parseFloat(currentItem.carbs) || 0,
      fats: parseFloat(currentItem.fats) || 0,
      quantity: parseFloat(currentItem.quantity) || 1,
      unit: currentItem.unit,
    };

    setItems([...items, newItem]);
    setCurrentItem({
      name: '',
      calories: '',
      protein: '',
      carbs: '',
      fats: '',
      quantity: '1',
      unit: 'serving',
    });
  };

  const removeItem = (itemId: string) => {
    setItems(items.filter((item) => item.item_id !== itemId));
  };

  const getTotals = () => {
    return items.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories * item.quantity,
        protein: acc.protein + item.protein * item.quantity,
        carbs: acc.carbs + item.carbs * item.quantity,
        fats: acc.fats + item.fats * item.quantity,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
  };

  const logMeal = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Please add at least one food item');
      return;
    }

    setIsLogging(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/nutrition/meals`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          meal_type: mealType,
          items: items,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Meal logged successfully!');
        router.back();
      } else {
        throw new Error('Failed to log meal');
      }
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert('Error', 'Failed to log meal');
    } finally {
      setIsLogging(false);
    }
  };

  const totals = getTotals();

  // Common foods for quick add
  const quickFoods = [
    { name: 'Chicken Breast (100g)', calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    { name: 'Brown Rice (1 cup)', calories: 216, protein: 5, carbs: 45, fats: 1.8 },
    { name: 'Eggs (2 large)', calories: 143, protein: 13, carbs: 1, fats: 10 },
    { name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fats: 0.4 },
    { name: 'Greek Yogurt (170g)', calories: 100, protein: 17, carbs: 6, fats: 0.7 },
    { name: 'Oatmeal (1 cup)', calories: 158, protein: 6, carbs: 27, fats: 3 },
  ];

  const addQuickFood = (food: typeof quickFoods[0]) => {
    const newItem: MealItem = {
      item_id: `mi_${Date.now()}`,
      name: food.name,
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
      quantity: 1,
      unit: 'serving',
    };
    setItems([...items, newItem]);
  };

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
          <Text style={styles.title}>Log Meal</Text>
          <TouchableOpacity
            onPress={logMeal}
            style={styles.saveButton}
            disabled={isLogging || items.length === 0}
          >
            <Text style={styles.saveButtonText}>{isLogging ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Meal Type Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Meal Type</Text>
            <View style={styles.mealTypeContainer}>
              {mealTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.mealTypeButton,
                    mealType === type.value && styles.mealTypeButtonActive,
                  ]}
                  onPress={() => setMealType(type.value)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={20}
                    color={mealType === type.value ? '#000000' : '#888888'}
                  />
                  <Text
                    style={[
                      styles.mealTypeLabel,
                      mealType === type.value && styles.mealTypeLabelActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Quick Add */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Add</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.quickFoodsContainer}>
                {quickFoods.map((food, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.quickFoodChip}
                    onPress={() => addQuickFood(food)}
                  >
                    <Text style={styles.quickFoodName}>{food.name.split(' (')[0]}</Text>
                    <Text style={styles.quickFoodCal}>{food.calories} cal</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Add Custom Item */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Food Item</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { flex: 2 }]}
                value={currentItem.name}
                onChangeText={(v) => setCurrentItem({ ...currentItem, name: v })}
                placeholder="Food name"
                placeholderTextColor="#444444"
              />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={currentItem.calories}
                onChangeText={(v) => setCurrentItem({ ...currentItem, calories: v })}
                placeholder="Cal"
                placeholderTextColor="#444444"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.macroInputRow}>
              <View style={styles.macroInputGroup}>
                <Text style={styles.macroInputLabel}>P</Text>
                <TextInput
                  style={styles.macroInput}
                  value={currentItem.protein}
                  onChangeText={(v) => setCurrentItem({ ...currentItem, protein: v })}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInputGroup}>
                <Text style={styles.macroInputLabel}>C</Text>
                <TextInput
                  style={styles.macroInput}
                  value={currentItem.carbs}
                  onChangeText={(v) => setCurrentItem({ ...currentItem, carbs: v })}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.macroInputGroup}>
                <Text style={styles.macroInputLabel}>F</Text>
                <TextInput
                  style={styles.macroInput}
                  value={currentItem.fats}
                  onChangeText={(v) => setCurrentItem({ ...currentItem, fats: v })}
                  placeholder="0"
                  placeholderTextColor="#444444"
                  keyboardType="numeric"
                />
              </View>
              <TouchableOpacity style={styles.addItemButton} onPress={addItem}>
                <Ionicons name="add" size={24} color="#000000" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Items List */}
          {items.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Items ({items.length})</Text>
              {items.map((item) => (
                <View key={item.item_id} style={styles.itemCard}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemMacros}>
                      {Math.round(item.calories * item.quantity)} cal • P:{' '}
                      {Math.round(item.protein * item.quantity)}g • C:{' '}
                      {Math.round(item.carbs * item.quantity)}g • F:{' '}
                      {Math.round(item.fats * item.quantity)}g
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeItem(item.item_id)}
                  >
                    <Ionicons name="close" size={20} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Totals */}
          {items.length > 0 && (
            <View style={styles.totalsCard}>
              <Text style={styles.totalsTitle}>Meal Totals</Text>
              <View style={styles.totalsRow}>
                <View style={styles.totalItem}>
                  <Text style={styles.totalValue}>{Math.round(totals.calories)}</Text>
                  <Text style={styles.totalLabel}>Calories</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalValue}>{Math.round(totals.protein)}g</Text>
                  <Text style={styles.totalLabel}>Protein</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalValue}>{Math.round(totals.carbs)}g</Text>
                  <Text style={styles.totalLabel}>Carbs</Text>
                </View>
                <View style={styles.totalItem}>
                  <Text style={styles.totalValue}>{Math.round(totals.fats)}g</Text>
                  <Text style={styles.totalLabel}>Fats</Text>
                </View>
              </View>
            </View>
          )}
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  mealTypeContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    padding: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  mealTypeButtonActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  mealTypeLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  mealTypeLabelActive: {
    color: '#000000',
  },
  quickFoodsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  quickFoodChip: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  quickFoodName: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  quickFoodCal: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
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
  macroInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  macroInputGroup: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  macroInputLabel: {
    fontSize: 10,
    color: '#666666',
    marginBottom: 4,
  },
  macroInput: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  addItemButton: {
    backgroundColor: ACCENT_COLOR,
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  itemMacros: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  removeButton: {
    padding: 8,
  },
  totalsCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  totalsTitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  totalItem: {
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  totalLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
});
