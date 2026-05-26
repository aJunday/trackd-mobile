/**
 * Template Builder — create / edit a custom workout template.
 *
 * Routes:
 *   /(auth)/template-builder              → create new template
 *   /(auth)/template-builder?id=tmpl_xxx  → edit existing template
 *
 * Talks to:
 *   GET  /api/exercises/library
 *   GET  /api/exercises/search
 *   POST /api/templates                  (create)
 *   PUT  /api/templates/:id              (update existing)
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { authFetch } from '../../src/utils/authFetch';
import ExerciseOptionsMenu from '../../src/components/ExerciseOptionsMenu';

const ACCENT = '#F5A623';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';
const ERROR = '#FF3B30';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface TemplateExercise {
  id: string;                       // local uuid
  name: string;
  muscle_group?: string;
  default_sets: number;
  default_reps: number;
  rest_seconds: number;
  note?: string;
  warmup_sets?: number;
}

function uid(): string {
  return Math.random().toString(36).slice(2, 11);
}

export default function TemplateBuilderScreen() {
  const router = useRouter();
  const { id: editId } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!editId;

  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [optionsFor, setOptionsFor] = useState<TemplateExercise | null>(null);

  // Load existing template if editing
  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      try {
        const r = await authFetch(`${BACKEND_URL}/api/templates`);
        const data = await r.json();
        const t = (data.user_templates || []).find((x: any) => x.template_id === editId);
        if (t) {
          setName(t.name || '');
          setItems(
            (t.exercises || []).map((e: any) => ({
              id: uid(),
              name: e.name,
              muscle_group: e.muscle_group,
              default_sets: e.default_sets ?? e.sets ?? 3,
              default_reps: e.default_reps ?? e.reps ?? 10,
              rest_seconds: e.rest_seconds ?? 90,
              note: e.note,
              warmup_sets: e.warmup_sets,
            })),
          );
        }
      } catch (e) {
        console.warn('load template error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [editId, isEdit]);

  const cancel = useCallback(() => {
    if (items.length > 0 || name.trim()) {
      Alert.alert(
        'Discard template?',
        'Your changes will be lost.',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        ],
      );
    } else {
      router.back();
    }
  }, [items.length, name, router]);

  const addExercise = (exName: string, muscle_group?: string) => {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        name: exName,
        muscle_group,
        default_sets: 3,
        default_reps: 10,
        rest_seconds: 90,
      },
    ]);
    setShowPicker(false);
  };

  const updateItem = (id: string, patch: Partial<TemplateExercise>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const moveItem = (id: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const validate = (): string | null => {
    if (!name.trim()) return 'Template needs a name';
    if (items.length === 0) return 'Add at least one exercise';
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) {
      setError(err);
      setTimeout(() => setError(null), 3500);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        exercises: items.map((it) => ({
          name: it.name,
          muscle_group: it.muscle_group,
          default_sets: it.default_sets,
          default_reps: it.default_reps,
          rest_seconds: it.rest_seconds,
          note: it.note,
          warmup_sets: it.warmup_sets,
        })),
      };
      const url = isEdit
        ? `${BACKEND_URL}/api/templates/${editId}`
        : `${BACKEND_URL}/api/templates`;
      const r = await authFetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setError(data.detail || 'Could not save template');
        setSaving(false);
        return;
      }
      router.replace('/(auth)/workout');
    } catch (e: any) {
      setError(e?.message || 'Failed to save');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={cancel} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEdit ? 'Edit Template' : 'New Template'}</Text>
          <TouchableOpacity onPress={save} disabled={saving} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            {saving ? (
              <ActivityIndicator size="small" color={ACCENT} />
            ) : (
              <Text style={[styles.saveText, { opacity: name.trim() && items.length > 0 ? 1 : 0.4 }]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name input */}
          <Text style={styles.label}>TEMPLATE NAME</Text>
          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Push Day, Monday Workout"
            placeholderTextColor="#555"
            maxLength={50}
          />

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={ERROR} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Exercise list */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 }}>
            <Text style={styles.label}>EXERCISES ({items.length})</Text>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="dumbbell" size={36} color={TEXT_MUTED} />
              <Text style={styles.emptyTitle}>No exercises yet</Text>
              <Text style={styles.emptySub}>Tap "Add Exercise" to begin</Text>
            </View>
          ) : (
            items.map((it, idx) => (
              <ExerciseCard
                key={it.id}
                item={it}
                index={idx}
                total={items.length}
                onChange={(patch) => updateItem(it.id, patch)}
                onMoveUp={() => moveItem(it.id, -1)}
                onMoveDown={() => moveItem(it.id, 1)}
                onMore={() => setOptionsFor(it)}
              />
            ))
          )}

          {/* Add exercise */}
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)} activeOpacity={0.8}>
            <Ionicons name="add-circle" size={22} color={ACCENT} />
            <Text style={styles.addBtnText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Exercise picker */}
        <ExercisePickerSheet
          visible={showPicker}
          onClose={() => setShowPicker(false)}
          onPick={addExercise}
        />

        {/* Options menu for a single exercise */}
        {optionsFor && (
          <ExerciseOptionsMenu
            visible={!!optionsFor}
            exerciseName={optionsFor.name}
            currentRestSeconds={optionsFor.rest_seconds}
            onClose={() => setOptionsFor(null)}
            onAddNote={(note: string) => {
              updateItem(optionsFor.id, { note });
              setOptionsFor(null);
            }}
            onAddWarmupSets={() => {
              updateItem(optionsFor.id, { warmup_sets: 2 });
              setOptionsFor(null);
            }}
            onUpdateRestTimer={(sec: number) => {
              updateItem(optionsFor.id, { rest_seconds: sec });
              setOptionsFor(null);
            }}
            onReplaceExercise={() => {
              setOptionsFor(null);
              setTimeout(() => setShowPicker(true), 250);
            }}
            onCreateSuperset={() => {
              Alert.alert('Superset', 'Tap another exercise after this one to pair them as a superset.');
              setOptionsFor(null);
            }}
            onRemoveExercise={() => {
              removeItem(optionsFor.id);
              setOptionsFor(null);
            }}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


function ExerciseCard({
  item,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onMore,
}: {
  item: TemplateExercise;
  index: number;
  total: number;
  onChange: (patch: Partial<TemplateExercise>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMore: () => void;
}) {
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    let cancel = false;
    authFetch(`${BACKEND_URL}/api/exercises/muscles-thumbnail?name=${encodeURIComponent(item.name)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancel && d?.thumbnail_url) setThumbnail(d.thumbnail_url);
      })
      .catch(() => {});
    return () => { cancel = true; };
  }, [item.name]);

  const restOptions = [60, 90, 120, 180, 240, 300];

  return (
    <View style={styles.exCard}>
      {/* Reorder handle */}
      <View style={styles.reorderCol}>
        <TouchableOpacity
          onPress={onMoveUp}
          disabled={index === 0}
          style={[styles.reorderBtn, index === 0 && { opacity: 0.25 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-up" size={18} color="#fff" />
        </TouchableOpacity>
        <Ionicons name="reorder-three" size={20} color={TEXT_MUTED} />
        <TouchableOpacity
          onPress={onMoveDown}
          disabled={index === total - 1}
          style={[styles.reorderBtn, index === total - 1 && { opacity: 0.25 }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-down" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Thumbnail */}
      <View style={styles.thumb}>
        {thumbnail ? (
          <Image source={{ uri: thumbnail }} style={styles.thumbImg} resizeMode="contain" />
        ) : (
          <MaterialCommunityIcons name="dumbbell" size={20} color={TEXT_MUTED} />
        )}
      </View>

      {/* Body */}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.exName} numberOfLines={1}>{item.name}</Text>
            {item.muscle_group ? (
              <Text style={styles.exMuscle}>{item.muscle_group}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={onMore} style={styles.moreBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Sets x Reps inputs */}
        <View style={styles.row}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>SETS</Text>
            <TextInput
              style={styles.fieldInput}
              value={String(item.default_sets || '')}
              onChangeText={(v) => onChange({ default_sets: parseInt(v || '0', 10) || 0 })}
              keyboardType="number-pad"
              maxLength={2}
              selectTextOnFocus
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>REPS</Text>
            <TextInput
              style={styles.fieldInput}
              value={String(item.default_reps || '')}
              onChangeText={(v) => onChange({ default_reps: parseInt(v || '0', 10) || 0 })}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
            />
          </View>
          <View style={[styles.field, { flex: 1.4 }]}>
            <Text style={styles.fieldLabel}>REST</Text>
            <View style={styles.restRow}>
              {restOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => onChange({ rest_seconds: opt })}
                  style={[styles.restPill, item.rest_seconds === opt && styles.restPillActive]}
                >
                  <Text style={[styles.restPillText, item.rest_seconds === opt && { color: '#000' }]}>
                    {opt < 60 ? `${opt}s` : `${Math.round(opt / 60)}m`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Note + warmup chip */}
        {(item.note || item.warmup_sets) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {item.warmup_sets ? (
              <View style={styles.chip}>
                <Ionicons name="flame-outline" size={12} color={ACCENT} />
                <Text style={styles.chipText}>{item.warmup_sets} warm-up sets</Text>
              </View>
            ) : null}
            {item.note ? (
              <View style={styles.chip}>
                <Ionicons name="reader-outline" size={12} color={ACCENT} />
                <Text style={styles.chipText} numberOfLines={1}>{item.note}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}


/** Lightweight exercise picker — searches /api/exercises/search by name + muscle group */
function ExercisePickerSheet({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (name: string, muscle_group?: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<string | null>(null);
  const [groups, setGroups] = useState<string[]>([]);
  const [results, setResults] = useState<{ name: string; muscle_group: string }[]>([]);
  const [allItems, setAllItems] = useState<{ name: string; muscle_group: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    authFetch(`${BACKEND_URL}/api/exercises/library`)
      .then((r) => r.json())
      .then((d) => {
        const lib = d.library || {};
        setGroups(Object.keys(lib));
        const all: { name: string; muscle_group: string }[] = [];
        Object.entries(lib).forEach(([g, names]: any) => {
          (names as string[]).forEach((n) => all.push({ name: n, muscle_group: g }));
        });
        setAllItems(all);
        setResults(all);
      })
      .catch(() => {});
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      // Local filter for snappy UX
      let r = allItems;
      if (muscleGroup) r = r.filter((it) => it.muscle_group === muscleGroup);
      if (query.trim()) {
        const q = query.toLowerCase();
        r = r.filter((it) => it.name.toLowerCase().includes(q));
      }
      setResults(r);
      setLoading(false);
    }, 150);
    setLoading(true);
    return () => clearTimeout(t);
  }, [query, muscleGroup, visible, allItems]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={pickerStyles.backdrop}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.handle} />
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Add Exercise</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises…"
            placeholderTextColor="#555"
            style={pickerStyles.search}
            autoCorrect={false}
          />

          {/* Muscle group pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }}>
            <TouchableOpacity
              onPress={() => setMuscleGroup(null)}
              style={[pickerStyles.pill, !muscleGroup && pickerStyles.pillActive]}
            >
              <Text style={[pickerStyles.pillText, !muscleGroup && { color: '#000', fontWeight: '800' }]}>All</Text>
            </TouchableOpacity>
            {groups.map((g) => (
              <TouchableOpacity
                key={g}
                onPress={() => setMuscleGroup(g)}
                style={[pickerStyles.pill, muscleGroup === g && pickerStyles.pillActive]}
              >
                <Text style={[pickerStyles.pillText, muscleGroup === g && { color: '#000', fontWeight: '800' }]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Results */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }}>
            {loading ? (
              <ActivityIndicator size="small" color={ACCENT} style={{ marginTop: 30 }} />
            ) : results.length === 0 ? (
              <Text style={{ color: TEXT_MUTED, textAlign: 'center', marginTop: 40 }}>
                No exercises match.
              </Text>
            ) : (
              results.map((r) => (
                <TouchableOpacity
                  key={`${r.muscle_group}-${r.name}`}
                  style={pickerStyles.row}
                  onPress={() => onPick(r.name, r.muscle_group)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={pickerStyles.rowName}>{r.name}</Text>
                    <Text style={pickerStyles.rowMuscle}>{r.muscle_group}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={ACCENT} />
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  cancelText: { color: TEXT_MUTED, fontSize: 15, fontWeight: '600' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
  saveText: { color: ACCENT, fontSize: 15, fontWeight: '800' },

  label: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderColor: ERROR,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
  },
  errorText: { color: ERROR, fontSize: 13, fontWeight: '600', flex: 1 },

  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginTop: 10 },
  emptySub: { color: TEXT_MUTED, fontSize: 12, marginTop: 2 },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: ACCENT,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(245,166,35,0.05)',
    marginTop: 14,
  },
  addBtnText: { color: ACCENT, fontWeight: '800', fontSize: 14 },

  exCard: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftColor: ACCENT,
    borderLeftWidth: 3,
    gap: 8,
  },
  reorderCol: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  reorderBtn: {
    width: 28,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumb: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: '#0D0D0F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 2,
  },
  thumbImg: { width: 48, height: 48 },
  exName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  exMuscle: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
  moreBtn: { padding: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  field: { flex: 1 },
  fieldLabel: { color: TEXT_MUTED, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 },
  fieldInput: {
    backgroundColor: '#0D0D0F',
    borderColor: BORDER,
    borderWidth: 1,
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: 'center',
  },
  restRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  restPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#0D0D0F',
  },
  restPillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  restPillText: { color: TEXT_MUTED, fontSize: 10, fontWeight: '700' },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D0D0F',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '600' },
});


const pickerStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    maxHeight: '85%',
    minHeight: '60%',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '800' },
  search: {
    backgroundColor: CARD,
    borderColor: BORDER,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 14,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  pillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  rowName: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowMuscle: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },
});
