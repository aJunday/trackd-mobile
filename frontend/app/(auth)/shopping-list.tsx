import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../_layout';

const ACCENT = '#F5A623';
const SUCCESS = '#00FF87';
const MISSING_YELLOW = '#FFD93D';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ShoppingItem {
  item_id: string;
  name: string;
  quantity?: number | null;
  unit?: string | null;
  source?: string;
  checked: boolean;
  created_at?: string;
}

const haptic = () => {
  if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function ShoppingListScreen() {
  const router = useRouter();
  const { sessionToken } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);

  const headers = useCallback(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    }),
    [sessionToken]
  );

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND_URL}/api/shopping-list`, { headers: headers() });
      const data = await r.json();
      setItems(data.items || []);
    } catch (e) {
      console.log('shopping load err', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [headers]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (item: ShoppingItem) => {
    haptic();
    // optimistic update
    setItems((prev) =>
      prev.map((i) => (i.item_id === item.item_id ? { ...i, checked: !i.checked } : i))
    );
    try {
      await fetch(`${BACKEND_URL}/api/shopping-list/${item.item_id}/toggle`, {
        method: 'PUT',
        headers: headers(),
      });
    } catch (e) {
      console.error(e);
      load();
    }
  };

  const remove = async (item: ShoppingItem) => {
    haptic();
    setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
    try {
      await fetch(`${BACKEND_URL}/api/shopping-list/${item.item_id}`, {
        method: 'DELETE',
        headers: headers(),
      });
    } catch (e) {
      console.error(e);
      load();
    }
  };

  const clearChecked = () => {
    const checkedCount = items.filter((i) => i.checked).length;
    if (checkedCount === 0) return;
    Alert.alert(
      'Clear checked items?',
      `Remove ${checkedCount} item${checkedCount === 1 ? '' : 's'} from the list.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            haptic();
            setItems((prev) => prev.filter((i) => !i.checked));
            try {
              await fetch(`${BACKEND_URL}/api/shopping-list/clear/checked`, {
                method: 'DELETE',
                headers: headers(),
              });
            } catch (e) {
              console.error(e);
              load();
            }
          },
        },
      ]
    );
  };

  const addItem = async () => {
    const name = newItemName.trim();
    if (!name || adding) return;
    setAdding(true);
    try {
      const r = await fetch(`${BACKEND_URL}/api/shopping-list`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name, source: 'manual' }),
      });
      if (r.ok) {
        setNewItemName('');
        load();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  const unchecked = items.filter((i) => !i.checked);
  const checked = items.filter((i) => i.checked);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.title}>Shopping List</Text>
          <TouchableOpacity
            onPress={clearChecked}
            style={[styles.iconBtn, checked.length === 0 && { opacity: 0.3 }]}
            disabled={checked.length === 0}
          >
            <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              tintColor={ACCENT}
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          keyboardShouldPersistTaps="handled"
        >
          {/* Add input */}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              placeholder="Add an item…"
              placeholderTextColor="#666"
              value={newItemName}
              onChangeText={setNewItemName}
              onSubmitEditing={addItem}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addBtn, !newItemName.trim() && { opacity: 0.4 }]}
              onPress={addItem}
              disabled={!newItemName.trim() || adding}
            >
              <Ionicons name="add" size={22} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Empty state */}
          {items.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={48} color={TEXT_MUTED} />
              <Text style={styles.emptyTitle}>Your shopping list is empty</Text>
              <Text style={styles.emptySub}>
                Add items here or tap "Add to shopping list" in the AI Chef when an ingredient is missing.
              </Text>
            </View>
          )}

          {/* Unchecked items */}
          {unchecked.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>
                To buy ({unchecked.length})
              </Text>
              {unchecked.map((it) => (
                <View key={it.item_id} style={styles.row}>
                  <TouchableOpacity style={styles.checkbox} onPress={() => toggle(it)}>
                    <View style={styles.checkboxOuter} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.name}</Text>
                    {it.source === 'ai_chef' && (
                      <Text style={styles.itemSource}>From AI Chef</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => remove(it)} style={styles.removeBtn}>
                    <Ionicons name="close" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* Checked items */}
          {checked.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { marginTop: 24 }]}>
                Bought ({checked.length})
              </Text>
              {checked.map((it) => (
                <View key={it.item_id} style={[styles.row, styles.rowChecked]}>
                  <TouchableOpacity style={styles.checkbox} onPress={() => toggle(it)}>
                    <View style={styles.checkboxChecked}>
                      <Ionicons name="checkmark" size={14} color="#000" />
                    </View>
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemName, styles.itemNameChecked]}>{it.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => remove(it)} style={styles.removeBtn}>
                    <Ionicons name="close" size={18} color={TEXT_MUTED} />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scroll: { padding: 16, paddingBottom: 64 },

  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ACCENT,
    justifyContent: 'center',
    alignItems: 'center',
  },

  empty: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 12 },
  emptySub: { color: TEXT_MUTED, fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },

  sectionLabel: {
    color: TEXT_MUTED,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 12,
  },
  rowChecked: {
    opacity: 0.55,
  },
  checkbox: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxOuter: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER,
  },
  checkboxChecked: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: SUCCESS,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: TEXT_MUTED,
  },
  itemSource: {
    color: MISSING_YELLOW,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  removeBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
