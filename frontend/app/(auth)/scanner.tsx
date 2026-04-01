import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';
const SUCCESS_COLOR = '#00FF87';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface ScannedItem {
  item_name: string;
  brand?: string;
  serving_size?: string;
  calories_per_unit: number;
  protein: number;
  carbs: number;
  fats: number;
  barcode_id?: string;
}

type ScanMode = 'barcode' | 'label';

export default function ScannerScreen() {
  const { sessionToken } = useAuth();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  
  const [scanMode, setScanMode] = useState<ScanMode>('barcode');
  const [isScanning, setIsScanning] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('serving');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }
    return headers;
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!isScanning || isProcessing) return;
    
    setIsScanning(false);
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry/scan-barcode`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ barcode: data }),
      });

      const result = await response.json();

      if (result.found) {
        setScannedItem(result.item);
        setShowConfirmModal(true);
      } else {
        Alert.alert(
          'Product Not Found',
          'This barcode is not in our database. Would you like to scan the nutrition label instead?',
          [
            {
              text: 'Scan Label',
              onPress: () => {
                setScanMode('label');
                setIsScanning(true);
              },
            },
            {
              text: 'Enter Manually',
              onPress: () => router.push('/(auth)/add-pantry-item'),
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setIsScanning(true),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      Alert.alert('Error', 'Failed to lookup barcode');
      setIsScanning(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      await processLabelImage(result.assets[0].base64);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      await processLabelImage(result.assets[0].base64);
    }
  };

  const processLabelImage = async (base64Image: string) => {
    setIsProcessing(true);

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry/scan-label`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({ image_base64: base64Image }),
      });

      const result = await response.json();

      if (result.success) {
        setScannedItem(result.item);
        setShowConfirmModal(true);
      } else {
        Alert.alert(
          'Could Not Read Label',
          result.message || 'Failed to extract nutrition information from the image. Try taking a clearer photo.',
          [
            { text: 'Try Again', onPress: () => setScanMode('label') },
            { text: 'Enter Manually', onPress: () => router.push('/(auth)/add-pantry-item') },
          ]
        );
      }
    } catch (error) {
      console.error('Label scan error:', error);
      Alert.alert('Error', 'Failed to analyze the nutrition label');
    } finally {
      setIsProcessing(false);
    }
  };

  const addToPantry = async () => {
    if (!scannedItem) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/pantry`, {
        method: 'POST',
        headers: getHeaders(),
        credentials: 'include',
        body: JSON.stringify({
          item_name: scannedItem.item_name,
          quantity: parseFloat(quantity) || 1,
          unit: unit,
          calories_per_unit: scannedItem.calories_per_unit,
          protein: scannedItem.protein,
          carbs: scannedItem.carbs,
          fats: scannedItem.fats,
          brand: scannedItem.brand || '',
          serving_size: scannedItem.serving_size || '',
          barcode_id: scannedItem.barcode_id || '',
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Item added to pantry!', [
          { text: 'Add Another', onPress: resetScanner },
          { text: 'View Pantry', onPress: () => router.push('/(auth)/pantry') },
        ]);
      } else {
        throw new Error('Failed to add item');
      }
    } catch (error) {
      console.error('Error adding to pantry:', error);
      Alert.alert('Error', 'Failed to add item to pantry');
    }

    setShowConfirmModal(false);
  };

  const resetScanner = () => {
    setScannedItem(null);
    setShowConfirmModal(false);
    setQuantity('1');
    setUnit('serving');
    setIsScanning(true);
  };

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-outline" size={64} color="#333333" />
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to scan barcodes and nutrition labels.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => router.push('/(auth)/add-pantry-item')}
          >
            <Text style={styles.manualButtonText}>Add Manually Instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Scan Item</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mode Toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
          onPress={() => {
            setScanMode('barcode');
            setIsScanning(true);
          }}
        >
          <Ionicons
            name="barcode-outline"
            size={20}
            color={scanMode === 'barcode' ? '#000000' : '#888888'}
          />
          <Text style={[styles.modeText, scanMode === 'barcode' && styles.modeTextActive]}>
            Barcode
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, scanMode === 'label' && styles.modeButtonActive]}
          onPress={() => setScanMode('label')}
        >
          <Ionicons
            name="document-text-outline"
            size={20}
            color={scanMode === 'label' ? '#000000' : '#888888'}
          />
          <Text style={[styles.modeText, scanMode === 'label' && styles.modeTextActive]}>
            Label OCR
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      {scanMode === 'barcode' ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
            }}
            onBarcodeScanned={isScanning && !isProcessing ? handleBarcodeScanned : undefined}
          />
          {/* Viewfinder overlay */}
          <View style={styles.viewfinderOverlay}>
            <View style={styles.viewfinderTop} />
            <View style={styles.viewfinderMiddle}>
              <View style={styles.viewfinderSide} />
              <View style={styles.viewfinderBox}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              <View style={styles.viewfinderSide} />
            </View>
            <View style={styles.viewfinderBottom}>
              <Text style={styles.scanHint}>
                {isProcessing ? 'Processing...' : 'Point camera at barcode'}
              </Text>
            </View>
          </View>
          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color={ACCENT_COLOR} />
              <Text style={styles.processingText}>Looking up product...</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.labelModeContainer}>
          <View style={styles.labelInstructions}>
            <Ionicons name="nutrition-outline" size={64} color={ACCENT_COLOR} />
            <Text style={styles.labelTitle}>Scan Nutrition Label</Text>
            <Text style={styles.labelText}>
              Take a photo of the Nutrition Facts label on the product packaging.
              Make sure the text is clear and well-lit.
            </Text>
          </View>

          <View style={styles.labelButtons}>
            <TouchableOpacity
              style={styles.labelButton}
              onPress={takePhoto}
              disabled={isProcessing}
            >
              <Ionicons name="camera" size={28} color="#000000" />
              <Text style={styles.labelButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.labelButton, styles.labelButtonSecondary]}
              onPress={pickImage}
              disabled={isProcessing}
            >
              <Ionicons name="images" size={28} color={ACCENT_COLOR} />
              <Text style={[styles.labelButtonText, styles.labelButtonTextSecondary]}>
                Choose Photo
              </Text>
            </TouchableOpacity>
          </View>

          {isProcessing && (
            <View style={styles.labelProcessing}>
              <ActivityIndicator size="large" color={ACCENT_COLOR} />
              <Text style={styles.processingText}>Analyzing nutrition label...</Text>
            </View>
          )}
        </View>
      )}

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add to Pantry</Text>

              {scannedItem && (
                <>
                  <View style={styles.itemPreview}>
                    <Text style={styles.itemName}>{scannedItem.item_name}</Text>
                    {scannedItem.brand && (
                      <Text style={styles.itemBrand}>{scannedItem.brand}</Text>
                    )}
                    {scannedItem.serving_size && (
                      <Text style={styles.itemServing}>
                        Serving: {scannedItem.serving_size}
                      </Text>
                    )}
                  </View>

                  <View style={styles.nutritionPreview}>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>
                        {Math.round(scannedItem.calories_per_unit)}
                      </Text>
                      <Text style={styles.nutritionLabel}>Calories</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{scannedItem.protein}g</Text>
                      <Text style={styles.nutritionLabel}>Protein</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{scannedItem.carbs}g</Text>
                      <Text style={styles.nutritionLabel}>Carbs</Text>
                    </View>
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>{scannedItem.fats}g</Text>
                      <Text style={styles.nutritionLabel}>Fats</Text>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Quantity</Text>
                  <View style={styles.quantityRow}>
                    <TextInput
                      style={styles.quantityInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor="#666666"
                    />
                    <TextInput
                      style={styles.unitInput}
                      value={unit}
                      onChangeText={setUnit}
                      placeholder="serving"
                      placeholderTextColor="#666666"
                    />
                  </View>

                  <View style={styles.quickUnits}>
                    {['serving', 'g', 'oz', 'cup', 'piece'].map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.unitChip, unit === u && styles.unitChipActive]}
                        onPress={() => setUnit(u)}
                      >
                        <Text
                          style={[styles.unitChipText, unit === u && styles.unitChipTextActive]}
                        >
                          {u}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowConfirmModal(false);
                    resetScanner();
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton} onPress={addToPantry}>
                  <Ionicons name="add" size={20} color="#000000" />
                  <Text style={styles.addButtonText}>Add to Pantry</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
  modeToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: ACCENT_COLOR,
  },
  modeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888888',
  },
  modeTextActive: {
    color: '#000000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  viewfinderOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  viewfinderTop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  viewfinderMiddle: {
    flexDirection: 'row',
    height: 200,
  },
  viewfinderSide: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  viewfinderBox: {
    width: 280,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: ACCENT_COLOR,
    borderWidth: 3,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  viewfinderBottom: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    paddingTop: 24,
  },
  scanHint: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '500',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginTop: 16,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  permissionText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: ACCENT_COLOR,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  permissionButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  manualButton: {
    marginTop: 16,
    padding: 12,
  },
  manualButtonText: {
    color: ACCENT_COLOR,
    fontSize: 14,
  },
  labelModeContainer: {
    flex: 1,
    padding: 20,
  },
  labelInstructions: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  labelTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  labelText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  labelButtons: {
    gap: 12,
    paddingBottom: 20,
  },
  labelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 12,
  },
  labelButtonSecondary: {
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  labelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  labelButtonTextSecondary: {
    color: ACCENT_COLOR,
  },
  labelProcessing: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0A0A0A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 20,
  },
  itemPreview: {
    alignItems: 'center',
    marginBottom: 20,
  },
  itemName: {
    fontSize: 20,
    fontWeight: '600',
    color: ACCENT_COLOR,
    textAlign: 'center',
  },
  itemBrand: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  itemServing: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  nutritionPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888888',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  quantityInput: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  unitInput: {
    flex: 2,
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
  },
  quickUnits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1A1A1A',
  },
  unitChipActive: {
    backgroundColor: ACCENT_COLOR,
  },
  unitChipText: {
    fontSize: 14,
    color: '#888888',
  },
  unitChipTextActive: {
    color: '#000000',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#888888',
    fontWeight: '600',
    fontSize: 16,
  },
  addButton: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: SUCCESS_COLOR,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addButtonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
});
