import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../_layout';

const ACCENT = '#F5A623';
const GOLD = '#F5A623';
const PR_ORANGE = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const SUCCESS = '#06D6A0';
const WARN = '#FFD166';
const DANGER = '#FF6B6B';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type Mode = 'photo' | 'barcode' | 'indian';
interface ScanItem {
  name: string;
  weight_g: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  cooking?: string;
}
interface IndianFood {
  name: string;
  per_100g?: boolean;
  per_unit?: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  tags: string[];
}

const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { id: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
  { id: 'snack', label: 'Snack', icon: 'cafe-outline' },
];

const COOKING_METHODS = [
  { id: 'dry', label: 'Dry / Steamed', kcal: 0 },
  { id: 'light_oil', label: 'Light Oil', kcal: 40 },
  { id: 'moderate_oil', label: 'Moderate Oil', kcal: 80 },
  { id: 'heavy_oil', label: 'Heavy Oil / Ghee', kcal: 150 },
];

const haptic = (t: 'light' | 'medium' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else
    Haptics.impactAsync(
      t === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
    );
};

const confidenceColor = (c: number) => {
  if (c >= 0.85) return SUCCESS;
  if (c >= 0.7) return WARN;
  return PR_ORANGE;
};

export default function MealScanner() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('photo');

  // Photo scan state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{
    confidence: number;
    items: ScanItem[];
    uncertain: string[];
  } | null>(null);

  // Barcode state
  const [barcode, setBarcode] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);

  // Indian foods
  const [indianQuery, setIndianQuery] = useState('');
  const [indianFoods, setIndianFoods] = useState<IndianFood[]>([]);
  const [indianLoading, setIndianLoading] = useState(false);
  const [indianGramsModal, setIndianGramsModal] = useState<{ open: boolean; food: IndianFood | null }>({
    open: false,
    food: null,
  });

  const [mealType, setMealType] = useState('lunch');
  const [logging, setLogging] = useState(false);

  const apiHeaders = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  // Load indian foods
  useEffect(() => {
    if (mode !== 'indian') return;
    setIndianLoading(true);
    const params = indianQuery ? `?q=${encodeURIComponent(indianQuery)}` : '';
    fetch(`${BACKEND_URL}/api/scanner/indian-foods${params}`)
      .then((r) => r.json())
      .then((d) => setIndianFoods(d.foods || []))
      .finally(() => setIndianLoading(false));
  }, [mode, indianQuery]);

  // ---------- Photo scan ----------
  const pickImage = async () => {
    haptic();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.6,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImageBase64(a.base64 || null);
      setScanResult(null);
      if (a.base64) await runScan(a.base64);
    }
  };

  const takePhoto = async () => {
    haptic();
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Camera access is needed to scan meals');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImageBase64(a.base64 || null);
      setScanResult(null);
      if (a.base64) await runScan(a.base64);
    }
  };

  const runScan = async (b64: string) => {
    setScanning(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/scanner/gemini-food`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ image_base64: b64 }),
      });
      const data = await res.json();
      if (data.success) {
        haptic('success');
        setScanResult({
          confidence: data.confidence ?? 0.7,
          items: (data.items || []).map((i: any) => ({
            name: i.name || 'Item',
            weight_g: i.weight_g || 0,
            calories: i.calories || 0,
            protein_g: i.protein_g || 0,
            carbs_g: i.carbs_g || 0,
            fat_g: i.fat_g || 0,
            cooking: 'dry',
          })),
          uncertain: data.uncertain_items || [],
        });
      } else {
        Alert.alert('Scan failed', data.message || 'Could not analyze the image');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Network error');
    } finally {
      setScanning(false);
    }
  };

  const updateItem = (idx: number, patch: Partial<ScanItem>) => {
    if (!scanResult) return;
    const items = [...scanResult.items];
    items[idx] = { ...items[idx], ...patch };
    setScanResult({ ...scanResult, items });
  };

  const adjustWeight = (idx: number, newWeight: number) => {
    if (!scanResult) return;
    const item = scanResult.items[idx];
    const ratio = item.weight_g > 0 ? newWeight / item.weight_g : 1;
    updateItem(idx, {
      weight_g: newWeight,
      calories: Math.round(item.calories * ratio),
      protein_g: +(item.protein_g * ratio).toFixed(1),
      carbs_g: +(item.carbs_g * ratio).toFixed(1),
      fat_g: +(item.fat_g * ratio).toFixed(1),
    });
  };

  const setCooking = (idx: number, methodId: string) => {
    if (!scanResult) return;
    const m = COOKING_METHODS.find((mm) => mm.id === methodId);
    if (!m) return;
    haptic();
    const item = scanResult.items[idx];
    const baseKcal = item.calories - getCookingExtra(item.cooking || 'dry');
    updateItem(idx, {
      cooking: methodId,
      calories: baseKcal + m.kcal,
    });
  };

  const getCookingExtra = (id: string) => COOKING_METHODS.find((m) => m.id === id)?.kcal ?? 0;

  // ---------- Barcode ----------
  const lookupBarcode = async () => {
    if (!barcode.trim()) return;
    haptic();
    setBarcodeLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/pantry/scan-barcode`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({ barcode: barcode.trim() }),
      });
      const data = await res.json();
      if (data.success && data.product) {
        const p = data.product;
        setScanResult({
          confidence: 0.95,
          items: [
            {
              name: p.product_name || p.name || 'Product',
              weight_g: 100,
              calories: p.calories_per_100g || p.calories || 0,
              protein_g: p.protein_per_100g || p.protein || 0,
              carbs_g: p.carbs_per_100g || p.carbs || 0,
              fat_g: p.fats_per_100g || p.fats || 0,
              cooking: 'dry',
            },
          ],
          uncertain: [],
        });
        haptic('success');
      } else {
        Alert.alert('Not found', data.message || 'Product not in database');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Network error');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // ---------- Indian foods ----------
  const pickIndianFood = (food: IndianFood) => {
    haptic();
    setIndianGramsModal({ open: true, food });
  };

  const addIndianFood = (grams: number) => {
    const food = indianGramsModal.food;
    if (!food) return;
    const ratio = food.per_100g ? grams / 100 : 1; // for per-unit, grams = number of units
    const newItem: ScanItem = {
      name: food.name + (food.per_100g ? ` (${grams}g)` : ` (×${grams})`),
      weight_g: food.per_100g ? grams : grams * 60,
      calories: Math.round(food.calories * ratio),
      protein_g: +(food.protein * ratio).toFixed(1),
      carbs_g: +(food.carbs * ratio).toFixed(1),
      fat_g: +(food.fats * ratio).toFixed(1),
      cooking: 'dry',
    };
    setScanResult((prev) => {
      if (!prev) return { confidence: 1, items: [newItem], uncertain: [] };
      return { ...prev, items: [...prev.items, newItem] };
    });
    setIndianGramsModal({ open: false, food: null });
    haptic('success');
  };

  // ---------- Log meal ----------
  const logMeal = async () => {
    if (!scanResult || scanResult.items.length === 0) return;
    setLogging(true);
    try {
      const total = scanResult.items.reduce(
        (acc, it) => ({
          calories: acc.calories + it.calories,
          protein: acc.protein + it.protein_g,
          carbs: acc.carbs + it.carbs_g,
          fats: acc.fats + it.fat_g,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      );
      const name = scanResult.items.map((i) => i.name).join(', ').slice(0, 60);
      const res = await fetch(`${BACKEND_URL}/api/nutrition/meals`, {
        method: 'POST',
        headers: apiHeaders(),
        body: JSON.stringify({
          name,
          meal_type: mealType,
          calories: Math.round(total.calories),
          protein: +total.protein.toFixed(1),
          carbs: +total.carbs.toFixed(1),
          fats: +total.fats.toFixed(1),
        }),
      });
      if (res.ok) {
        haptic('success');
        Alert.alert('Logged!', `${name} added to ${mealType}`, [
          {
            text: 'OK',
            onPress: () => {
              setScanResult(null);
              setImageBase64(null);
              setBarcode('');
              router.back();
            },
          },
        ]);
      } else {
        const t = await res.text();
        throw new Error(t);
      }
    } catch (e: any) {
      Alert.alert('Log failed', e?.message || 'Could not log meal');
    } finally {
      setLogging(false);
    }
  };

  const totalKcal = scanResult
    ? Math.round(scanResult.items.reduce((a, i) => a + i.calories, 0))
    : 0;
  const totalProtein = scanResult
    ? +scanResult.items.reduce((a, i) => a + i.protein_g, 0).toFixed(1)
    : 0;
  const totalCarbs = scanResult
    ? +scanResult.items.reduce((a, i) => a + i.carbs_g, 0).toFixed(1)
    : 0;
  const totalFats = scanResult
    ? +scanResult.items.reduce((a, i) => a + i.fat_g, 0).toFixed(1)
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan Meal</Text>
          <View style={{ width: 38 }} />
        </View>

        {/* Mode tabs */}
        <View style={styles.modeBar}>
          {(['photo', 'barcode', 'indian'] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
              onPress={() => {
                haptic();
                setMode(m);
              }}
            >
              <Ionicons
                name={
                  m === 'photo'
                    ? 'camera'
                    : m === 'barcode'
                    ? 'barcode'
                    : 'restaurant'
                }
                size={16}
                color={mode === m ? '#000' : '#fff'}
              />
              <Text style={[styles.modeText, mode === m && styles.modeTextActive]}>
                {m === 'photo' ? 'Photo' : m === 'barcode' ? 'Barcode' : 'Indian'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 }}>
          {/* PHOTO MODE */}
          {mode === 'photo' && !scanResult && (
            <View>
              {imageBase64 ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${imageBase64}` }}
                  style={styles.preview}
                />
              ) : (
                <View style={styles.placeholder}>
                  <MaterialCommunityIcons name="image-search-outline" size={48} color={TEXT_MUTED} />
                  <Text style={styles.placeholderText}>Snap or pick a meal photo</Text>
                </View>
              )}
              <View style={styles.row}>
                <TouchableOpacity style={styles.bigBtn} onPress={takePhoto}>
                  <Ionicons name="camera" size={22} color="#000" />
                  <Text style={styles.bigBtnText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.bigBtn, styles.bigBtnAlt]} onPress={pickImage}>
                  <Ionicons name="images" size={22} color={ACCENT} />
                  <Text style={[styles.bigBtnText, { color: ACCENT }]}>Gallery</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                Uses Gemini 2.5 Flash for fast, accurate food identification.
              </Text>
            </View>
          )}

          {/* BARCODE MODE */}
          {mode === 'barcode' && !scanResult && (
            <View>
              <Text style={styles.subtle}>Enter or scan a barcode to look up the product.</Text>
              <View style={styles.barcodeRow}>
                <TextInput
                  style={styles.barcodeInput}
                  placeholder="0070470496528"
                  placeholderTextColor="#444"
                  value={barcode}
                  onChangeText={setBarcode}
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  onPress={lookupBarcode}
                  style={styles.lookupBtn}
                  disabled={barcodeLoading}
                >
                  {barcodeLoading ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.lookupBtnText}>Look up</Text>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.hint}>
                Powered by OpenFoodFacts (free) + USDA datasets (when available).
              </Text>
            </View>
          )}

          {/* INDIAN MODE */}
          {mode === 'indian' && !scanResult && (
            <View>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={TEXT_MUTED} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search dal, paneer, biryani…"
                  placeholderTextColor={TEXT_MUTED}
                  value={indianQuery}
                  onChangeText={setIndianQuery}
                />
              </View>
              {indianLoading ? (
                <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
              ) : (
                indianFoods.map((f) => (
                  <TouchableOpacity
                    key={f.name}
                    style={styles.indianCard}
                    onPress={() => pickIndianFood(f)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.indianName}>{f.name}</Text>
                      <Text style={styles.indianMeta}>
                        {f.calories} kcal · P{f.protein}g C{f.carbs}g F{f.fats}g{' '}
                        {f.per_100g ? '(per 100g)' : `(${f.per_unit})`}
                      </Text>
                    </View>
                    <Ionicons name="add-circle" size={26} color={ACCENT} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {/* SCANNING SPINNER */}
          {scanning && (
            <View style={styles.scanningWrap}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.scanningText}>Analyzing your meal…</Text>
              <Text style={styles.scanningSub}>Gemini is identifying items and estimating portions.</Text>
            </View>
          )}

          {/* RESULT */}
          {scanResult && !scanning && (
            <View>
              {/* Confidence */}
              <View style={styles.confCard}>
                <View
                  style={[
                    styles.confDot,
                    { backgroundColor: confidenceColor(scanResult.confidence) },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.confLabel}>Confidence</Text>
                  <Text
                    style={[
                      styles.confValue,
                      { color: confidenceColor(scanResult.confidence) },
                    ]}
                  >
                    {Math.round(scanResult.confidence * 100)}%
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setScanResult(null);
                    setImageBase64(null);
                  }}
                >
                  <Ionicons name="refresh" size={22} color={TEXT_MUTED} />
                </TouchableOpacity>
              </View>

              {/* Total summary */}
              <View style={styles.totalCard}>
                <Text style={styles.totalKcal}>{totalKcal}</Text>
                <Text style={styles.totalKcalLabel}>kcal</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroVal, { color: DANGER }]}>{totalProtein}g</Text>
                    <Text style={styles.macroLabel}>protein</Text>
                  </View>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroVal, { color: WARN }]}>{totalCarbs}g</Text>
                    <Text style={styles.macroLabel}>carbs</Text>
                  </View>
                  <View style={styles.macroRow}>
                    <Text style={[styles.macroVal, { color: SUCCESS }]}>{totalFats}g</Text>
                    <Text style={styles.macroLabel}>fats</Text>
                  </View>
                </View>
              </View>

              {/* Per-item cards */}
              {scanResult.items.map((it, idx) => (
                <View key={idx} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const items = [...scanResult.items];
                        items.splice(idx, 1);
                        setScanResult({ ...scanResult, items });
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={TEXT_MUTED} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemMacros}>
                    {it.calories} kcal · P{it.protein_g}g C{it.carbs_g}g F{it.fat_g}g
                  </Text>

                  {/* Portion slider (− / + buttons since RN slider needs extra dep) */}
                  <View style={styles.portionRow}>
                    <Text style={styles.portionLabel}>Portion</Text>
                    <TouchableOpacity
                      onPress={() => adjustWeight(idx, Math.max(10, it.weight_g - 25))}
                      style={styles.portionBtn}
                    >
                      <Ionicons name="remove" size={18} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.portionValue}>{it.weight_g}g</Text>
                    <TouchableOpacity
                      onPress={() => adjustWeight(idx, it.weight_g + 25)}
                      style={styles.portionBtn}
                    >
                      <Ionicons name="add" size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* Cooking method */}
                  <Text style={[styles.portionLabel, { marginTop: 10 }]}>Cooking</Text>
                  <View style={styles.cookGrid}>
                    {COOKING_METHODS.map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.cookChip, it.cooking === m.id && styles.cookChipActive]}
                        onPress={() => setCooking(idx, m.id)}
                      >
                        <Text
                          style={[
                            styles.cookText,
                            it.cooking === m.id && styles.cookTextActive,
                          ]}
                        >
                          {m.label} {m.kcal > 0 ? `+${m.kcal}` : ''}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              {scanResult.uncertain.length > 0 && (
                <View style={styles.uncertainCard}>
                  <Ionicons name="warning" size={18} color={WARN} />
                  <Text style={styles.uncertainText}>
                    Uncertain: {scanResult.uncertain.join(', ')} — adjust portions if needed.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.addMoreBtn}
                onPress={() => {
                  setMode('indian');
                }}
              >
                <Ionicons name="add" size={18} color={ACCENT} />
                <Text style={styles.addMoreText}>Add more from Indian foods</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Footer log meal */}
        {scanResult && !scanning && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.mealTypeRow}>
              {MEAL_TYPES.map((mt) => (
                <TouchableOpacity
                  key={mt.id}
                  style={[styles.mealType, mealType === mt.id && styles.mealTypeActive]}
                  onPress={() => {
                    haptic();
                    setMealType(mt.id);
                  }}
                >
                  <Ionicons
                    name={mt.icon as any}
                    size={16}
                    color={mealType === mt.id ? '#000' : '#bbb'}
                  />
                  <Text
                    style={[styles.mealTypeText, mealType === mt.id && styles.mealTypeTextActive]}
                  >
                    {mt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.logBtn, logging && { opacity: 0.6 }]}
              onPress={logMeal}
              disabled={logging}
            >
              {logging ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={22} color="#000" />
                  <Text style={styles.logBtnText}>Log This Meal</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Indian foods grams modal */}
      <Modal
        visible={indianGramsModal.open}
        transparent
        animationType="fade"
        onRequestClose={() => setIndianGramsModal({ open: false, food: null })}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIndianGramsModal({ open: false, food: null })}
        >
          <Pressable style={styles.gramsModal} onPress={() => {}}>
            {indianGramsModal.food && (
              <IndianGramsPicker
                food={indianGramsModal.food}
                onConfirm={addIndianFood}
                onCancel={() => setIndianGramsModal({ open: false, food: null })}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function IndianGramsPicker({
  food,
  onConfirm,
  onCancel,
}: {
  food: IndianFood;
  onConfirm: (n: number) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(food.per_100g ? '150' : '1');
  const n = parseFloat(val) || 0;
  const ratio = food.per_100g ? n / 100 : n;
  return (
    <View style={{ padding: 18 }}>
      <Text style={styles.gramsTitle}>{food.name}</Text>
      <Text style={styles.gramsSub}>
        How {food.per_100g ? 'many grams' : 'many pieces'}?
      </Text>
      <TextInput
        style={styles.gramsInput}
        value={val}
        onChangeText={setVal}
        keyboardType="decimal-pad"
        autoFocus
      />
      {food.per_100g && (
        <View style={styles.quickRow}>
          {[100, 150, 200, 300].map((q) => (
            <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => setVal(String(q))}>
              <Text style={styles.quickText}>{q}g</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      <Text style={styles.gramsPreview}>
        {Math.round(food.calories * ratio)} kcal · P{(food.protein * ratio).toFixed(1)}g C
        {(food.carbs * ratio).toFixed(1)}g F{(food.fats * ratio).toFixed(1)}g
      </Text>
      <View style={styles.modalActions}>
        <TouchableOpacity style={[styles.modalAct, { backgroundColor: '#1a1a1a' }]} onPress={onCancel}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modalAct, { backgroundColor: ACCENT }]}
          onPress={() => onConfirm(n)}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  iconBtn: { width: 38, height: 38, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  modeBar: {
    flexDirection: 'row',
    padding: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modeBtnActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  modeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  modeTextActive: { color: '#000' },
  preview: { width: '100%', height: 240, borderRadius: 14, marginBottom: 14, backgroundColor: CARD },
  placeholder: {
    height: 240,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: BORDER,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  placeholderText: { color: TEXT_MUTED, fontSize: 14 },
  row: { flexDirection: 'row', gap: 8 },
  bigBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  bigBtnAlt: { backgroundColor: 'rgba(0,212,255,0.10)' },
  bigBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  hint: { color: TEXT_MUTED, fontSize: 12, marginTop: 12, textAlign: 'center' },
  subtle: { color: TEXT_MUTED, fontSize: 14, marginBottom: 14 },
  barcodeRow: { flexDirection: 'row', gap: 8 },
  barcodeInput: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  lookupBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    justifyContent: 'center',
  },
  lookupBtnText: { color: '#000', fontWeight: '800' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  indianCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  indianName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  indianMeta: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },
  scanningWrap: { alignItems: 'center', paddingVertical: 60 },
  scanningText: { color: '#fff', marginTop: 14, fontSize: 16, fontWeight: '700' },
  scanningSub: { color: TEXT_MUTED, marginTop: 4, fontSize: 13 },
  confCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  confDot: { width: 12, height: 12, borderRadius: 6 },
  confLabel: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  confValue: { fontSize: 22, fontWeight: '900' },
  totalCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  totalKcal: { color: '#fff', fontSize: 36, fontWeight: '900' },
  totalKcalLabel: { color: TEXT_MUTED, fontSize: 12, marginRight: 12 },
  macroRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  macroVal: { fontSize: 14, fontWeight: '700' },
  macroLabel: { color: TEXT_MUTED, fontSize: 11 },
  itemCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  itemName: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  itemMacros: { color: TEXT_MUTED, fontSize: 12, marginTop: 4 },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  portionLabel: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  portionBtn: {
    width: 36,
    height: 36,
    backgroundColor: '#1A1A1A',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  portionValue: { color: '#fff', fontSize: 16, fontWeight: '700', minWidth: 56, textAlign: 'center' },
  cookGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  cookChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cookChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  cookText: { color: '#bbb', fontSize: 11, fontWeight: '600' },
  cookTextActive: { color: '#000' },
  uncertainCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(255,209,102,0.08)',
    borderColor: WARN,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  uncertainText: { color: WARN, fontSize: 12, flex: 1 },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,212,255,0.10)',
    borderRadius: 10,
    marginTop: 4,
  },
  addMoreText: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  footer: {
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  mealTypeRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  mealType: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    backgroundColor: CARD,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  mealTypeActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  mealTypeText: { color: '#bbb', fontSize: 11, fontWeight: '700' },
  mealTypeTextActive: { color: '#000' },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
  },
  logBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 16,
  },
  gramsModal: { backgroundColor: CARD, borderRadius: 16, borderWidth: 1, borderColor: BORDER },
  gramsTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  gramsSub: { color: TEXT_MUTED, fontSize: 13, marginTop: 4, marginBottom: 14 },
  gramsInput: {
    backgroundColor: '#1A1A1A',
    color: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  quickBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickText: { color: '#fff', fontWeight: '700' },
  gramsPreview: { color: ACCENT, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  modalActions: { flexDirection: 'row', gap: 8, marginTop: 16 },
  modalAct: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
});
