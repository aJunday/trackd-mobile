import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const ACCENT = '#F5A623';
const PR = '#FF6B35';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#2C2C2E';
const TEXT_MUTED = '#8E8E93';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'rep',
    title: 'Log every rep.',
    subtitle: 'Strong-style workout logger with running timer, smart rest timer, plate calculator and auto-PR detection.',
    icon: 'barbell-outline' as const,
    bg: ['#0D0D0F', '#1A0F00'],
  },
  {
    id: 'meal',
    title: 'Scan every meal.',
    subtitle: 'Snap a photo, scan a barcode, or read the label. Gemini AI estimates portions, macros, and confidence.',
    icon: 'scan-outline' as const,
    bg: ['#0D0D0F', '#0F1A0D'],
  },
  {
    id: 'science',
    title: 'Built on real science.',
    subtitle: 'Mifflin-St Jeor TDEE, Epley 1RM, peer-reviewed sport programs across 18 disciplines.',
    icon: 'school-outline' as const,
    bg: ['#0D0D0F', '#1A0D1A'],
  },
];

interface Props {
  onSignIn: () => void;
  loading?: boolean;
}

export default function OnboardingSlides({ onSignIn, loading }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  const haptic = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const advance = () => {
    haptic();
    if (step < SLIDES.length - 1) {
      Animated.sequence([
        Animated.timing(fade, { toValue: 0.3, duration: 120, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
      ]).start();
      setTimeout(() => setStep((s) => s + 1), 120);
    } else {
      onSignIn();
    }
  };

  const skip = () => {
    haptic();
    setStep(SLIDES.length - 1);
  };

  const slide = SLIDES[step];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Skip / Top */}
      <View style={styles.topBar}>
        <View style={styles.brand}>
          <Text style={styles.brandText}>TRACKD</Text>
          <View style={styles.brandLine} />
        </View>
        {step < SLIDES.length - 1 && (
          <TouchableOpacity onPress={skip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      <Animated.View style={[styles.body, { opacity: fade }]}>
        <View style={styles.iconCircle}>
          <Ionicons name={slide.icon} size={80} color={ACCENT} />
        </View>
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>
      </Animated.View>

      {/* Dots + CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>

        {step < SLIDES.length - 1 ? (
          <TouchableOpacity style={styles.cta} onPress={advance} activeOpacity={0.85}>
            <Text style={styles.ctaText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#000" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.googleBtn}
            onPress={onSignIn}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <View style={styles.gIcon}>
                  <Text style={styles.gIconText}>G</Text>
                </View>
                <Text style={styles.ctaText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.legal}>
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brand: { alignItems: 'flex-start' },
  brandText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 3 },
  brandLine: { width: 28, height: 2, backgroundColor: ACCENT, marginTop: 4, borderRadius: 1 },
  skipText: { color: TEXT_MUTED, fontSize: 14, fontWeight: '600' },

  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  iconCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(245,166,35,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(245,166,35,0.3)',
    marginBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  subtitle: {
    color: TEXT_MUTED,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 8,
  },

  footer: { paddingHorizontal: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BORDER },
  dotActive: { backgroundColor: ACCENT, width: 24 },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    paddingVertical: 18,
    borderRadius: 16,
  },
  ctaText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: ACCENT,
    paddingVertical: 18,
    borderRadius: 16,
  },
  gIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gIconText: { color: '#4285F4', fontSize: 18, fontWeight: '900' },
  legal: {
    color: TEXT_MUTED,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    paddingHorizontal: 16,
  },
});
