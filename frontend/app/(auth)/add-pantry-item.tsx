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

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AddPantryItemScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();

  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fats, setFats] = useState('');
  const [brand, setBrand] = useState('');
  const [servingSize, setServingSize] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const handleAdd = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }

    setIsAdding(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          item_name: itemName.trim(),
          quantity: parseFloat(quantity) || 1,
          unit: unit,
          calories_per_unit: parseFloat(calories) || 0,
          protein: parseFloat(protein) || 0,
          carbs: parseFloat(carbs) || 0,
          fats: parseFloat(fats) || 0,
          brand: brand.trim() || undefined,
          serving_size: servingSize.trim() || undefined,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Item added to pantry!', [
          { text: 'Add Another', onPress: resetForm },
          { text: 'View Pantry', onPress: () => router.push('/(auth)/pantry') },
        ]);
      } else {
        throw new Error('Failed to add item');
      }
    } catch (error) {
      console.error('Error adding item:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
    } finally {
      setIsAdding(false);
    }
  };

  const resetForm = () => {
    setItemName('');
    setQuantity('1');
    setUnit('serving');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFats('');
    setBrand('');
    setServingSize('');
  };

  const commonFoods = [
    { name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fats: 3.6 },
    { name: 'Brown Rice', calories: 216, protein: 5, carbs: 45, fats: 1.8 },
    { name: 'Eggs', calories: 143, protein: 13, carbs: 1, fats: 10 },
    { name: 'Salmon', calories: 208, protein: 20, carbs: 0, fats: 13 },
    { name: 'Greek Yogurt', calories: 100, protein: 17, carbs: 6, fats: 0.7 },
    { name: 'Oatmeal', calories: 158, protein: 6, carbs: 27, fats: 3 },
  ];

  const fillFromTemplate = (food: typeof commonFoods[0]) => {
    setItemName(food.name);
    setCalories(food.calories.toString());
    setProtein(food.protein.toString());
    setCarbs(food.carbs.toString());
    setFats(food.fats.toString());
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
          <Text style={styles.title}>Add Item</Text>
          <TouchableOpacity
            onPress={handleAdd}
            style={styles.saveButton}
            disabled={isAdding || !itemName.trim()}
          >
            <Text style={styles.saveButtonText}>{isAdding ? 'Adding...' : 'Add'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Quick Templates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Templates</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.templatesRow}>
                {commonFoods.map((food, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.templateChip}
                    onPress={() => fillFromTemplate(food)}
                  >
                    <Text style={styles.templateName}>{food.name}</Text>
                    <Text style={styles.templateCal}>{food.calories} cal</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Item Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Item Details</Text>

            <Text style={styles.inputLabel}>Item Name *</Text>
            <TextInput
              style={styles.input}
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g., Chicken Breast"
              placeholderTextColor="#666666"
            />

            <Text style={styles.inputLabel}>Brand (optional)</Text>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="e.g., Tyson"
              placeholderTextColor="#666666"
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Quantity</Text>
                <TextInput
                  style={styles.input}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="1"
                  placeholderTextColor="#666666"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.inputLabel}>Unit</Text>
                <TextInput
                  style={styles.input}
                  value={unit}
                  onChangeText={setUnit}
                  placeholder="serving"
                  placeholderTextColor="#666666"
                />
              </View>
            </View>

            <View style={styles.unitChips}>
              {['serving', 'g', 'oz', 'cup', 'piece', 'lb'].map((u) => (
                <TouchableOpacity
                  key={u}
                  style={[styles.unitChip, unit === u && styles.unitChipActive]}
                  onPress={() => setUnit(u)}
                >
                  <Text style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}>
                    {u}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Serving Size (optional)</Text>
            <TextInput
              style={styles.input}
              value={servingSize}
              onChangeText={setServingSize}
              placeholder="e.g., 100g, 1 cup"
              placeholderTextColor="#666666"
            />
          </View>

          {/* Nutrition */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nutrition (per unit)</Text>

            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionInput}>
                <Text style={styles.nutritionLabel}>Calories</Text>
                <TextInput
                  style={styles.nutritionField}
                  value={calories}
                  onChangeText={setCalories}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#666666"
                />
                <Text style={styles.nutritionUnit}>cal</Text>
              </View>
              <View style={styles.nutritionInput}>
                <Text style={styles.nutritionLabel}>Protein</Text>
                <TextInput
                  style={styles.nutritionField}
                  value={protein}
                  onChangeText={setProtein}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#666666"
                />
                <Text style={styles.nutritionUnit}>g</Text>
              </View>
              <View style={styles.nutritionInput}>
                <Text style={styles.nutritionLabel}>Carbs</Text>
                <TextInput
                  style={styles.nutritionField}
                  value={carbs}
                  onChangeText={setCarbs}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#666666"
                />
                <Text style={styles.nutritionUnit}>g</Text>
              </View>
              <View style={styles.nutritionInput}>
                <Text style={styles.nutritionLabel}>Fats</Text>
                <TextInput
                  style={styles.nutritionField}
                  value={fats}
                  onChangeText={setFats}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#666666"
                />
                <Text style={styles.nutritionUnit}>g</Text>
              </View>
            </View>
          </View>

          {/* Preview */}
          {itemName && (
            <View style={styles.previewCard}>
              <Text style={styles.previewTitle}>Preview</Text>
              <Text style={styles.previewName}>{itemName}</Text>
              {brand && <Text style={styles.previewBrand}>{brand}</Text>}
              <View style={styles.previewStats}>
                <Text style={styles.previewQuantity}>
                  {quantity} {unit}
                </Text>
                <Text style={styles.previewCalories}>
                  {calories || '0'} cal/unit
                </Text>
              </View>
              <View style={styles.previewMacros}>
                <Text style={styles.previewMacro}>P: {protein || '0'}g</Text>
                <Text style={styles.previewMacro}>C: {carbs || '0'}g</Text>
                <Text style={styles.previewMacro}>F: {fats || '0'}g</Text>
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
    backgroundColor: SUCCESS_COLOR,
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
    padding: 20,
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
  templatesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  templateChip: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  templateName: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  templateCal: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
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
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  unitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  unitChipActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  unitChipText: {
    fontSize: 14,
    color: '#888888',
  },
  unitChipTextActive: {
    color: '#000000',
    fontWeight: '500',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionInput: {
    width: '47%',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  nutritionField: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  nutritionUnit: {
    fontSize: 12,
    color: '#888888',
    marginTop: 4,
  },
  previewCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  previewTitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
  },
  previewName: {
    fontSize: 20,
    fontWeight: '600',
    color: ACCENT_COLOR,
  },
  previewBrand: {
    fontSize: 14,
    color: '#888888',
    marginTop: 2,
  },
  previewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  previewQuantity: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  previewCalories: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
  previewMacros: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  previewMacro: {
    fontSize: 14,
    color: '#888888',
  },
});
