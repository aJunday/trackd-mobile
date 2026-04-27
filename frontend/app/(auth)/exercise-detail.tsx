/**
 * Exercise Detail Screen
 *
 * Shows for a given exercise:
 *   1. Animated GIF demonstration (top, alternating 2 frames from free-exercise-db)
 *      OR YouTube embed fallback if free-exercise-db has no match
 *   2. Animated muscle map (front + back) with primary muscles pulsing in gold,
 *      secondary in lighter gold
 *   3. Instructions (step-by-step from free-exercise-db)
 *   4. "Watch on YouTube" button — always available
 *
 * Route: /(auth)/exercise-detail?name=Bench%20Press
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import ExerciseGifPlayer from '../../src/components/ExerciseGifPlayer';
import MuscleMap, { MuscleEntry } from '../../src/components/MuscleMap';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

type DetailResp = {
  name: string;
  matched_name: string | null;
  source: 'free-exercise-db' | 'youtube';
  frames: string[];
  primary_muscles: MuscleEntry[];
  secondary_muscles: MuscleEntry[];
  instructions: string[] | null;
  youtube_search_url: string;
  youtube_embed_url: string;
  equipment: string | null;
  level: string | null;
  category: string | null;
};

const COLORS = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  border: '#2A2A2A',
  text: '#F5F5F5',
  textDim: '#888',
  gold: '#F5A623',
  goldDim: '#7A5510',
};

export default function ExerciseDetailScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResp | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDetails = useCallback(async () => {
    if (!name) return;
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/exercises/details?name=${encodeURIComponent(String(name))}`
      );
      const j = await res.json();
      setData(j);
    } catch (e) {
      console.error('Failed to load exercise details', e);
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const openYouTube = () => {
    if (data?.youtube_search_url) Linking.openURL(data.youtube_search_url);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load exercise details</Text>
        </View>
      </SafeAreaView>
    );
  }

  const hasFrames = data.frames && data.frames.length > 0;
  const hasMuscles = data.primary_muscles.length > 0 || data.secondary_muscles.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {data.name}
          </Text>
          {data.matched_name && data.matched_name !== data.name && (
            <Text style={styles.subtitle} numberOfLines={1}>
              ≈ {data.matched_name}
            </Text>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Demo block: GIF or YouTube embed */}
        <View style={styles.demoCard}>
          {hasFrames ? (
            <ExerciseGifPlayer frames={data.frames} height={260} />
          ) : (
            <View style={styles.youtubeWrap}>
              {Platform.OS === 'web' ? (
                // On web, iframe via src — WebView is a wrapper
                <View style={styles.iframeFallback}>
                  <Text style={styles.fallbackText}>
                    Tap below to view a video tutorial on YouTube
                  </Text>
                </View>
              ) : (
                <WebView
                  source={{ uri: data.youtube_embed_url }}
                  style={styles.webview}
                  allowsFullscreenVideo
                  javaScriptEnabled
                  domStorageEnabled
                />
              )}
            </View>
          )}
          {hasFrames && (
            <Text style={styles.demoLabel}>
              <Ionicons name="play-circle" size={14} color={COLORS.gold} /> 2-frame demo · auto-loop
            </Text>
          )}
        </View>

        {/* Muscle Map */}
        {hasMuscles && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Muscles Worked</Text>
            <View style={styles.muscleCard}>
              <MuscleMap
                primary={data.primary_muscles}
                secondary={data.secondary_muscles}
                size="large"
                showLabels
              />
              <View style={styles.legend}>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.gold }]} />
                  <Text style={styles.legendText}>
                    Primary · {data.primary_muscles.map((m) => m.slug).join(', ') || '—'}
                  </Text>
                </View>
                <View style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: COLORS.goldDim }]} />
                  <Text style={styles.legendText}>
                    Secondary · {data.secondary_muscles.map((m) => m.slug).join(', ') || '—'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Meta chips */}
        {(data.equipment || data.level || data.category) && (
          <View style={styles.chipRow}>
            {data.equipment && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.equipment}</Text>
              </View>
            )}
            {data.level && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.level}</Text>
              </View>
            )}
            {data.category && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{data.category}</Text>
              </View>
            )}
          </View>
        )}

        {/* Instructions */}
        {data.instructions && data.instructions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How to Perform</Text>
            <View style={styles.instructions}>
              {data.instructions.map((step, idx) => (
                <View key={idx} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepNum}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* YouTube button — always */}
        <TouchableOpacity style={styles.youtubeBtn} onPress={openYouTube} activeOpacity={0.8}>
          <Ionicons name="logo-youtube" size={20} color="#FFF" />
          <Text style={styles.youtubeBtnText}>Watch on YouTube</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: COLORS.textDim, fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBtn: { padding: 6, marginRight: 4 },
  title: { color: COLORS.text, fontSize: 19, fontWeight: '700' },
  subtitle: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  scroll: { padding: 16 },
  demoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  demoLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: '500',
  },
  youtubeWrap: {
    height: 220,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
  },
  webview: { flex: 1, backgroundColor: '#000' },
  iframeFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: { color: COLORS.textDim, fontSize: 14, textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  muscleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  legend: { marginTop: 14, alignSelf: 'stretch' },
  legendRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendText: { color: COLORS.text, fontSize: 12, flex: 1, textTransform: 'capitalize' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    backgroundColor: COLORS.card,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  chipText: { color: COLORS.gold, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  instructions: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepRow: { flexDirection: 'row', marginBottom: 12 },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNum: { color: '#000', fontSize: 13, fontWeight: '800' },
  stepText: { color: COLORS.text, fontSize: 14, flex: 1, lineHeight: 20 },
  youtubeBtn: {
    backgroundColor: '#CC0000',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  youtubeBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
});
