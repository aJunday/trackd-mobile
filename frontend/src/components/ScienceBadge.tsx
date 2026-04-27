/**
 * ScienceBadge — small "Science-backed" pill that opens a modal showing
 * which research papers back this program/template.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RESEARCH, ResearchKey } from '../data/research';

const COLORS = {
  gold: '#F5A623',
  goldDim: '#7A5510',
  bg: '#0A0A0A',
  card: '#1A1A1A',
  border: '#2A2A2A',
  text: '#F5F5F5',
  textDim: '#888',
};

type Props = {
  refKeys: ResearchKey[];
  size?: 'small' | 'medium';
};

const ScienceBadge: React.FC<Props> = ({ refKeys, size = 'small' }) => {
  const [open, setOpen] = useState(false);
  if (!refKeys || refKeys.length === 0) return null;

  const refs = refKeys.map((k) => RESEARCH[k]).filter(Boolean);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.badge, size === 'medium' && styles.badgeMedium]}
        activeOpacity={0.7}
      >
        <Ionicons name="flask" size={size === 'medium' ? 14 : 12} color={COLORS.gold} />
        <Text style={[styles.badgeText, size === 'medium' && styles.badgeTextMedium]}>
          Science-backed
        </Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Research backing this</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalContent}>
              <Text style={styles.intro}>
                Every part of this program is grounded in peer-reviewed research. Tap any paper for a one-line summary.
              </Text>
              {refs.map((r) => (
                <View key={r.key} style={styles.paperCard}>
                  <Text style={styles.paperTitle}>{r.title}</Text>
                  <Text style={styles.paperMeta}>
                    {r.authors} · {r.journal} · {r.year}
                  </Text>
                  <Text style={styles.paperTakeaway}>{r.takeaway}</Text>
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `https://scholar.google.com/scholar?q=${encodeURIComponent(r.title)}`
                      )
                    }
                    style={styles.linkBtn}
                  >
                    <Ionicons name="search" size={12} color={COLORS.gold} />
                    <Text style={styles.linkText}>Find on Google Scholar</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 166, 35, 0.10)',
    borderWidth: 1,
    borderColor: COLORS.goldDim,
    alignSelf: 'flex-start',
  },
  badgeMedium: { paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  badgeTextMedium: { fontSize: 12 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 16 },
  intro: { color: COLORS.textDim, fontSize: 13, lineHeight: 18, marginBottom: 16 },
  paperCard: {
    backgroundColor: COLORS.card,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  paperTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700', marginBottom: 4, lineHeight: 18 },
  paperMeta: { color: COLORS.gold, fontSize: 11, marginBottom: 6, fontWeight: '500' },
  paperTakeaway: { color: COLORS.textDim, fontSize: 12, lineHeight: 16, fontStyle: 'italic' },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  linkText: { color: COLORS.gold, fontSize: 11, fontWeight: '600' },
});

export default ScienceBadge;
