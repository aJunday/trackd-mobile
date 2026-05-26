/**
 * DailyWarningIntro — shown once per day on first login.
 * Plays a ~2 second sequence: bencher → weights slide off → red flash →
 * warning sign → rotating inspirational quote → auto-dismiss / Skip.
 *
 * Storage key: `trackd.last_warning_date` — YYYY-MM-DD of last show.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Circle, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ACCENT = '#F5A623';
const BG = '#0D0D0F';
const WARN = '#FF4D4F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';

const STORAGE_KEY = 'trackd.last_warning_date';

const QUOTES: string[] = [
  "The only bad workout is the one that didn't happen.",
  'Progress is progress no matter how small.',
  "Your body can do it. It's your mind you need to convince.",
  'Discipline weighs ounces, regret weighs tons.',
  "Sweat is just fat crying. Make it cry today.",
  "The pain you feel today is the strength you'll feel tomorrow.",
  "Don't count the days, make the days count.",
  'Strong is what you become when you have no other choice.',
  'The hardest lift of all is lifting your butt off the couch.',
  'Train insane or remain the same.',
  'Push yourself because no one else is going to do it for you.',
  'The body achieves what the mind believes.',
  "Excuses don't burn calories.",
  "You don't have to be extreme, just consistent.",
  "If it doesn't challenge you, it doesn't change you.",
  'Success is the sum of small efforts repeated day in and day out.',
  "Every workout is a step closer to the person you want to become.",
  "Tough times don't last. Tough people do.",
  "The only person you should try to be better than is the one you were yesterday.",
  "Your future self will thank you for the workout you did today.",
];

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function pickDailyQuote(): string {
  // Seed by day so the quote is stable through the day
  const d = today();
  let seed = 0;
  for (let i = 0; i < d.length; i++) seed = (seed * 31 + d.charCodeAt(i)) >>> 0;
  return QUOTES[seed % QUOTES.length];
}

const haptic = (type: 'light' | 'warning' = 'light') => {
  if (Platform.OS === 'web') return;
  if (type === 'warning') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function DailyWarningIntro({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState<boolean | null>(null); // null = checking
  const quote = useMemo(() => pickDailyQuote(), []);

  // Animation values
  const fade = useRef(new Animated.Value(0)).current;            // overall fade in
  const plateOffset = useRef(new Animated.Value(0)).current;      // weights slide off
  const redFlash = useRef(new Animated.Value(0)).current;         // red overlay
  const warnScale = useRef(new Animated.Value(0)).current;        // warning sign pop
  const quoteFade = useRef(new Animated.Value(0)).current;        // quote card fade

  // Decide whether to show
  useEffect(() => {
    (async () => {
      try {
        const last = await AsyncStorage.getItem(STORAGE_KEY);
        if (last === today()) {
          setShow(false);
          onDone();
          return;
        }
      } catch {}
      setShow(true);
    })();
  }, [onDone]);

  // Run animation once we've decided to show
  useEffect(() => {
    if (!show) return;
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    haptic('light');
    // T=0.0s: scene visible, plates start sliding off at 0.35s
    Animated.sequence([
      Animated.delay(350),
      Animated.timing(plateOffset, {
        toValue: 1,
        duration: 380,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      // T~0.75s: red flash
      Animated.parallel([
        Animated.sequence([
          Animated.timing(redFlash, { toValue: 1, duration: 130, useNativeDriver: true }),
          Animated.timing(redFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
        Animated.timing(warnScale, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.back(2)),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(quoteFade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start(() => {
      haptic('warning');
    });

    // Auto-dismiss at 2000ms
    const t = setTimeout(() => dismiss(), 2000);
    return () => clearTimeout(t);
  }, [show]);

  const dismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, today());
    } catch {}
    Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setShow(false);
      onDone();
    });
  };

  if (!show) return null;

  // Plates slide off to the right by 60px and rotate slightly
  const plateTranslate = plateOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 60],
  });
  const plateRotate = plateOffset.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '14deg'],
  });
  const plateFall = plateOffset.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fade }]} pointerEvents="auto">
      {/* Skip button always visible top-right */}
      <TouchableOpacity style={styles.skipBtn} onPress={dismiss} hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
        <Ionicons name="close" size={16} color="#fff" />
      </TouchableOpacity>

      {/* Animated illustration */}
      <View style={styles.illustration}>
        <Svg width={260} height={170} viewBox="0 0 260 170">
          {/* Bench */}
          <Rect x={60} y={120} width={140} height={10} rx={3} fill="#3a3a3d" />
          <Rect x={68} y={130} width={6} height={26} fill="#3a3a3d" />
          <Rect x={186} y={130} width={6} height={26} fill="#3a3a3d" />
          {/* Body lying on bench */}
          <Rect x={80} y={108} width={100} height={14} rx={6} fill="#888" />
          <Circle cx={80} cy={115} r={10} fill="#aaa" />
          {/* Arms reaching up */}
          <Line x1={120} y1={108} x2={120} y2={75} stroke="#888" strokeWidth={6} strokeLinecap="round" />
          <Line x1={150} y1={108} x2={150} y2={75} stroke="#888" strokeWidth={6} strokeLinecap="round" />
          {/* Barbell shaft */}
          <Rect x={70} y={70} width={130} height={6} rx={2} fill="#d4d4d4" />
          {/* Sleeves (no clips) */}
          <Rect x={62} y={67} width={10} height={12} fill="#888" />
          <Rect x={198} y={67} width={10} height={12} fill="#888" />
        </Svg>

        {/* Left plates — stay put */}
        <View style={[styles.platesAbs, { left: 30 }]}>
          <View style={[styles.plate, { backgroundColor: '#FF4D4F', height: 56, width: 16 }]} />
          <View style={[styles.plate, { backgroundColor: '#5a5a5a', height: 44, width: 14, marginLeft: 4 }]} />
        </View>

        {/* Right plates — slide off & rotate */}
        <Animated.View
          style={[
            styles.platesAbs,
            {
              right: 30,
              flexDirection: 'row-reverse',
              transform: [
                { translateX: plateTranslate },
                { translateY: plateFall },
                { rotate: plateRotate },
              ],
            },
          ]}
        >
          <View style={[styles.plate, { backgroundColor: '#FF4D4F', height: 56, width: 16 }]} />
          <View style={[styles.plate, { backgroundColor: '#5a5a5a', height: 44, width: 14, marginRight: 4 }]} />
        </Animated.View>

        {/* Warning sign — pops in after slide */}
        <Animated.View
          style={[
            styles.warnIconWrap,
            { transform: [{ scale: warnScale }] },
          ]}
        >
          <Svg width={56} height={50} viewBox="0 0 56 50">
            <Path d="M28 4 L52 46 L4 46 Z" fill={WARN} stroke="#000" strokeWidth={2} strokeLinejoin="round" />
            <Rect x={26} y={18} width={4} height={16} rx={1} fill="#fff" />
            <Circle cx={28} cy={40} r={2.5} fill="#fff" />
          </Svg>
        </Animated.View>
      </View>

      {/* Tagline under illustration */}
      <Text style={styles.taglineHead}>Always use clips.</Text>
      <Text style={styles.taglineSub}>Train safe — your future self thanks you.</Text>

      {/* Quote card */}
      <Animated.View style={[styles.quoteCard, { opacity: quoteFade }]}>
        <Ionicons name="flash" size={16} color={ACCENT} style={{ marginBottom: 6 }} />
        <Text style={styles.quoteText}>"{quote}"</Text>
      </Animated.View>

      {/* Red flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.flash,
          { opacity: redFlash },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: BG,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 30,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    zIndex: 10,
  },
  skipText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  illustration: {
    width: 260,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  platesAbs: {
    position: 'absolute',
    top: 47,
    flexDirection: 'row',
    alignItems: 'center',
  },
  plate: {
    borderRadius: 3,
  },
  warnIconWrap: {
    position: 'absolute',
    top: 16,
    right: 6,
  },

  taglineHead: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 0.3,
  },
  taglineSub: {
    color: TEXT_MUTED,
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  quoteCard: {
    marginTop: 26,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 22,
    paddingVertical: 20,
    borderRadius: 16,
    alignItems: 'center',
    maxWidth: 320,
  },
  quoteText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
    fontStyle: 'italic',
  },

  flash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WARN,
  },
});
