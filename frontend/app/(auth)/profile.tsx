import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';
import { recommendSplit, getAllSplits, getDayName, DaysPerWeek, Goal } from '../../src/data/splits';
import WeightLogSection from '../../src/components/WeightLogSection';

const ACCENT_COLOR = '#00D4FF';
const GOLD = '#F5A623';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ProfileScreen() {
  const { user, sessionToken, checkAuth, logout } = useAuth() as any;
  const router = useRouter();
  const [showSplitPicker, setShowSplitPicker] = useState(false);
  const [savingSplit, setSavingSplit] = useState(false);
  const [pickedDays, setPickedDays] = useState<DaysPerWeek | null>(
    (user?.training_days_per_week as DaysPerWeek) || null
  );
  const [pickedSplit, setPickedSplit] = useState<string | null>(user?.split_id || null);

  const saveSplit = async () => {
    if (!pickedDays || !pickedSplit) {
      Alert.alert('Pick both', 'Please select days/week and a split.');
      return;
    }
    setSavingSplit(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/users/split`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          training_days_per_week: pickedDays,
          split_id: pickedSplit,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      await checkAuth();
      setShowSplitPicker(false);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save');
    } finally {
      setSavingSplit(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  const MenuItem = ({
    icon,
    title,
    subtitle,
    onPress,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.menuItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
        <Ionicons
          name={icon}
          size={22}
          color={danger ? '#FF4444' : ACCENT_COLOR}
        />
      </View>
      <View style={styles.menuContent}>
        <Text style={[styles.menuTitle, danger && styles.menuTitleDanger]}>
          {title}
        </Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#444444" />
    </TouchableOpacity>
  );

  // Get goal type label
  const getGoalTypeLabel = () => {
    switch (user?.goal_type) {
      case 'cutting': return '🔥 Cutting';
      case 'bulking': return '💪 Bulking';
      default: return '⚖️ Maintenance';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <Ionicons name="person" size={48} color={ACCENT_COLOR} />
          </View>
          <Text style={styles.userName}>{user?.name || 'Athlete'}</Text>
          <Text style={styles.userEmail}>{user?.email || ''}</Text>
        </View>

        {/* Goals Summary Card */}
        <TouchableOpacity 
          style={styles.statsCard}
          onPress={() => router.push('/(auth)/goals')}
          activeOpacity={0.8}
        >
          <View style={styles.statsHeader}>
            <Text style={styles.statsTitle}>Daily Goals</Text>
            <View style={styles.goalTypeBadge}>
              <Text style={styles.goalTypeText}>{getGoalTypeLabel()}</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.goal_calories || 2200}</Text>
              <Text style={styles.statLabel}>Calories</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.goal_protein || 150}g</Text>
              <Text style={styles.statLabel}>Protein</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.goal_carbs || 250}g</Text>
              <Text style={styles.statLabel}>Carbs</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{user?.goal_fats || 70}g</Text>
              <Text style={styles.statLabel}>Fats</Text>
            </View>
          </View>
          <View style={styles.editHint}>
            <Ionicons name="pencil" size={14} color={ACCENT_COLOR} />
            <Text style={styles.editHintText}>Tap to edit goals</Text>
          </View>
        </TouchableOpacity>

        {/* Menu Sections */}
        <WeightLogSection />

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Goals & Targets</Text>
          <MenuItem
            icon="fitness-outline"
            title="Goals & Targets"
            subtitle="Set calories, macros, and presets"
            onPress={() => router.push('/(auth)/goals')}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <MenuItem
            icon="person-outline"
            title="Edit Profile"
            subtitle="Update your personal information"
          />
          <MenuItem
            icon="calendar-outline"
            title="Training Schedule"
            subtitle={
              user?.training_days_per_week
                ? `${user.training_days_per_week} days/week · ${user.split_id || 'auto'}`
                : 'Pick days/week + split'
            }
            onPress={() => setShowSplitPicker(true)}
          />
          <MenuItem
            icon="notifications-outline"
            title="Notifications"
            subtitle="Manage your alerts"
          />
          <MenuItem
            icon="color-palette-outline"
            title="Appearance"
            subtitle="Dark mode is always on"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Data</Text>
          <MenuItem
            icon="cloud-download-outline"
            title="Export Data"
            subtitle="Download your workout history"
          />
          <MenuItem
            icon="sync-outline"
            title="Sync Settings"
            subtitle="Configure data sync"
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Support</Text>
          <MenuItem
            icon="help-circle-outline"
            title="Help Center"
          />
          <MenuItem
            icon="chatbubble-outline"
            title="Contact Us"
          />
          <MenuItem
            icon="star-outline"
            title="Rate App"
          />
        </View>

        <View style={styles.menuSection}>
          <MenuItem
            icon="log-out-outline"
            title="Logout"
            onPress={handleLogout}
            danger
          />
        </View>

        {/* App Version */}
        <Text style={styles.version}>TRACKD v1.0.0</Text>
      </ScrollView>

      {/* Split Picker Modal */}
      <Modal
        visible={showSplitPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSplitPicker(false)}
      >
        <SafeAreaView style={[styles.container]}>
          <View style={styles.spHeader}>
            <Text style={styles.spTitle}>Training Schedule</Text>
            <TouchableOpacity onPress={() => setShowSplitPicker(false)}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
            <Text style={styles.spLabel}>How many days per week?</Text>
            <View style={styles.spDaysRow}>
              {[2, 3, 4, 5, 6].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.spDayCard, pickedDays === d && styles.spDayCardActive]}
                  onPress={() => {
                    setPickedDays(d as DaysPerWeek);
                    if (user?.goal_type) {
                      const rec = recommendSplit(d as DaysPerWeek, user.goal_type as Goal);
                      setPickedSplit(rec.id);
                    }
                  }}
                >
                  <Text style={[styles.spDayNum, pickedDays === d && { color: GOLD }]}>{d}</Text>
                  <Text style={styles.spDayLabel}>days</Text>
                </TouchableOpacity>
              ))}
            </View>

            {pickedDays && user?.goal_type && (() => {
              const recommended = recommendSplit(pickedDays, user.goal_type as Goal);
              const all = getAllSplits(pickedDays);
              return (
                <View style={{ marginTop: 18 }}>
                  <Text style={styles.spLabel}>Pick your split</Text>
                  {all.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.spSplitCard,
                        pickedSplit === s.id && styles.spSplitCardActive,
                      ]}
                      onPress={() => setPickedSplit(s.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={styles.spSplitName}>{s.name}</Text>
                        {s.id === recommended.id && (
                          <View style={styles.spStarPill}>
                            <Ionicons name="star" size={10} color="#000" />
                            <Text style={styles.spStarText}>BEST</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.spSplitReasoning}>{s.reasoning}</Text>
                      <View style={styles.spWeekRow}>
                        {s.schedule.map((day, i) => (
                          <View
                            key={i}
                            style={[
                              styles.spDayDot,
                              day.is_rest ? styles.spDayDotRest : styles.spDayDotActive,
                            ]}
                          >
                            <Text style={styles.spDayDotText}>{getDayName(i).slice(0, 1)}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={styles.spScheduleHint}>
                        Train: {s.schedule.filter(d => !d.is_rest).map(d => getDayName(d.day_of_week)).join(', ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            <TouchableOpacity
              style={[styles.spSaveBtn, (savingSplit || !pickedDays || !pickedSplit) && { opacity: 0.5 }]}
              onPress={saveSplit}
              disabled={savingSplit || !pickedDays || !pickedSplit}
            >
              <Text style={styles.spSaveText}>{savingSplit ? 'Saving…' : 'Save Schedule'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userEmail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888888',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  goalTypeBadge: {
    backgroundColor: 'rgba(0, 212, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  goalTypeText: {
    color: ACCENT_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  editHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  editHintText: {
    color: ACCENT_COLOR,
    fontSize: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT_COLOR,
  },
  statLabel: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuIconDanger: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  menuTitleDanger: {
    color: '#FF4444',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: '#444444',
    marginTop: 20,
  },
  spHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  spTitle: { color: '#fff', fontSize: 19, fontWeight: '700' },
  spLabel: { color: GOLD, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },
  spDaysRow: { flexDirection: 'row', gap: 8 },
  spDayCard: {
    flex: 1,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  spDayCardActive: { borderColor: GOLD, backgroundColor: 'rgba(245,166,35,0.10)' },
  spDayNum: { color: '#fff', fontSize: 22, fontWeight: '800' },
  spDayLabel: { color: '#888', fontSize: 11, marginTop: 2, fontWeight: '600' },
  spSplitCard: {
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  spSplitCardActive: { borderColor: GOLD, backgroundColor: 'rgba(245,166,35,0.06)' },
  spSplitName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  spStarPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: GOLD,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  spStarText: { color: '#000', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  spSplitReasoning: { color: '#aaa', fontSize: 12, marginTop: 6, lineHeight: 17 },
  spWeekRow: { flexDirection: 'row', gap: 4, marginTop: 10 },
  spDayDot: { flex: 1, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
  spDayDotActive: { backgroundColor: GOLD },
  spDayDotRest: { backgroundColor: '#333' },
  spDayDotText: { color: '#000', fontSize: 11, fontWeight: '800' },
  spScheduleHint: { color: GOLD, fontSize: 11, marginTop: 8, fontWeight: '600' },
  spSaveBtn: {
    backgroundColor: GOLD,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  spSaveText: { color: '#000', fontSize: 15, fontWeight: '800' },
});
