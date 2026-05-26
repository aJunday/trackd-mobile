import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#F5A623';
const SUCCESS_COLOR = '#2ECC71';
const WARNING_COLOR = '#FF8C00';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface PantryItem {
  item_id: string;
  item_name: string;
  quantity: number;
  unit: string;
  calories_per_unit: number;
  protein: number;
  carbs: number;
  fats: number;
  brand?: string;
  barcode_id?: string;
  serving_size?: string;
  added_at: string;
}

export default function PantryScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [useModalItem, setUseModalItem] = useState<PantryItem | null>(null);
  const [useQuantity, setUseQuantity] = useState('1');

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const fetchItems = async () => {
    try {
      const searchParam = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      const response = await fetch(`${BACKEND_URL}/api/pantry${searchParam}`, {
        headers: getHeaders(),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
      }
    } catch (error) {
      console.error('Error fetching pantry items:', error);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [searchQuery]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  };

  const handleUseItem = async () => {
    if (!useModalItem) return;

    const qty = parseFloat(useQuantity) || 0;
    if (qty <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/pantry/${useModalItem.item_id}/use`,
        {
          method: 'POST',
          headers: getHeaders(),
          credentials: 'include',
          body: JSON.stringify({ quantity: qty }),
        }
      );

      if (response.ok) {
        setUseModalItem(null);
        setUseQuantity('1');
        fetchItems();
      }
    } catch (error) {
      console.error('Error using item:', error);
    }
  };

  const handleDeleteItem = (item: PantryItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete ${item.item_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${BACKEND_URL}/api/pantry/${item.item_id}`, {
                method: 'DELETE',
                headers: getHeaders(),
                credentials: 'include',
              });
              fetchItems();
            } catch (error) {
              console.error('Error deleting item:', error);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pantry</Text>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => router.push('/(auth)/scanner')}
        >
          <Ionicons name="scan" size={20} color="#000000" />
          <Text style={styles.scanButtonText}>Scan</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666666" />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search pantry..."
          placeholderTextColor="#666666"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666666" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT_COLOR}
          />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="basket-outline" size={64} color="#333333" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No items found' : 'Your pantry is empty'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'Try a different search term'
                : 'Scan a barcode or label to add items'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(auth)/scanner')}
              >
                <Ionicons name="scan" size={20} color="#000000" />
                <Text style={styles.emptyButtonText}>Scan Item</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          items.map((item) => (
            <View key={item.item_id} style={styles.itemCard}>
              <View style={styles.itemMain}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.item_name}</Text>
                  {item.brand && (
                    <Text style={styles.itemBrand}>{item.brand}</Text>
                  )}
                  <View style={styles.itemQuantity}>
                    <Text style={styles.quantityText}>
                      {item.quantity} {item.unit}
                    </Text>
                    {item.serving_size && (
                      <Text style={styles.servingText}>
                        • {item.serving_size}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.itemNutrition}>
                  <Text style={styles.caloriesValue}>
                    {Math.round(item.calories_per_unit)}
                  </Text>
                  <Text style={styles.caloriesLabel}>cal/unit</Text>
                </View>
              </View>

              <View style={styles.macrosRow}>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>{item.protein}g</Text>
                  <Text style={styles.macroLabel}>P</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>{item.carbs}g</Text>
                  <Text style={styles.macroLabel}>C</Text>
                </View>
                <View style={styles.macroItem}>
                  <Text style={styles.macroValue}>{item.fats}g</Text>
                  <Text style={styles.macroLabel}>F</Text>
                </View>
                <Text style={styles.addedDate}>
                  Added {formatDate(item.added_at)}
                </Text>
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.useButton}
                  onPress={() => {
                    setUseModalItem(item);
                    setUseQuantity('1');
                  }}
                >
                  <Ionicons name="remove-circle-outline" size={18} color={ACCENT_COLOR} />
                  <Text style={styles.useButtonText}>Use</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDeleteItem(item)}
                >
                  <Ionicons name="trash-outline" size={18} color="#FF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* Add Manual Button */}
        <TouchableOpacity
          style={styles.addManualButton}
          onPress={() => router.push('/(auth)/add-pantry-item')}
        >
          <Ionicons name="add-circle-outline" size={24} color={ACCENT_COLOR} />
          <Text style={styles.addManualText}>Add Item Manually</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Use Item Modal */}
      <Modal
        visible={useModalItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setUseModalItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Use Item</Text>
            <Text style={styles.modalSubtitle}>
              {useModalItem?.item_name}
            </Text>
            <Text style={styles.modalAvailable}>
              Available: {useModalItem?.quantity} {useModalItem?.unit}
            </Text>

            <View style={styles.quantityInputContainer}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() =>
                  setUseQuantity(Math.max(1, parseFloat(useQuantity) - 1).toString())
                }
              >
                <Ionicons name="remove" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TextInput
                style={styles.quantityInput}
                value={useQuantity}
                onChangeText={setUseQuantity}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor="#666666"
              />
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={() =>
                  setUseQuantity((parseFloat(useQuantity) + 1).toString())
                }
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setUseModalItem(null)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleUseItem}
              >
                <Text style={styles.modalConfirmText}>Use</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 6,
  },
  scanButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    marginHorizontal: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  emptyState: {
    alignItems: 'center',
    padding: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
    gap: 8,
  },
  emptyButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  itemCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  itemMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  itemBrand: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  itemQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 6,
  },
  quantityText: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: '500',
  },
  servingText: {
    fontSize: 13,
    color: '#666666',
  },
  itemNutrition: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,166,35,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  caloriesValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  caloriesLabel: {
    fontSize: 10,
    color: '#666666',
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
    paddingTop: 12,
    gap: 16,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  macroLabel: {
    fontSize: 12,
    color: '#666666',
  },
  addedDate: {
    marginLeft: 'auto',
    fontSize: 12,
    color: '#555555',
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  useButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,166,35,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  useButtonText: {
    color: ACCENT_COLOR,
    fontWeight: '500',
    fontSize: 14,
  },
  deleteButton: {
    padding: 8,
  },
  addManualButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
    borderWidth: 2,
    borderColor: '#1A1A1A',
    borderStyle: 'dashed',
    borderRadius: 16,
    marginTop: 8,
  },
  addManualText: {
    color: ACCENT_COLOR,
    fontWeight: '500',
    fontSize: 16,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: ACCENT_COLOR,
    textAlign: 'center',
    marginTop: 8,
  },
  modalAvailable: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityInput: {
    width: 80,
    height: 50,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#888888',
    fontWeight: '600',
    fontSize: 16,
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalConfirmText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
});
