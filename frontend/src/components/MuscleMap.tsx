/**
 * MuscleMap — wrapper around react-native-body-highlighter
 *
 * Shows front + back body silhouettes with primary muscles in solid gold (pulsing)
 * and secondary muscles in faded gold.
 *
 * Usage:
 *   <MuscleMap primary={[{slug:'chest', intensity:2}]} secondary={[{slug:'triceps', intensity:1}]} />
 *
 * For thumbnails, set size="thumb" — disables animation, smaller.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Body from 'react-native-body-highlighter';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

export type MuscleEntry = { slug: string; intensity: number };

type Props = {
  primary?: MuscleEntry[];
  secondary?: MuscleEntry[];
  size?: 'large' | 'medium' | 'thumb';
  showLabels?: boolean;
};

const COLORS = {
  primaryGold: '#F5A623',
  secondaryGold: '#7A5510',
  bg: '#1A1A1A',
  base: '#2A2A2A',
  border: '#333',
  textDim: '#888',
};

const sizeMap = {
  large: 220,
  medium: 150,
  thumb: 56,
};

const MuscleMap: React.FC<Props> = ({
  primary = [],
  secondary = [],
  size = 'medium',
  showLabels = false,
}) => {
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (size === 'thumb') return;
    pulse.value = withRepeat(
      withTiming(0.55, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [size, pulse]);

  // Combine primary (intensity 2 → primaryGold) + secondary (intensity 1 → secondaryGold)
  // We pass two color stops via the colors prop.
  const data = [
    ...primary.map((p) => ({ slug: p.slug, intensity: 2 })),
    ...secondary.map((s) => ({ slug: s.slug, intensity: 1 })),
  ];

  const dimension = sizeMap[size];
  const scale = dimension / 200;

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  if (data.length === 0) {
    return (
      <View style={[styles.container, { width: dimension * 2 + 16, height: dimension * 1.5 }]}>
        <Text style={styles.emptyText}>No muscle data</Text>
      </View>
    );
  }

  // Build body color set: dim base, secondary, primary
  const colors = [COLORS.secondaryGold, COLORS.primaryGold];

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.bodyWrap}>
          {/* Pulsing primary layer */}
          {size !== 'thumb' && primary.length > 0 && (
            <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
              <Body
                data={primary.map((p) => ({ slug: p.slug, intensity: 2 }))}
                gender="male"
                side="front"
                scale={scale}
                colors={[COLORS.primaryGold, COLORS.primaryGold]}
                border={COLORS.border}
              />
            </Animated.View>
          )}
          {/* Static secondary + base */}
          <Body
            data={data}
            gender="male"
            side="front"
            scale={scale}
            colors={colors}
            border={COLORS.border}
          />
          {showLabels && <Text style={styles.label}>Front</Text>}
        </View>
        <View style={styles.bodyWrap}>
          {size !== 'thumb' && primary.length > 0 && (
            <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
              <Body
                data={primary.map((p) => ({ slug: p.slug, intensity: 2 }))}
                gender="male"
                side="back"
                scale={scale}
                colors={[COLORS.primaryGold, COLORS.primaryGold]}
                border={COLORS.border}
              />
            </Animated.View>
          )}
          <Body
            data={data}
            gender="male"
            side="back"
            scale={scale}
            colors={colors}
            border={COLORS.border}
          />
          {showLabels && <Text style={styles.label}>Back</Text>}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  bodyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: COLORS.textDim,
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  emptyText: {
    color: COLORS.textDim,
    fontSize: 12,
  },
});

export default MuscleMap;
