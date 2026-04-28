/**
 * WeightLogSection — allows the user to log today's bodyweight and view
 * a small line graph of their weight over time. Added to the Profile screen.
 * Uses POST /api/measurements and GET /api/measurements/weight?days=90.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import Svg, { Polyline, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { authFetch } from '../utils/authFetch';

const ACCENT = '#F5A623';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const LINE = '#F5A623';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

type WeightPoint = { date: string; weight_kg: number };

const haptic = (t: 'light' | 'success' = 'light') => {
  if (Platform.OS === 'web') return;
  if (t === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function WeightLogSection() {
  const [history, setHistory] = useState<WeightPoint[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${BACKEND_URL}/api/measurements/weight?days=90`);
      if (res.ok) {
        const json = await res.json();
        // Backend returns desc-sorted; flip to asc for chart
        const pts: WeightPoint[] = (json.weights || [])
          .filter((w: any) => w && typeof w.weight_kg === 'number')
          .map((w: any) => ({
            date: String(w.date),
            weight_kg: Number(w.weight_kg),
          }))
          .sort((a: WeightPoint, b: WeightPoint) => a.date.localeCompare(b.date));
        setHistory(pts);
      }
    } catch (e) {
      console.warn('Weight load failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logWeight = async () => {
    const kg = parseFloat(input);
    if (!kg || kg < 20 || kg > 400) {
      Alert.alert('Invalid weight', 'Enter a weight between 20 and 400 kg.');
      return;
    }
    setSaving(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/api/measurements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weight_kg: kg }),
      });
      if (res.ok) {
        haptic('success');
        setInput('');
        await load();
      } else {
        Alert.alert('Error', 'Could not save weight.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => {
    if (history.length === 0) return null;
    const latest = history[history.length - 1].weight_kg;
    const earliest = history[0].weight_kg;
    const delta = latest - earliest;
    return { latest, delta, points: history.length };
  }, [history]);

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Weight Log</Text>
        {stats && (
          <View style={styles.statPill}>
            <Text style={styles.statPillVal}>{stats.latest.toFixed(1)} kg</Text>
            {stats.points > 1 ? (
              <Text
                style={[
                  styles.statPillDelta,
                  { color: stats.delta > 0 ? '#FF6B6B' : stats.delta < 0 ? '#06D6A0' : TEXT_MUTED },
                ]}
              >
                {stats.delta > 0 ? '+' : ''}
                {stats.delta.toFixed(1)} kg
              </Text>
            ) : null}
          </View>
        )}
      </View>

      <View style={styles.card}>
        {loading ? (
          <View style={{ padding: 28, alignItems: 'center' }}>
            <ActivityIndicator color={ACCENT} />
          </View>
        ) : history.length === 0 ? (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <MaterialCommunityIcons name="scale-bathroom" size={32} color={TEXT_MUTED} />
            <Text style={styles.emptyTxt}>No weight logged yet</Text>
            <Text style={styles.emptySub}>Log your first weight below to start tracking.</Text>
          </View>
        ) : (
          <WeightChart points={history} />
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Enter today's weight"
            placeholderTextColor="#555"
            value={input}
            onChangeText={setInput}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Text style={styles.unit}>kg</Text>
          <TouchableOpacity
            style={[styles.logBtn, (!input || saving) && { opacity: 0.5 }]}
            onPress={logWeight}
            disabled={!input || saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <>
                <Ionicons name="add" size={18} color="#000" />
                <Text style={styles.logBtnText}>Log</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** Simple SVG line chart (no external chart lib). */
function WeightChart({ points }: { points: WeightPoint[] }) {
  const W = 320;
  const H = 140;
  const PAD_X = 36;
  const PAD_Y = 18;

  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.weight_kg);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = Math.max(0.5, maxY - minY); // avoid 0 range
  const yPad = rangeY * 0.15;
  const yMin = minY - yPad;
  const yMax = maxY + yPad;

  const toX = (i: number) => {
    if (xs.length === 1) return W / 2;
    return PAD_X + (i / (xs.length - 1)) * (W - PAD_X - 10);
  };
  const toY = (v: number) => {
    return PAD_Y + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD_Y * 2);
  };

  const polyPoints = points.map((p, i) => `${toX(i)},${toY(p.weight_kg)}`).join(' ');

  // Y-axis ticks (min, mid, max)
  const yTicks = [yMax, (yMax + yMin) / 2, yMin];

  return (
    <View style={{ alignItems: 'center', paddingVertical: 8 }}>
      <Svg width={W} height={H}>
        {/* grid lines */}
        {yTicks.map((t, i) => (
          <SvgLine
            key={`grid-${i}`}
            x1={PAD_X}
            y1={toY(t)}
            x2={W - 10}
            y2={toY(t)}
            stroke="#2A2A2A"
            strokeWidth={1}
          />
        ))}
        {/* y labels */}
        {yTicks.map((t, i) => (
          <SvgText
            key={`lbl-${i}`}
            x={6}
            y={toY(t) + 4}
            fill={TEXT_MUTED}
            fontSize={9}
          >
            {t.toFixed(1)}
          </SvgText>
        ))}
        {/* line */}
        {points.length > 1 && (
          <Polyline
            points={polyPoints}
            fill="none"
            stroke={LINE}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* dots */}
        {points.map((p, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(p.weight_kg)} r={3} fill={LINE} />
        ))}
      </Svg>
      <Text style={styles.xAxisLabel}>
        Last {points.length} entries · {formatShort(points[0].date)} → {formatShort(points[points.length - 1].date)}
      </Text>
    </View>
  );
}

function formatShort(d: string) {
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return d.slice(0, 10);
  }
}

const styles = StyleSheet.create({
  section: { marginTop: 16, paddingHorizontal: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    borderWidth: 1,
    borderColor: '#7A5510',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statPillVal: { color: ACCENT, fontSize: 12, fontWeight: '800' },
  statPillDelta: { fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    padding: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#0D0D0F',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    color: '#fff',
    fontSize: 15,
  },
  unit: { color: TEXT_MUTED, fontSize: 13, fontWeight: '600' },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logBtnText: { color: '#000', fontSize: 14, fontWeight: '800' },
  emptyTxt: { color: '#ccc', fontSize: 14, fontWeight: '600', marginTop: 8 },
  emptySub: { color: TEXT_MUTED, fontSize: 12, marginTop: 4, textAlign: 'center' },
  xAxisLabel: {
    color: TEXT_MUTED,
    fontSize: 10,
    marginTop: 6,
  },
});
