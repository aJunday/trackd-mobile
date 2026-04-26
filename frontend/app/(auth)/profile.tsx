import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../_layout';

const ACCENT_COLOR = '#00D4FF';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
});
