/**
 * DailyWarningIntro — daily motivational intro shown once per day.
 *
 * Sequence (~6s total):
 *   0.0s  — Pure black, silhouette starts a smooth bicep curl loop
 *   1.0s  — Skip button fades in (top right)
 *   1.5s  — Quote card fades in (large bold white, gold underline, TRACKD logo)
 *           Quote stays visible 4.0s
 *   ~6.0s — Auto-dismiss
 *
 * Tap Skip at any time after 1s to dismiss immediately.
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
import Svg, { Path, Circle, Rect, Line, Ellipse } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ACCENT = '#F5A623';
const BG = '#000000';
const TEXT_MUTED = '#888';

const STORAGE_KEY = 'trackd.last_warning_date';

const QUOTES: string[] = [
  // David Goggins
  'You are in danger of living a life so comfortable and soft that you will die without ever realizing your true potential.',
  "Don't stop when you're tired. Stop when you're done.",
  'The most important conversation you will ever have is the one you have with yourself.',
  'Suffering is the true test of life.',
  'Nobody cares what you did yesterday. What have you done today?',
  'We live in a world where mediocrity is rewarded and people are afraid to be great.',
  "Motivation is crap. Motivation comes and goes. When you're driven whatever is in front of you will get destroyed.",

  // Kobe Bryant
  'Rest at the end not in the middle.',
  'The moment you give up is the moment you let someone else win.',
  'Great things come from hard work and perseverance. No excuses.',
  'Everything negative — pressure, challenges — is all an opportunity for me to rise.',

  // Muhammad Ali
  "I hated every minute of training but I said don't quit. Suffer now and live the rest of your life as a champion.",
  "It's the repetition of affirmations that leads to belief and once that belief becomes a deep conviction things begin to happen.",
  "Don't count the days. Make the days count.",

  // Arnold Schwarzenegger
  'The last three or four reps is what makes the muscle grow. This area of pain divides a champion from someone who is not.',
  'Strength does not come from winning. Your struggles develop your strengths.',
  'You can have results or excuses. Not both.',

  // Dwayne "The Rock" Johnson
  "Success isn't always about greatness. It's about consistency. Consistent hard work leads to success. Greatness will come.",
  'All successes begin with self discipline. It starts with you.',
  'Blood sweat and respect. First two you give. Last one you earn.',

  // Gen Z / internet fitness culture
  "That person you want to be is on the other side of the workout you don't want to do.",
  'Your future self will thank you for the reps you did today.',
  'Main character energy means showing up for yourself every single day.',
  'No off days. Just different intensity days.',
  'The gym is the one place where showing up is already winning.',
  'Body recomposition is a slow process and the people who succeed are those who are patient enough to trust it.',
  'You are one workout away from a good mood.',
  'Consistency over perfection. Always.',
  'Being sore is just weakness leaving the body.',
  'Train like the version of yourself you want to become.',
];

function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function pickDailyQuote(): string {
  // Seed by today's date so the quote stays stable through the day
  const d = today();
  let seed = 0;
  for (let i = 0; i < d.length; i++) seed = (seed * 31 + d.charCodeAt(i)) >>> 0;
  return QUOTES[seed % QUOTES.length];
}

const subtleHaptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

const AnimatedSvgLine = Animated.createAnimatedComponent(Line);
const AnimatedG = Animated.createAnimatedComponent(View); // wrapper for transform

export default function DailyWarningIntro({ onDone }: { onDone: () => void }) {
  const [show, setShow] = useState<boolean | null>(null);
  const quote = useMemo(() => pickDailyQuote(), []);

  // Animation values
  const fadeIn = useRef(new Animated.Value(0)).current;     // overall scene fade
  const curl = useRef(new Animated.Value(0)).current;       // 0 = arm down, 1 = arm up
  const quoteFade = useRef(new Animated.Value(0)).current;  // quote card fade
  const skipFade = useRef(new Animated.Value(0)).current;   // skip button fade
  const accentScale = useRef(new Animated.Value(0)).current; // gold underline grow

  // Check storage to decide
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

  // Run the choreography once we've decided to show
  useEffect(() => {
    if (!show) return;

    // Scene fade in
    Animated.timing(fadeIn, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    subtleHaptic();

    // Curl loop — runs continuously while overlay is visible
    const curlLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(curl, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false, // we animate svg transforms via JS bridge
        }),
        Animated.timing(curl, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: false,
        }),
      ])
    );
    curlLoop.start();

    // Skip button fades in at 1.0s
    const skipTimer = setTimeout(() => {
      Animated.timing(skipFade, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true,
      }).start();
    }, 1000);

    // Quote fades in at 1.5s with gold underline growing right after
    const quoteTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(quoteFade, {
          toValue: 1,
          duration: 480,
          useNativeDriver: true,
        }),
        Animated.timing(accentScale, {
          toValue: 1,
          duration: 600,
          delay: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, 1500);

    // Auto dismiss at 6.0s (1.5s anim + 4.0s quote + 0.5s outro)
    const dismissTimer = setTimeout(() => {
      dismiss();
    }, 6000);

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(quoteTimer);
      clearTimeout(dismissTimer);
      curlLoop.stop();
    };
  }, [show]);

  const dismiss = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, today());
    } catch {}
    Animated.timing(fadeIn, {
      toValue: 0,
      duration: 240,
      useNativeDriver: true,
    }).start(() => {
      setShow(false);
      onDone();
    });
  };

  if (!show) return null;

  // Bicep curl forearm rotates around the elbow.
  // Resting (0): forearm hangs ~85° below horizontal.
  // Curled  (1): forearm angled ~25° above horizontal toward shoulder.
  // Translated to interpolated coordinates of the wrist endpoint:
  const wristX = curl.interpolate({ inputRange: [0, 1], outputRange: [148, 122] });
  const wristY = curl.interpolate({ inputRange: [0, 1], outputRange: [148, 92] });
  const dumbbellRot = curl.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-25deg'],
  });
  // Bicep "flex" — slight scale on upper arm
  const bicepBulge = curl.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.18],
  });

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]} pointerEvents="auto">
      {/* SKIP BUTTON (fades in at 1.0s) */}
      <Animated.View style={[styles.skipWrap, { opacity: skipFade }]}>
        <TouchableOpacity onPress={dismiss} hitSlop={14} style={styles.skipBtn}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* SILHOUETTE — bicep curl loop */}
      <View style={styles.illustration}>
        <Svg width={220} height={240} viewBox="0 0 220 240">
          {/* Soft floor shadow */}
          <Ellipse cx={110} cy={222} rx={50} ry={5} fill="#1a1a1a" opacity={0.7} />

          {/* Head */}
          <Circle cx={110} cy={42} r={18} fill="#2A2A2A" stroke={ACCENT} strokeWidth={1.5} />

          {/* Neck */}
          <Rect x={106} y={58} width={8} height={10} rx={3} fill="#2A2A2A" />

          {/* Torso — strong V-taper */}
          <Path
            d="M82 70 L138 70 L132 150 L88 150 Z"
            fill="#1F1F1F"
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />

          {/* Resting (left) arm — static, hangs straight */}
          {/* Upper arm */}
          <Rect x={80} y={78} width={9} height={42} rx={4} fill="#2A2A2A" stroke={ACCENT} strokeWidth={1} />
          {/* Forearm */}
          <Rect x={80} y={120} width={9} height={36} rx={4} fill="#2A2A2A" stroke={ACCENT} strokeWidth={1} />
          {/* Resting dumbbell */}
          <Rect x={72} y={156} width={25} height={6} rx={2} fill={ACCENT} />
          <Rect x={68} y={152} width={8} height={14} rx={2} fill="#fff" />
          <Rect x={93} y={152} width={8} height={14} rx={2} fill="#fff" />

          {/* Legs */}
          <Rect x={91} y={150} width={12} height={62} rx={4} fill="#1F1F1F" stroke={ACCENT} strokeWidth={1} />
          <Rect x={117} y={150} width={12} height={62} rx={4} fill="#1F1F1F" stroke={ACCENT} strokeWidth={1} />
          {/* Feet */}
          <Rect x={86} y={210} width={20} height={6} rx={2} fill="#2A2A2A" />
          <Rect x={114} y={210} width={20} height={6} rx={2} fill="#2A2A2A" />

          {/* ACTIVE (right) arm — animated bicep curl */}
          {/* Upper arm anchored at shoulder (135,78) — animated bulge */}
          <AnimatedSvgLine
            x1={135}
            y1={78}
            x2={148}
            y2={120}
            stroke={ACCENT}
            strokeWidth={Animated.multiply(bicepBulge, 9) as any}
            strokeLinecap="round"
          />
          {/* Forearm — animated to curl up to wristX/wristY */}
          <AnimatedSvgLine
            x1={148}
            y1={120}
            x2={wristX as any}
            y2={wristY as any}
            stroke="#fff"
            strokeWidth={8}
            strokeLinecap="round"
          />
        </Svg>

        {/* Active hand dumbbell — overlay because Animated rotate inside SVG is awkward */}
        <Animated.View
          style={[
            styles.activeDbWrap,
            {
              transform: [
                { translateX: Animated.subtract(wristX as any, new Animated.Value(20)) },
                { translateY: Animated.subtract(wristY as any, new Animated.Value(8)) },
                { rotate: dumbbellRot },
              ],
            },
          ]}
        >
          <View style={styles.dbBar} />
          <View style={[styles.dbPlate, { left: -4 }]} />
          <View style={[styles.dbPlate, { right: -4 }]} />
        </Animated.View>
      </View>

      {/* QUOTE CARD — fades in at 1.5s */}
      <Animated.View style={[styles.quoteWrap, { opacity: quoteFade }]}>
        <Text style={styles.quoteText}>"{quote}"</Text>
        {/* Gold underline that grows in */}
        <Animated.View
          style={[
            styles.accentBar,
            { transform: [{ scaleX: accentScale }] },
          ]}
        />
        {/* TRACKD logo */}
        <Text style={styles.logo}>TRACKD</Text>
      </Animated.View>
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
    backgroundColor: BG, // pure black
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  skipWrap: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    right: 20,
    zIndex: 10,
  },
  skipBtn: {
    minWidth: 76,
    minHeight: 44,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: 'rgba(28,28,30,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  illustration: {
    width: 220,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  activeDbWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
    width: 40,
    height: 16,
  },
  dbBar: {
    position: 'absolute',
    left: 6,
    top: 6,
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  dbPlate: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#fff',
  },

  quoteWrap: {
    alignItems: 'center',
    paddingHorizontal: 10,
    maxWidth: 360,
    marginTop: 8,
  },
  quoteText: {
    color: '#fff',
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  accentBar: {
    width: 88,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
    marginTop: 18,
  },
  logo: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 5,
    marginTop: 14,
  },
});
