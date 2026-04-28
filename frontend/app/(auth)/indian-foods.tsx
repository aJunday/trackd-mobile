/**
 * Indian Food Database Screen — ICMR-NIN INDB 2024 (1014 recipes).
 * Searchable, with realistic serving sizes (1 katori, 1 roti, 1 bowl, etc.)
 * and a quick-log button that posts directly to /api/nutrition/meals.
 *
 * Reads Priority P0 of the current milestone:
 *   - Full INDB 2024 database (1014 foods)
 *   - Flexible Hindi/English search
 *   - Source badge on every result
 *   - Preset portions + custom grams
 *   - ScienceBadge (INDB 2024 + MASALA study)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../_layout';
import { authFetch } from '../../src/utils/authFetch';
import ScienceBadge from '../../src/components/ScienceBadge';

const ACCENT = '#F5A623';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const PROTEIN = '#FF6B6B';
const CARBS = '#FFD166';
const FATS = '#06D6A0';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface IndianFood {
  name: string;
  orig_name?: string;
  food_code: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  sugar?: number | null;
  calcium_mg?: number | null;
  iron_mg?: number | null;
  zinc_mg?: number | null;
  sodium_mg?: number | null;
  portion_g: number;
  default_serving_g: number;
  per_100g: { calories: number; protein: number; carbs: number; fats: number; fiber: number };
  unit?: string;
  servings_per_recipe?: number;
  source: string;
  source_label: string;
}

const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' as const },
  { value: 'lunch', label: 'Lunch', icon: 'partly-sunny-outline' as const },
  { value: 'dinner', label: 'Dinner', icon: 'moon-outline' as const },
  { value: 'snack', label: 'Snack', icon: 'cafe-outline' as const },
];

const haptic = (t: 'light' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function IndianFoodsScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<IndianFood[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<IndianFood | null>(null);
  const [portionMode, setPortionMode] = useState<'preset' | 'custom'>('preset');
  const [presetMult, setPresetMult] = useState(1); // number of servings
  const [customG, setCustomG] = useState('');
  const [mealType, setMealType] = useState<string>('lunch');
  const [logging, setLogging] = useState(false);

  const fetchFoods = useCallback(
    async (q: string) => {
      if (!sessionToken) return;
      setLoading(true);
      try {
        const url = q.trim()
          ? `${BACKEND_URL}/api/scanner/indian-foods?q=${encodeURIComponent(q.trim())}&limit=100`
          : `${BACKEND_URL}/api/scanner/indian-foods/all?offset=0&limit=200`;
        const res = await authFetch(url);
        if (res.ok) {
          const json = await res.json();
          setItems(json.foods || []);
        }
      } catch (e) {
        console.warn('Indian food fetch failed', e);
      } finally {
        setLoading(false);
      }
    },
    [sessionToken]
  );

  useEffect(() => {
    fetchFoods('');
  }, [fetchFoods]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchFoods(query), 250);
    return () => clearTimeout(t);
  }, [query, fetchFoods]);

  const openDetail = (f: IndianFood) => {
    haptic('light');
    setSelected(f);
    setPortionMode('preset');
    setPresetMult(1);
    setCustomG(String(Math.round(f.default_serving_g)));
  };

  // Calculate nutrition based on current portion selection
  const computed = useMemo(() => {
    if (!selected) return null;
    let grams: number;
    if (portionMode === 'preset') {
      grams = selected.default_serving_g * presetMult;
    } else {
      grams = parseFloat(customG) || selected.default_serving_g;
    }
    const factor = grams / 100;
    const p = selected.per_100g;
    return {
      grams: Math.round(grams),
      calories: Math.round(p.calories * factor),
      protein: +(p.protein * factor).toFixed(1),
      carbs: +(p.carbs * factor).toFixed(1),
      fats: +(p.fats * factor).toFixed(1),
      fiber: +(p.fiber * factor).toFixed(1),
    };
  }, [selected, portionMode, presetMult, customG]);

  const logFood = async () => {
    if (!selected || !computed) return;
    setLogging(true);
    try {
      const item = {
        item_id: `mi_${Date.now()}`,
        name:
          portionMode === 'preset'
            ? `${selected.name} (${presetMult} ${selected.unit || 'serving'}${presetMult > 1 ? 's' : ''})`
            : `${selected.name} (${computed.grams}g)`,
        calories: computed.calories,
        protein: computed.protein,
        carbs: computed.carbs,
        fats: computed.fats,
        quantity: 1,
        unit: portionMode === 'preset' ? selected.unit || 'serving' : 'g',
      };
      const res = await authFetch(`${BACKEND_URL}/api/nutrition/meals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meal_type: mealType, items: [item] }),
      });
      if (res.ok) {
        haptic('success');
        Alert.alert('Logged', `Added ${selected.name} to ${mealType}.`);
        setSelected(null);
      } else {
        Alert.alert('Error', 'Could not log food.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Try again.');
    } finally {
      setLogging(false);
    }
  };

  const renderItem = ({ item }: { item: IndianFood }) => (
    <TouchableOpacity
      style={styles.foodRow}
      onPress={() => openDetail(item)}
      activeOpacity={0.7}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.foodName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.foodMeta}>
          {item.unit ? `1 ${item.unit}` : 'Serving'} ({Math.round(item.default_serving_g)}g) · {Math.round(item.calories)} kcal
        </Text>
        <View style={styles.macroRow}>
          <Text style={[styles.macroPill, { color: PROTEIN }]}>P {item.protein.toFixed(0)}g</Text>
          <Text style={[styles.macroPill, { color: CARBS }]}>C {item.carbs.toFixed(0)}g</Text>
          <Text style={[styles.macroPill, { color: FATS }]}>F {item.fats.toFixed(0)}g</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={TEXT_MUTED} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>Indian Food Database</Text>
          <View style={styles.headerBadge}>
            <MaterialCommunityIcons name="shield-check" size={12} color={ACCENT} />
            <Text style={styles.headerBadgeText}>Source: ICMR-NIN INDB 2024 · 1014 foods</Text>
          </View>
        </View>
        <ScienceBadge refKeys={['indb_longvah_2024', 'masala_kanaya_2014']} size="small" />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={TEXT_MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search dal, paneer, roti, biryani..."
          placeholderTextColor="#555"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query ? (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
            <Ionicons name="close-circle" size={18} color={TEXT_MUTED} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="search-outline" size={42} color="#333" />
          <Text style={styles.emptyTxt}>No foods match "{query}"</Text>
          <Text style={styles.emptySub}>Try: dal, paneer, roti, biryani, idli, dosa, sambar</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.food_code}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selected?.name}
                </Text>
                <View style={styles.modalSourceBadge}>
                  <MaterialCommunityIcons name="shield-check" size={11} color={ACCENT} />
                  <Text style={styles.modalSourceText}>{selected?.source_label}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Ionicons name="close" size={26} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* Meal type selector */}
              <Text style={styles.sectionLabel}>Meal</Text>
              <View style={styles.mealRow}>
                {MEAL_TYPES.map((mt) => (
                  <TouchableOpacity
                    key={mt.value}
                    onPress={() => setMealType(mt.value)}
                    style={[
                      styles.mealChip,
                      mealType === mt.value && styles.mealChipActive,
                    ]}
                  >
                    <Ionicons
                      name={mt.icon}
                      size={14}
                      color={mealType === mt.value ? '#000' : TEXT_MUTED}
                    />
                    <Text
                      style={[
                        styles.mealChipText,
                        mealType === mt.value && { color: '#000', fontWeight: '700' },
                      ]}
                    >
                      {mt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Portion selector */}
              <Text style={styles.sectionLabel}>Portion</Text>
              <View style={styles.tabRow}>
                <TouchableOpacity
                  onPress={() => setPortionMode('preset')}
                  style={[styles.tab, portionMode === 'preset' && styles.tabActive]}
                >
                  <Text
                    style={[styles.tabText, portionMode === 'preset' && { color: '#000', fontWeight: '700' }]}
                  >
                    1 {selected?.unit || 'serving'} ({Math.round(selected?.default_serving_g || 0)}g)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPortionMode('custom')}
                  style={[styles.tab, portionMode === 'custom' && styles.tabActive]}
                >
                  <Text
                    style={[styles.tabText, portionMode === 'custom' && { color: '#000', fontWeight: '700' }]}
                  >
                    Custom grams
                  </Text>
                </TouchableOpacity>
              </View>

              {portionMode === 'preset' ? (
                <View style={styles.stepper}>
                  <TouchableOpacity
                    onPress={() => setPresetMult(Math.max(0.5, presetMult - 0.5))}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="remove" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.stepValue}>
                    {presetMult}x · {Math.round((selected?.default_serving_g || 0) * presetMult)}g
                  </Text>
                  <TouchableOpacity
                    onPress={() => setPresetMult(presetMult + 0.5)}
                    style={styles.stepBtn}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.gramInputWrap}>
                  <TextInput
                    style={styles.gramInput}
                    value={customG}
                    onChangeText={setCustomG}
                    keyboardType="numeric"
                    placeholder="Enter grams"
                    placeholderTextColor="#555"
                  />
                  <Text style={styles.gramUnit}>g</Text>
                </View>
              )}

              {/* Computed nutrition */}
              {computed && (
                <View style={styles.nutritionCard}>
                  <Text style={styles.calBig}>{computed.calories}</Text>
                  <Text style={styles.calUnit}>kcal for {computed.grams}g</Text>
                  <View style={styles.macroGrid}>
                    <NutCell label="Protein" value={`${computed.protein}g`} color={PROTEIN} />
                    <NutCell label="Carbs" value={`${computed.carbs}g`} color={CARBS} />
                    <NutCell label="Fats" value={`${computed.fats}g`} color={FATS} />
                    <NutCell label="Fiber" value={`${computed.fiber}g`} color="#B39DFF" />
                  </View>
                </View>
              )}

              {/* Micronutrients if available */}
              {selected && (selected.calcium_mg || selected.iron_mg || selected.zinc_mg) && (
                <View style={styles.microCard}>
                  <Text style={styles.microTitle}>Per default serving</Text>
                  <View style={styles.microRow}>
                    {selected.calcium_mg ? (
                      <Text style={styles.microVal}>
                        Ca <Text style={styles.microNum}>{selected.calcium_mg.toFixed(0)}mg</Text>
                      </Text>
                    ) : null}
                    {selected.iron_mg ? (
                      <Text style={styles.microVal}>
                        Fe <Text style={styles.microNum}>{selected.iron_mg.toFixed(1)}mg</Text>
                      </Text>
                    ) : null}
                    {selected.zinc_mg ? (
                      <Text style={styles.microVal}>
                        Zn <Text style={styles.microNum}>{selected.zinc_mg.toFixed(1)}mg</Text>
                      </Text>
                    ) : null}
                    {selected.sodium_mg ? (
                      <Text style={styles.microVal}>
                        Na <Text style={styles.microNum}>{selected.sodium_mg.toFixed(0)}mg</Text>
                      </Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Quick log button */}
              <TouchableOpacity
                style={[styles.logBtn, logging && { opacity: 0.6 }]}
                onPress={logFood}
                disabled={logging}
                activeOpacity={0.85}
              >
                {logging ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={22} color="#000" />
                    <Text style={styles.logBtnText}>Log to {mealType}</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Attribution */}
              <Text style={styles.attrib}>
                Nutrition data from ICMR-NIN Indian Nutrient Databank (INDB) 2024 — lab-analyzed values
                for {selected?.servings_per_recipe
                  ? `standardized recipe (${selected.servings_per_recipe} ${selected.unit}s per recipe)`
                  : 'standardized recipe'}.
              </Text>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function NutCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.nutCell}>
      <Text style={[styles.nutLabel, { color }]}>{label}</Text>
      <Text style={styles.nutVal}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 6,
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerBadgeText: { color: ACCENT, fontSize: 10, fontWeight: '600' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginHorizontal: 14,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 6,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { color: '#aaa', fontSize: 15, marginTop: 12, fontWeight: '600' },
  emptySub: { color: TEXT_MUTED, fontSize: 12, marginTop: 6, textAlign: 'center' },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  foodName: { color: '#fff', fontSize: 14, fontWeight: '600', lineHeight: 18 },
  foodMeta: { color: TEXT_MUTED, fontSize: 11, marginTop: 3 },
  macroRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  macroPill: { fontSize: 11, fontWeight: '700' },

  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  modalTitle: { color: '#fff', fontSize: 17, fontWeight: '700', lineHeight: 22 },
  modalSourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7A5510',
  },
  modalSourceText: { color: ACCENT, fontSize: 10, fontWeight: '600' },

  sectionLabel: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  mealRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  mealChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  mealChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  mealChipText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },

  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  tabText: { color: TEXT_MUTED, fontSize: 12, fontWeight: '600' },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 6,
    marginTop: 4,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValue: { color: '#fff', fontSize: 16, fontWeight: '700' },

  gramInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  gramInput: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 14 },
  gramUnit: { color: TEXT_MUTED, fontSize: 14, fontWeight: '600' },

  nutritionCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 16,
    marginTop: 18,
    alignItems: 'center',
  },
  calBig: { color: '#fff', fontSize: 40, fontWeight: '900' },
  calUnit: { color: TEXT_MUTED, fontSize: 12, marginTop: 2, marginBottom: 14 },
  macroGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  nutCell: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    minWidth: 65,
  },
  nutLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  nutVal: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 2 },

  microCard: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  microTitle: { color: TEXT_MUTED, fontSize: 11, fontWeight: '700', marginBottom: 6 },
  microRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  microVal: { color: TEXT_MUTED, fontSize: 12 },
  microNum: { color: '#fff', fontWeight: '700' },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 18,
  },
  logBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  attrib: {
    color: TEXT_MUTED,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
