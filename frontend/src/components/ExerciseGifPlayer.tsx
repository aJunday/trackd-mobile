/**
 * ExerciseGifPlayer — Alternates between two static frames at a fixed interval to
 * simulate a GIF demo. Frames come from the free-exercise-db dataset.
 *
 * If only one frame is available, it shows the static image.
 * If frames is empty/null, it renders nothing — caller should show YouTube fallback.
 */
import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';

type Props = {
  frames: string[];
  height?: number;
  intervalMs?: number;
};

const ExerciseGifPlayer: React.FC<Props> = ({ frames, height = 240, intervalMs = 700 }) => {
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState<boolean[]>([]);

  useEffect(() => {
    if (!frames || frames.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % frames.length), intervalMs);
    return () => clearInterval(t);
  }, [frames, intervalMs]);

  if (!frames || frames.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}>
      {!loaded[idx] && (
        <View style={[StyleSheet.absoluteFill, styles.spinner]}>
          <ActivityIndicator color="#F5A623" />
        </View>
      )}
      <Image
        source={{ uri: frames[idx] }}
        style={styles.image}
        resizeMode="contain"
        onLoad={() => {
          setLoaded((prev) => {
            const next = [...prev];
            next[idx] = true;
            return next;
          });
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#0F0F0F',
    borderRadius: 14,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0F0F',
  },
});

export default ExerciseGifPlayer;
