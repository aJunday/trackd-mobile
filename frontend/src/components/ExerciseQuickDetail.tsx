/**
 * ExerciseQuickDetail — popup that shows a single exercise's GIF, primary
 * muscle diagram and form cues. Used by:
 *   - Template preview modal (tap the ? button next to any exercise)
 *   - Workout active session (Add Note / details flow)
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { authFetch } from '../utils/authFetch';

const ACCENT = '#F5A623';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const BLUE = '#5B8CFF';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Props {
  exerciseName: string | null;
  onClose: () => void;
}

interface ExerciseDetail {
  name?: string;
  frames?: string[];
  muscles?: string[];
  secondary_muscles?: string[];
  instructions?: string[];
  equipment?: string;
}

export default function ExerciseQuickDetail({ exerciseName, onClose }: Props) {
  const [detail, setDetail] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);

  useEffect(() => {
    if (!exerciseName) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await authFetch(
          `${BACKEND_URL}/api/exercises/details?name=${encodeURIComponent(exerciseName)}`
        );
        if (r.ok) {
          const j = await r.json();
          if (!cancelled) setDetail(j);
        }
      } catch {}
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [exerciseName]);

  // Cycle through GIF frames (the backend returns 2-4 stills)
  useEffect(() => {
    if (!detail?.frames || detail.frames.length < 2) return;
    const i = setInterval(() => {
      setFrameIdx((p) => (p + 1) % (detail.frames?.length || 1));
    }, 500);
    return () => clearInterval(i);
  }, [detail?.frames]);

  return (
    <Modal
      visible={!!exerciseName}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>
              {exerciseName}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 36 }}>
            {loading ? (
              <View style={{ padding: 36, alignItems: 'center' }}>
                <ActivityIndicator color={ACCENT} />
              </View>
            ) : detail ? (
              <>
                {/* GIF (cycling stills) */}
                {detail.frames && detail.frames[frameIdx] ? (
                  <View style={styles.gifWrap}>
                    <Image
                      source={{ uri: detail.frames[frameIdx] }}
                      style={styles.gif}
                      resizeMode="contain"
                    />
                  </View>
                ) : (
                  <View style={[styles.gifWrap, { alignItems: 'center', justifyContent: 'center' }]}>
                    <MaterialCommunityIcons name="dumbbell" size={48} color="#444" />
                    <Text style={styles.fallbackTxt}>No demo available</Text>
                  </View>
                )}

                {/* Primary + secondary muscles */}
                {!!detail.muscles?.length && (
                  <>
                    <Text style={styles.section}>Primary muscles</Text>
                    <View style={styles.chipRow}>
                      {detail.muscles.map((m) => (
                        <View key={m} style={styles.chip}>
                          <Text style={styles.chipText}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}
                {!!detail.secondary_muscles?.length && (
                  <>
                    <Text style={styles.section}>Secondary</Text>
                    <View style={styles.chipRow}>
                      {detail.secondary_muscles.map((m) => (
                        <View key={m} style={[styles.chip, styles.chipDim]}>
                          <Text style={[styles.chipText, { color: TEXT_MUTED }]}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {/* Equipment */}
                {!!detail.equipment && (
                  <>
                    <Text style={styles.section}>Equipment</Text>
                    <Text style={styles.body}>{detail.equipment}</Text>
                  </>
                )}

                {/* Form cues / instructions */}
                {!!detail.instructions?.length && (
                  <>
                    <Text style={styles.section}>Form cues</Text>
                    {detail.instructions.slice(0, 6).map((step, idx) => (
                      <View key={idx} style={styles.step}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{idx + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            ) : (
              <Text style={styles.body}>Could not load exercise details.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '92%',
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 },
  gifWrap: {
    width: '100%',
    height: 220,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
    overflow: 'hidden',
  },
  gif: { width: '100%', height: '100%' },
  fallbackTxt: { color: TEXT_MUTED, fontSize: 12, marginTop: 8 },
  section: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 14,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: '#7A5510',
    borderRadius: 8,
  },
  chipDim: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: BORDER,
  },
  chipText: { color: ACCENT, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  body: { color: '#fff', fontSize: 13, lineHeight: 19 },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, color: '#fff', fontSize: 13, lineHeight: 19 },
});
