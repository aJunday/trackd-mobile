import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useAuth } from './_layout';

const ACCENT = '#00D4FF';
const CARD_BG = '#0F0F0F';
const BORDER = '#1F1F1F';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const ACTIVITY_OPTIONS = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise', icon: 'bed-outline', mult: 1.2 },
  { id: 'lightly_active', label: 'Lightly Active', desc: 'Exercise 1-3 days/week', icon: 'walk-outline', mult: 1.375 },
  { id: 'moderately_active', label: 'Moderately Active', desc: 'Exercise 3-5 days/week', icon: 'bicycle-outline', mult: 1.55 },
  { id: 'very_active', label: 'Very Active', desc: 'Exercise 6-7 days/week', icon: 'flame-outline', mult: 1.725 },
  { id: 'extra_active', label: 'Extra Active', desc: 'Hard daily training', icon: 'rocket-outline', mult: 1.9 },
];

const GOAL_OPTIONS = [
  { id: 'lose_fat', label: 'Lose Fat', desc: '-400 kcal cut', icon: 'trending-down', adj: -400, color: '#FF6B6B' },
  { id: 'maintain', label: 'Maintain', desc: 'Stay where you are', icon: 'remove-outline', adj: 0, color: '#FFD166' },
  { id: 'build_muscle', label: 'Build Muscle', desc: '+250 kcal lean bulk', icon: 'trending-up', adj: 250, color: '#06D6A0' },
];

const SPORT_OPTIONS = [
  { id: 'powerlifting', label: 'Powerlifting', icon: 'barbell-outline' },
  { id: 'bodybuilding', label: 'Bodybuilding', icon: 'body-outline' },
  { id: 'crossfit', label: 'CrossFit', icon: 'flash-outline' },
  { id: 'running', label: 'Running', icon: 'walk-outline' },
  { id: 'cycling', label: 'Cycling', icon: 'bicycle-outline' },
  { id: 'team_sports', label: 'Team Sports', icon: 'football-outline' },
  { id: 'martial_arts', label: 'Martial Arts', icon: 'fitness-outline' },
  { id: 'general', label: 'General Fitness', icon: 'pulse-outline' },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { sessionToken, checkAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Form data
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<'male' | 'female' | null>(null);
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [activity, setActivity] = useState<string | null>(null);
  const [goal, setGoal] = useState<string | null>(null);
  const [sport, setSport] = useState<string | null>(null);

  const totalSteps = 4;
  const progress = useRef(new Animated.Value(0)).current;

  const animateProgress = (toStep: number) => {
    Animated.timing(progress, {
      toValue: (toStep + 1) / totalSteps,
      duration: 280,
      useNativeDriver: false,
    }).start();
  };

  React.useEffect(() => {
    animateProgress(step);
  }, [step]);

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const canContinue = () => {
    if (step === 0) return name.trim().length >= 1 && age && parseInt(age) > 0 && sex && heightCm && weightKg;
    if (step === 1) return !!activity;
    if (step === 2) return !!goal;
    if (step === 3) return !!sport;
    return false;
  };

  const next = () => {
    if (!canContinue()) return;
    haptic();
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      submit();
    }
  };

  const back = () => {
    haptic();
    if (step > 0) setStep(step - 1);
  };

  // Mifflin-St Jeor preview
  const livePreview = () => {
    const ageNum = parseInt(age) || 0;
    const w = parseFloat(weightKg) || 0;
    const h = parseFloat(heightCm) || 0;
    if (!ageNum || !w || !h || !sex) return null;
    const bmr = sex === 'male'
      ? 10 * w + 6.25 * h - 5 * ageNum + 5
      : 10 * w + 6.25 * h - 5 * ageNum - 161;
    const mult = ACTIVITY_OPTIONS.find(a => a.id === activity)?.mult ?? 1.55;
    const tdee = bmr * mult;
    const adj = GOAL_OPTIONS.find(g => g.id === goal)?.adj ?? 0;
    const target = Math.round(tdee + adj);
    const protein = Math.round(w * 2);
    const fatCals = target * 0.25;
    const fats = Math.round(fatCals / 9);
    const carbs = Math.round((target - protein * 4 - fatCals) / 4);
    return { bmr: Math.round(bmr), tdee: Math.round(tdee), target, protein, carbs, fats };
  };

  const submit = async () => {
    if (!sessionToken) {
      Alert.alert('Error', 'Not authenticated. Please log in again.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/onboarding/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          age: parseInt(age),
          biological_sex: sex,
          height_cm: parseFloat(heightCm),
          weight_kg: parseFloat(weightKg),
          activity_level: activity,
          goal_type: goal,
          sport,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to save');
      }
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      await checkAuth();
      router.replace('/(auth)/dashboard');
    } catch (e: any) {
      Alert.alert('Onboarding error', e?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const preview = livePreview();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header with progress + back */}
        <View style={styles.header}>
          <TouchableOpacity onPress={back} disabled={step === 0} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={step === 0 ? '#333' : '#fff'} />
          </TouchableOpacity>
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.stepLabel}>
            {step + 1}/{totalSteps}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 0 && (
            <View>
              <Text style={styles.title}>Let&apos;s get to know you</Text>
              <Text style={styles.subtitle}>
                We&apos;ll use this to dial in your daily calories and macros.
              </Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="John"
                placeholderTextColor="#444"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Biological Sex</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.pill, sex === 'male' && styles.pillActive]}
                  onPress={() => { setSex('male'); haptic(); }}
                >
                  <Ionicons name="male" size={18} color={sex === 'male' ? '#000' : '#fff'} />
                  <Text style={[styles.pillText, sex === 'male' && styles.pillTextActive]}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, sex === 'female' && styles.pillActive]}
                  onPress={() => { setSex('female'); haptic(); }}
                >
                  <Ionicons name="female" size={18} color={sex === 'female' ? '#000' : '#fff'} />
                  <Text style={[styles.pillText, sex === 'female' && styles.pillTextActive]}>Female</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.row3}>
                <View style={styles.col}>
                  <Text style={styles.label}>Age</Text>
                  <TextInput
                    style={styles.input}
                    value={age}
                    onChangeText={setAge}
                    placeholder="28"
                    placeholderTextColor="#444"
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="180"
                    placeholderTextColor="#444"
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={weightKg}
                    onChangeText={setWeightKg}
                    placeholder="80"
                    placeholderTextColor="#444"
                    keyboardType="decimal-pad"
                    maxLength={5}
                  />
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={styles.title}>How active are you?</Text>
              <Text style={styles.subtitle}>
                Outside of structured workouts. Daily life movement.
              </Text>
              {ACTIVITY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.optionCard, activity === opt.id && styles.optionCardActive]}
                  onPress={() => { setActivity(opt.id); haptic(); }}
                >
                  <View style={styles.optionLeft}>
                    <Ionicons
                      name={opt.icon as any}
                      size={26}
                      color={activity === opt.id ? ACCENT : '#888'}
                    />
                    <View style={styles.optionText}>
                      <Text style={styles.optionLabel}>{opt.label}</Text>
                      <Text style={styles.optionDesc}>{opt.desc}</Text>
                    </View>
                  </View>
                  <Text style={styles.optionMult}>×{opt.mult}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={styles.title}>What&apos;s your goal?</Text>
              <Text style={styles.subtitle}>You can change this later.</Text>
              {GOAL_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.goalCard,
                    goal === opt.id && { borderColor: opt.color, backgroundColor: opt.color + '15' },
                  ]}
                  onPress={() => { setGoal(opt.id); haptic(); }}
                >
                  <Ionicons name={opt.icon as any} size={32} color={opt.color} />
                  <View style={styles.goalText}>
                    <Text style={styles.goalLabel}>{opt.label}</Text>
                    <Text style={styles.goalDesc}>{opt.desc}</Text>
                  </View>
                  {goal === opt.id && (
                    <Ionicons name="checkmark-circle" size={24} color={opt.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={styles.title}>Pick your sport</Text>
              <Text style={styles.subtitle}>
                We&apos;ll tailor recommendations to your style of training.
              </Text>
              <View style={styles.grid}>
                {SPORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.sportCard, sport === opt.id && styles.sportCardActive]}
                    onPress={() => { setSport(opt.id); haptic(); }}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={28}
                      color={sport === opt.id ? ACCENT : '#bbb'}
                    />
                    <Text style={[styles.sportLabel, sport === opt.id && styles.sportLabelActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Live TDEE Preview */}
              {preview && (
                <View style={styles.previewCard}>
                  <Text style={styles.previewTitle}>Your Daily Targets</Text>
                  <View style={styles.previewRow}>
                    <View style={styles.previewItem}>
                      <Text style={styles.previewValue}>{preview.target}</Text>
                      <Text style={styles.previewLabel}>kcal</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={[styles.previewValue, { color: '#FF6B6B' }]}>{preview.protein}g</Text>
                      <Text style={styles.previewLabel}>protein</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={[styles.previewValue, { color: '#FFD166' }]}>{preview.carbs}g</Text>
                      <Text style={styles.previewLabel}>carbs</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={[styles.previewValue, { color: '#06D6A0' }]}>{preview.fats}g</Text>
                      <Text style={styles.previewLabel}>fats</Text>
                    </View>
                  </View>
                  <Text style={styles.previewMeta}>
                    BMR {preview.bmr} • TDEE {preview.tdee} (Mifflin-St Jeor)
                  </Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer Continue */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cta, (!canContinue() || submitting) && styles.ctaDisabled]}
            onPress={next}
            disabled={!canContinue() || submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Text style={styles.ctaText}>
                  {step === totalSteps - 1 ? 'Calculate My Targets' : 'Continue'}
                </Text>
                <Ionicons name="arrow-forward" size={22} color="#000" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backBtn: { padding: 4 },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1A1A1A',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
  },
  stepLabel: { color: '#888', fontSize: 13, fontWeight: '600' },
  scroll: { padding: 24, paddingBottom: 40 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, marginBottom: 24, lineHeight: 22 },
  label: { color: '#aaa', fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  input: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  row: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  row3: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  pillActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  pillText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  pillTextActive: { color: '#000' },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginBottom: 10,
  },
  optionCardActive: { borderColor: ACCENT, backgroundColor: 'rgba(0,212,255,0.08)' },
  optionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  optionText: { marginLeft: 14, flex: 1 },
  optionLabel: { color: '#fff', fontSize: 16, fontWeight: '700' },
  optionDesc: { color: '#888', fontSize: 13, marginTop: 2 },
  optionMult: { color: ACCENT, fontWeight: '700', fontSize: 13 },
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginBottom: 12,
  },
  goalText: { flex: 1, marginLeft: 14 },
  goalLabel: { color: '#fff', fontSize: 17, fontWeight: '700' },
  goalDesc: { color: '#888', fontSize: 13, marginTop: 2 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  sportCard: {
    width: '48%',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    gap: 8,
  },
  sportCardActive: { borderColor: ACCENT, backgroundColor: 'rgba(0,212,255,0.08)' },
  sportLabel: { color: '#bbb', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  sportLabelActive: { color: '#fff' },
  previewCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: ACCENT,
    marginTop: 10,
  },
  previewTitle: { color: ACCENT, fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  previewItem: { alignItems: 'center', flex: 1 },
  previewValue: { color: '#fff', fontSize: 20, fontWeight: '800' },
  previewLabel: { color: '#888', fontSize: 11, marginTop: 2 },
  previewMeta: { color: '#555', fontSize: 11, textAlign: 'center', marginTop: 6 },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 16 : 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: '#000',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 8,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '700' },
});
