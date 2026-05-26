import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useAuth } from '../_layout';
import DailyWarningIntro from '../../src/components/DailyWarningIntro';
import ActiveWorkoutBanner from '../../src/components/ActiveWorkoutBanner';
import { WorkoutProvider } from '../../src/context/WorkoutContext';

const ACCENT = '#F5A623';
const TAB_BG = 'rgba(10,10,10,0.94)';
const INACTIVE = '#8E8E93';

function TabIcon({
  name,
  set,
  color,
  size,
  focused,
}: {
  name: any;
  set: 'ion' | 'mc';
  color: string;
  size: number;
  focused: boolean;
}) {
  const Icon = set === 'mc' ? MaterialCommunityIcons : Ionicons;
  return (
    <View style={styles.iconWrap}>
      <Icon name={name} size={size} color={color} />
      <View
        style={[
          styles.dot,
          { opacity: focused ? 1 : 0, backgroundColor: ACCENT },
        ]}
      />
    </View>
  );
}

export default function AuthLayout() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <WorkoutProvider>
      <View style={{ flex: 1, backgroundColor: '#0D0D0F' }}>
        <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: '#2C2C2E',
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 96 : 78,
          paddingBottom: Platform.OS === 'ios' ? 32 : 14,
          paddingTop: 12,
          // subtle frosted-glass shadow above the bar
          shadowColor: '#000',
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
          elevation: 12,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="ion" name={focused ? 'home' : 'home-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Workout',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="mc" name="dumbbell" color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="programs"
        options={{
          title: 'Programs',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="ion" name={focused ? 'trophy' : 'trophy-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="kitchen"
        options={{
          title: 'Kitchen',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="mc" name={focused ? 'silverware-fork-knife' : 'silverware-fork-knife'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="ion" name={focused ? 'time' : 'time-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon set="ion" name={focused ? 'person' : 'person-outline'} color={color} size={size} focused={focused} />
          ),
        }}
      />
      {/* Hidden screens */}
      <Tabs.Screen name="goals" options={{ href: null }} />
      <Tabs.Screen name="log-meal" options={{ href: null }} />
      <Tabs.Screen name="pantry" options={{ href: null }} />
      <Tabs.Screen name="scanner" options={{ href: null }} />
      <Tabs.Screen name="add-pantry-item" options={{ href: null }} />
      <Tabs.Screen name="ai-chef" options={{ href: null }} />
      <Tabs.Screen name="meal-scanner" options={{ href: null }} />
      <Tabs.Screen name="exercise-detail" options={{ href: null }} />
      <Tabs.Screen name="indian-foods" options={{ href: null }} />
      <Tabs.Screen name="shopping-list" options={{ href: null }} />
    </Tabs>
        <ActiveWorkoutBanner />
        <DailyWarningIntro onDone={() => {}} />
      </View>
    </WorkoutProvider>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 32 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
});
