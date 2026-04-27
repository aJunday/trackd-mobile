/**
 * CoachCardsSection — AI Nutrition Coach insights for the dashboard.
 *
 * Fetches /api/coach/insights and renders each insight as a styled card with:
 *   - Severity-based color scheme (warn / info / celebrate / success)
 *   - Title + message
 *   - Expandable "Why" (science citation) + suggestions
 *   - Snooze button (1 day default, 7 days for weekly review)
 *
 * Special rendering for type='weekly_review' which has rich data.
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

// ---- Types ----
export type Insight = {
  id: string;
  type: string;
  priority: number;
  severity: 'warn' | 'info' | 'success' | 'celebrate';
  title: string;
  message: string;
  science?: string;
  data?: Record<string, any>;
  suggestions?: { title: string; body: string }[];
};

const COLORS = {
  bg: '#0A0A0A',
  card: '#1A1A1A',
  border: '#2A2A2A',
  text: '#F5F5F5',
  textDim: '#888',
  gold: '#F5A623',
  goldDim: '#7A5510',
  warn: '#FF8C42',
  info: '#5AC8FA',
  success: '#4ED964',
  celebrate: '#F5A623',
};

const severityStyles = {
  warn: { color: COLORS.warn, icon: 'warning' as const },
  info: { color: COLORS.info, icon: 'information-circle' as const },
  success: { color: COLORS.success, icon: 'checkmark-circle' as const },
  celebrate: { color: COLORS.celebrate, icon: 'sparkles' as const },
};

// ---- Single Card ----
const InsightCard: React.FC<{
  insight: Insight;
  onSnooze: (id: string) => void;
}> = ({ insight, onSnooze }) => {
  const [expanded, setExpanded] = useState(false);
  const sev = severityStyles[insight.severity] || severityStyles.info;

  // Special rendering for weekly review
  if (insight.type === 'weekly_review' && insight.data) {
    const d = insight.data as any;
    return (
      <View style={[styles.card, { borderLeftColor: COLORS.gold, borderLeftWidth: 4 }]}>
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardIconWrap}>
            <Ionicons name="calendar" size={18} color={COLORS.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>WEEKLY REVIEW</Text>
            <Text style={styles.cardTitle}>{insight.title}</Text>
          </View>
          <TouchableOpacity onPress={() => onSnooze(insight.id)} style={styles.snoozeBtn}>
            <Ionicons name="close" size={16} color={COLORS.textDim} />
          </TouchableOpacity>
        </View>
        <Text style={styles.cardMessage}>{insight.message}</Text>
        <View style={styles.statsRow}>
          {typeof d.avg_calories === 'number' && (
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{Math.round(d.avg_calories)}</Text>
              <Text style={styles.statLabel}>avg kcal/day</Text>
            </View>
          )}
          {typeof d.avg_protein === 'number' && (
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{Math.round(d.avg_protein)}g</Text>
              <Text style={styles.statLabel}>avg protein</Text>
            </View>
          )}
          {typeof d.weight_change_kg === 'number' && (
            <View style={styles.statBlock}>
              <Text
                style={[
                  styles.statValue,
                  d.weight_change_kg > 0
                    ? { color: COLORS.success }
                    : d.weight_change_kg < 0
                      ? { color: COLORS.warn }
                      : null,
                ]}
              >
                {d.weight_change_kg > 0 ? '+' : ''}
                {d.weight_change_kg.toFixed(1)}kg
              </Text>
              <Text style={styles.statLabel}>weight</Text>
            </View>
          )}
          {typeof d.workouts_done === 'number' && (
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>{d.workouts_done}</Text>
              <Text style={styles.statLabel}>workouts</Text>
            </View>
          )}
        </View>
        {!!insight.science && (
          <Text style={styles.scienceLine}>
            <Ionicons name="flask" size={11} color={COLORS.goldDim} /> {insight.science}
          </Text>
        )}
      </View>
    );
  }

  // Generic rendering for all other types
  return (
    <View style={[styles.card, { borderLeftColor: sev.color, borderLeftWidth: 4 }]}>
      <View style={styles.cardHeaderRow}>
        <View style={[styles.cardIconWrap, { backgroundColor: `${sev.color}1A` }]}>
          <Ionicons name={sev.icon} size={18} color={sev.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardLabel, { color: sev.color }]}>
            {insight.type.replace(/_/g, ' ').toUpperCase()}
          </Text>
          <Text style={styles.cardTitle}>{insight.title}</Text>
        </View>
        <TouchableOpacity onPress={() => onSnooze(insight.id)} style={styles.snoozeBtn}>
          <Ionicons name="close" size={16} color={COLORS.textDim} />
        </TouchableOpacity>
      </View>
      <Text style={styles.cardMessage}>{insight.message}</Text>

      {(insight.suggestions?.length ?? 0) > 0 && (
        <TouchableOpacity
          style={styles.expandBtn}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.expandText}>
            {expanded ? 'Hide details' : `Show ${insight.suggestions!.length} suggestion${insight.suggestions!.length !== 1 ? 's' : ''}`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={COLORS.gold}
          />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={styles.suggestionsBlock}>
          {insight.suggestions?.map((s, i) => (
            <View key={i} style={styles.suggestionItem}>
              <View style={styles.suggestionDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.suggestionTitle}>{s.title}</Text>
                <Text style={styles.suggestionBody}>{s.body}</Text>
              </View>
            </View>
          ))}
          {!!insight.science && (
            <View style={styles.scienceCallout}>
              <Ionicons name="flask" size={12} color={COLORS.gold} />
              <Text style={styles.scienceText}>{insight.science}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

// ---- Section ----
type Props = {
  sessionToken: string | null;
};

const CoachCardsSection: React.FC<Props> = ({ sessionToken }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    if (!sessionToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/coach/insights`, {
        headers: { Authorization: `Bearer ${sessionToken}` },
      });
      const j = await res.json();
      setInsights(j.insights || []);
    } catch (e) {
      console.warn('coach insights fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleSnooze = async (id: string) => {
    // Optimistic remove
    setInsights((prev) => prev.filter((i) => i.id !== id));
    try {
      // 24h for normal insights, 7 days for weekly review
      const ins = insights.find((i) => i.id === id);
      const hours = ins?.type === 'weekly_review' ? 168 : 24;
      await fetch(`${BACKEND_URL}/api/coach/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ insight_id: id, hours }),
      });
    } catch (e) {
      // Roll back on failure
      fetchInsights();
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={COLORS.gold} />
      </View>
    );
  }
  if (insights.length === 0) return null;

  return (
    <View style={{ marginTop: 24 }}>
      <View style={styles.sectionHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="sparkles" size={14} color={COLORS.gold} />
          <Text style={styles.section}>AI Coach</Text>
        </View>
        <Text style={styles.sectionMeta}>{insights.length} insight{insights.length !== 1 ? 's' : ''}</Text>
      </View>
      {insights.map((ins) => (
        <InsightCard key={ins.id} insight={ins} onSnooze={handleSnooze} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingWrap: { paddingVertical: 16, alignItems: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  section: { color: COLORS.text, fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  sectionMeta: { color: COLORS.textDim, fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  cardIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { color: COLORS.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  snoozeBtn: { padding: 4 },
  cardMessage: { color: COLORS.textDim, fontSize: 13, lineHeight: 18, marginTop: 4 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statBlock: { minWidth: 70 },
  statValue: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  statLabel: { color: COLORS.textDim, fontSize: 10, marginTop: 2, fontWeight: '600' },
  scienceLine: {
    color: COLORS.textDim,
    fontSize: 11,
    fontStyle: 'italic',
    lineHeight: 15,
    marginTop: 10,
  },
  expandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
  },
  expandText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  suggestionsBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  suggestionDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: COLORS.gold,
    marginTop: 7,
  },
  suggestionTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  suggestionBody: { color: COLORS.textDim, fontSize: 12, lineHeight: 17, marginTop: 2 },
  scienceCallout: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(245,166,35,0.06)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.2)',
    marginTop: 6,
  },
  scienceText: {
    color: COLORS.text,
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
    fontStyle: 'italic',
  },
});

export default CoachCardsSection;
