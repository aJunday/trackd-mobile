/**
 * ExerciseOptionsMenu — bottom sheet shown when the user taps the
 * ... button on an active workout exercise card.
 *
 * Six actions: Add Note · Add Warm-up Sets · Update Rest Timer ·
 * Replace Exercise · Create Superset · Remove Exercise.
 *
 * All callbacks are optional — wire only the ones you support.
 */
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const ACCENT = '#F5A623';
const BG = '#0D0D0F';
const CARD = '#161618';
const BORDER = '#222';
const TEXT_MUTED = '#888';
const DANGER = '#FF4D4F';

const REST_OPTIONS = [60, 90, 120, 180, 300]; // seconds

export interface ExerciseOptionsCallbacks {
  onAddNote?: (note: string) => void;
  onAddWarmupSets?: () => void;
  onUpdateRestTimer?: (seconds: number) => void;
  onReplaceExercise?: () => void;
  onCreateSuperset?: () => void;
  onRemoveExercise?: () => void;
  onWhyExercise?: () => void;
}

interface Props extends ExerciseOptionsCallbacks {
  visible: boolean;
  exerciseName: string;
  currentRestSeconds?: number;
  currentNote?: string;
  onClose: () => void;
}

type ActiveSub = null | 'note' | 'rest';

const haptic = () => {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
};

export default function ExerciseOptionsMenu({
  visible,
  exerciseName,
  currentRestSeconds,
  currentNote,
  onClose,
  onAddNote,
  onAddWarmupSets,
  onUpdateRestTimer,
  onReplaceExercise,
  onCreateSuperset,
  onRemoveExercise,
  onWhyExercise,
}: Props) {
  const [activeSub, setActiveSub] = useState<ActiveSub>(null);
  const [noteText, setNoteText] = useState(currentNote || '');
  const [customRest, setCustomRest] = useState('');

  const close = () => {
    setActiveSub(null);
    setNoteText(currentNote || '');
    setCustomRest('');
    onClose();
  };

  const handleAction = (action: 'note' | 'warmup' | 'rest' | 'replace' | 'superset' | 'remove') => {
    haptic();
    switch (action) {
      case 'note':
        setActiveSub('note');
        return;
      case 'warmup':
        onAddWarmupSets?.();
        close();
        return;
      case 'rest':
        setActiveSub('rest');
        return;
      case 'replace':
        onReplaceExercise?.();
        close();
        return;
      case 'superset':
        onCreateSuperset?.();
        close();
        return;
      case 'remove':
        Alert.alert(
          'Remove exercise?',
          `Remove "${exerciseName}" from this workout? Your sets will be lost.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: () => {
                onRemoveExercise?.();
                close();
              },
            },
          ]
        );
        return;
    }
  };

  const saveNote = () => {
    onAddNote?.(noteText.trim());
    close();
  };

  const saveRest = (seconds: number) => {
    onUpdateRestTimer?.(seconds);
    close();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={close}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity activeOpacity={1} style={styles.backdropTouch} onPress={close} />

        <View style={styles.sheet}>
          {/* Drag indicator */}
          <View style={styles.handle} />

          <Text style={styles.title} numberOfLines={1}>
            {exerciseName}
          </Text>

          {/* MENU ROOT */}
          {activeSub === null && (
            <>
              {onWhyExercise && (
                <MenuRow
                  icon={<MaterialCommunityIcons name="flask-outline" size={20} color={ACCENT} />}
                  label="Why this exercise?"
                  sub="See the research behind this pick"
                  onPress={() => {
                    haptic();
                    onWhyExercise();
                    close();
                  }}
                />
              )}
              <MenuRow
                icon={<MaterialCommunityIcons name="note-edit-outline" size={20} color={ACCENT} />}
                label="Add Note"
                sub={currentNote ? 'Edit your note for this exercise' : 'Track form cues or how it felt'}
                onPress={() => handleAction('note')}
              />
              <MenuRow
                icon={<MaterialCommunityIcons name="fire" size={20} color={ACCENT} />}
                label="Add Warm-up Sets"
                sub="Adds 2 W sets above your working sets"
                onPress={() => handleAction('warmup')}
              />
              <MenuRow
                icon={<Ionicons name="timer-outline" size={20} color={ACCENT} />}
                label="Update Rest Timer"
                sub={
                  currentRestSeconds
                    ? `Currently ${formatRest(currentRestSeconds)}`
                    : 'Change rest time for this exercise'
                }
                onPress={() => handleAction('rest')}
              />
              <MenuRow
                icon={<MaterialCommunityIcons name="swap-horizontal" size={20} color={ACCENT} />}
                label="Replace Exercise"
                sub="Swap with another — keeps sets & reps"
                onPress={() => handleAction('replace')}
              />
              <MenuRow
                icon={<MaterialCommunityIcons name="link-variant" size={20} color={ACCENT} />}
                label="Create Superset"
                sub="Pair with the next exercise (no rest)"
                onPress={() => handleAction('superset')}
              />
              <MenuRow
                icon={<Ionicons name="trash-outline" size={20} color={DANGER} />}
                label="Remove Exercise"
                sub="Take this exercise out of today's workout"
                onPress={() => handleAction('remove')}
                danger
              />
            </>
          )}

          {/* NOTE SUB-SHEET */}
          {activeSub === 'note' && (
            <>
              <Text style={styles.subTitle}>Note for this session</Text>
              <TextInput
                style={styles.noteInput}
                value={noteText}
                onChangeText={setNoteText}
                placeholder="e.g. lower weight next time, RPE 8, paused at bottom..."
                placeholderTextColor="#555"
                multiline
                autoFocus
                maxLength={300}
              />
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, styles.btnDim]} onPress={() => setActiveSub(null)}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btn} onPress={saveNote}>
                  <Text style={styles.btnText}>Save Note</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* REST SUB-SHEET */}
          {activeSub === 'rest' && (
            <>
              <Text style={styles.subTitle}>Rest time for this exercise</Text>
              <View style={styles.restGrid}>
                {REST_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.restChip, currentRestSeconds === s && styles.restChipActive]}
                    onPress={() => saveRest(s)}
                  >
                    <Text style={[styles.restChipText, currentRestSeconds === s && { color: '#000' }]}>
                      {formatRest(s)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.subTitle}>Or custom (seconds)</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={styles.customInput}
                  value={customRest}
                  onChangeText={setCustomRest}
                  keyboardType="numeric"
                  placeholder="e.g. 75"
                  placeholderTextColor="#555"
                />
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => {
                    const v = parseInt(customRest, 10);
                    if (!v || v < 5 || v > 600) {
                      Alert.alert('Invalid', 'Enter 5-600 seconds.');
                      return;
                    }
                    saveRest(v);
                  }}
                >
                  <Text style={styles.btnText}>Set</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.btnRow, { marginTop: 6 }]}>
                <TouchableOpacity style={[styles.btn, styles.btnDim]} onPress={() => setActiveSub(null)}>
                  <Text style={[styles.btnText, { color: '#fff' }]}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  sub,
  onPress,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  sub: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowIconWrap}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, danger && { color: DANGER }]}>{label}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={TEXT_MUTED} />
    </TouchableOpacity>
  );
}

function formatRest(s: number): string {
  if (s < 60) return `${s}s`;
  if (s % 60 === 0) return `${s / 60}min`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  backdropTouch: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 32 : 18,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#333',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 12,
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: CARD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rowSub: { color: TEXT_MUTED, fontSize: 11, marginTop: 2 },

  subTitle: {
    color: TEXT_MUTED,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  noteInput: {
    color: '#fff',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  btn: {
    flex: 1,
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDim: { backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  btnText: { color: '#000', fontWeight: '800', fontSize: 14 },

  restGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  restChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 70,
    alignItems: 'center',
  },
  restChipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  restChipText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  customInput: {
    flex: 1,
    color: '#fff',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
  },
});
