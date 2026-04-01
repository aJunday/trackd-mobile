import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const WARNING_COLOR = '#FF8C00';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface BreakdownItem {
  item: string;
  weight_g: number;
  source: 'pantry' | 'global_avg';
  macros?: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

interface AnalysisResult {
  success: boolean;
  confidence_score: number;
  high_confidence: boolean;
  total_macros: {
    protein: number;
    carbs: number;
    fats: number;
    calories: number;
  };
  breakdown: BreakdownItem[];
  uncertain_items: string[];
  pantry_matches: number;
  message?: string;
}

export default function MealScannerScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedMealType, setSelectedMealType] = useState('lunch');
  const [isLogging, setIsLogging] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setAnalysis(null);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64 || null);
      setAnalysis(null);
    }
  };

  const analyzeImage = async () => {
    if (!imageBase64) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry/analyze-meal`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          image_base64: imageBase64,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data);
      } else {
        Alert.alert('Analysis Failed', data.message || 'Could not analyze the meal image');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      Alert.alert('Error', 'Failed to analyze meal image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const logMeal = async () => {
    if (!analysis) return;

    setIsLogging(true);

    try {
      // Create meal items from analysis
      const items = analysis.breakdown.map((item) => ({
        item_id: `mi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: item.item,
        calories: Math.round((item.macros?.protein || 0) * 4 + (item.macros?.carbs || 0) * 4 + (item.macros?.fats || 0) * 9),
        protein: item.macros?.protein || 0,
        carbs: item.macros?.carbs || 0,
        fats: item.macros?.fats || 0,
        quantity: 1,
        unit: `${item.weight_g}g`,
      }));

      const response = await fetch(`${BACKEND_URL}/api/nutrition/meals`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          meal_type: selectedMealType,
          items: items,
        }),
      });

      if (response.ok) {
        Alert.alert('Success!', 'Meal logged successfully', [
          { text: 'Scan Another', onPress: resetScanner },
          { text: 'View Kitchen', onPress: () => router.push('/(auth)/kitchen') },
        ]);
      } else {
        throw new Error('Failed to log meal');
      }
    } catch (error) {
      console.error('Log meal error:', error);
      Alert.alert('Error', 'Failed to log meal');
    } finally {
      setIsLogging(false);
    }
  };

  const resetScanner = () => {
    setImageUri(null);
    setImageBase64(null);
    setAnalysis(null);
  };

  const mealTypes = [
    { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
    { value: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' },
    { value: 'dinner', label: 'Dinner', icon: 'moon-outline' },
    { value: 'snack', label: 'Snack', icon: 'cafe-outline' },
  ];

  const getConfidenceColor = (score: number) => {
    if (score >= 0.92) return SUCCESS_COLOR;
    if (score >= 0.80) return ACCENT_COLOR;
    return WARNING_COLOR;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Snap & Log</Text>
        <TouchableOpacity onPress={resetScanner} style={styles.resetButton}>
          <Ionicons name="refresh" size={24} color="#888888" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Image Preview or Capture Buttons */}
        {!imageUri ? (
          <View style={styles.captureSection}>
            <View style={styles.captureIcon}>
              <Ionicons name="camera" size={64} color={ACCENT_COLOR} />
            </View>
            <Text style={styles.captureTitle}>Snap Your Meal</Text>
            <Text style={styles.captureText}>
              Take a photo of your meal and AI will analyze the nutritional content
              using your pantry data for 92%+ accuracy.
            </Text>

            <View style={styles.captureButtons}>
              <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
                <Ionicons name="camera" size={28} color="#000000" />
                <Text style={styles.captureButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.captureButton, styles.captureButtonSecondary]}
                onPress={pickImage}
              >
                <Ionicons name="images" size={28} color={ACCENT_COLOR} />
                <Text style={[styles.captureButtonText, styles.captureButtonTextSecondary]}>
                  Gallery
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tips */}
            <View style={styles.tipsCard}>
              <Text style={styles.tipsTitle}>Tips for Best Results</Text>
              <View style={styles.tip}>
                <Ionicons name="checkmark-circle" size={16} color={SUCCESS_COLOR} />
                <Text style={styles.tipText}>Include a fork or hand for scale</Text>
              </View>
              <View style={styles.tip}>
                <Ionicons name="checkmark-circle" size={16} color={SUCCESS_COLOR} />
                <Text style={styles.tipText}>Good lighting, clear view of food</Text>
              </View>
              <View style={styles.tip}>
                <Ionicons name="checkmark-circle" size={16} color={SUCCESS_COLOR} />
                <Text style={styles.tipText}>Add items to Pantry for precise macros</Text>
              </View>
            </View>
          </View>
        ) : (
          <>
            {/* Image Preview */}
            <View style={styles.imageContainer}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              {!analysis && !isAnalyzing && (
                <TouchableOpacity style={styles.changeImageButton} onPress={resetScanner}>
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Analyze Button */}
            {!analysis && !isAnalyzing && (
              <TouchableOpacity style={styles.analyzeButton} onPress={analyzeImage}>
                <Ionicons name="scan" size={24} color="#000000" />
                <Text style={styles.analyzeButtonText}>Analyze Meal</Text>
              </TouchableOpacity>
            )}

            {/* Loading State */}
            {isAnalyzing && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ACCENT_COLOR} />
                <Text style={styles.loadingText}>Analyzing your meal...</Text>
                <Text style={styles.loadingSubtext}>
                  Using AI to identify ingredients and estimate portions
                </Text>
              </View>
            )}

            {/* Analysis Results */}
            {analysis && (
              <View style={styles.resultsContainer}>
                {/* Confidence Score */}
                <View style={styles.confidenceCard}>
                  <View style={styles.confidenceHeader}>
                    <Ionicons
                      name={analysis.high_confidence ? 'checkmark-circle' : 'alert-circle'}
                      size={24}
                      color={getConfidenceColor(analysis.confidence_score)}
                    />
                    <Text style={styles.confidenceLabel}>Confidence Score</Text>
                  </View>
                  <Text
                    style={[
                      styles.confidenceValue,
                      { color: getConfidenceColor(analysis.confidence_score) },
                    ]}
                  >
                    {Math.round(analysis.confidence_score * 100)}%
                  </Text>
                  {analysis.pantry_matches > 0 && (
                    <Text style={styles.pantryMatchText}>
                      {analysis.pantry_matches} item(s) matched from your pantry
                    </Text>
                  )}
                </View>

                {/* Total Macros */}
                <View style={styles.macrosCard}>
                  <Text style={styles.macrosTitle}>Meal Totals</Text>
                  <View style={styles.macrosGrid}>
                    <View style={styles.macroItem}>
                      <Text style={styles.macroValue}>
                        {Math.round(analysis.total_macros.calories)}
                      </Text>
                      <Text style={styles.macroLabel}>Calories</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={[styles.macroValue, { color: '#FF6B6B' }]}>
                        {Math.round(analysis.total_macros.protein)}g
                      </Text>
                      <Text style={styles.macroLabel}>Protein</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={[styles.macroValue, { color: ACCENT_COLOR }]}>
                        {Math.round(analysis.total_macros.carbs)}g
                      </Text>
                      <Text style={styles.macroLabel}>Carbs</Text>
                    </View>
                    <View style={styles.macroItem}>
                      <Text style={[styles.macroValue, { color: '#FFE066' }]}>
                        {Math.round(analysis.total_macros.fats)}g
                      </Text>
                      <Text style={styles.macroLabel}>Fats</Text>
                    </View>
                  </View>
                </View>

                {/* Breakdown */}
                <View style={styles.breakdownCard}>
                  <Text style={styles.breakdownTitle}>Ingredient Breakdown</Text>
                  {analysis.breakdown.map((item, index) => (
                    <View key={index} style={styles.breakdownItem}>
                      <View style={styles.breakdownMain}>
                        <Text style={styles.breakdownName}>{item.item}</Text>
                        <View style={styles.sourceTag}>
                          <Ionicons
                            name={item.source === 'pantry' ? 'checkmark-circle' : 'globe-outline'}
                            size={12}
                            color={item.source === 'pantry' ? SUCCESS_COLOR : '#888888'}
                          />
                          <Text
                            style={[
                              styles.sourceText,
                              item.source === 'pantry' && styles.sourceTextPantry,
                            ]}
                          >
                            {item.source === 'pantry' ? 'Pantry' : 'Estimated'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.breakdownWeight}>{item.weight_g}g</Text>
                    </View>
                  ))}
                </View>

                {/* Uncertain Items Warning */}
                {analysis.uncertain_items.length > 0 && (
                  <View style={styles.uncertainCard}>
                    <Ionicons name="warning" size={20} color={WARNING_COLOR} />
                    <View style={styles.uncertainContent}>
                      <Text style={styles.uncertainTitle}>Uncertain Items</Text>
                      <Text style={styles.uncertainText}>
                        {analysis.uncertain_items.join(', ')}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Meal Type Selection */}
                <View style={styles.mealTypeSection}>
                  <Text style={styles.mealTypeTitle}>Log as</Text>
                  <View style={styles.mealTypeButtons}>
                    {mealTypes.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.mealTypeButton,
                          selectedMealType === type.value && styles.mealTypeButtonActive,
                        ]}
                        onPress={() => setSelectedMealType(type.value)}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={18}
                          color={selectedMealType === type.value ? '#000000' : '#888888'}
                        />
                        <Text
                          style={[
                            styles.mealTypeText,
                            selectedMealType === type.value && styles.mealTypeTextActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Log Button */}
                <TouchableOpacity
                  style={styles.logButton}
                  onPress={logMeal}
                  disabled={isLogging}
                >
                  {isLogging ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={24} color="#000000" />
                      <Text style={styles.logButtonText}>Log This Meal</Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Scan Another */}
                <TouchableOpacity style={styles.scanAnotherButton} onPress={resetScanner}>
                  <Ionicons name="camera-outline" size={20} color={ACCENT_COLOR} />
                  <Text style={styles.scanAnotherText}>Scan Another Meal</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
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
  resetButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  captureSection: {
    alignItems: 'center',
  },
  captureIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  captureTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  captureText: {
    fontSize: 15,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  captureButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginBottom: 32,
  },
  captureButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  captureButtonSecondary: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  captureButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  captureButtonTextSecondary: {
    color: ACCENT_COLOR,
  },
  tipsCard: {
    width: '100%',
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  tipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    marginBottom: 12,
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
  },
  changeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 16,
  },
  analyzeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: '#888888',
    marginTop: 8,
    textAlign: 'center',
  },
  resultsContainer: {},
  confidenceCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  confidenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  confidenceLabel: {
    fontSize: 14,
    color: '#888888',
  },
  confidenceValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  pantryMatchText: {
    fontSize: 13,
    color: SUCCESS_COLOR,
    marginTop: 8,
  },
  macrosCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  macrosTitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginBottom: 16,
  },
  macrosGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  breakdownCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  breakdownTitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 16,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  breakdownMain: {
    flex: 1,
  },
  breakdownName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sourceText: {
    fontSize: 12,
    color: '#888888',
  },
  sourceTextPantry: {
    color: SUCCESS_COLOR,
  },
  breakdownWeight: {
    fontSize: 16,
    fontWeight: '600',
    color: ACCENT_COLOR,
  },
  uncertainCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 140, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  uncertainContent: {
    flex: 1,
  },
  uncertainTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: WARNING_COLOR,
    marginBottom: 4,
  },
  uncertainText: {
    fontSize: 13,
    color: '#888888',
  },
  mealTypeSection: {
    marginBottom: 16,
  },
  mealTypeTitle: {
    fontSize: 14,
    color: '#888888',
    marginBottom: 12,
  },
  mealTypeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  mealTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A0A0A',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  mealTypeButtonActive: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  mealTypeText: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '500',
  },
  mealTypeTextActive: {
    color: '#000000',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SUCCESS_COLOR,
    paddingVertical: 18,
    borderRadius: 16,
    gap: 10,
    marginBottom: 12,
  },
  logButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  scanAnotherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  scanAnotherText: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
});
