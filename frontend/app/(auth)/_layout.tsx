import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import { useAuth } from '../_layout';

const ACCENT = '#F5A623';
const TAB_BG = '#0A0A0A';
const INACTIVE = '#666';

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
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: TAB_BG,
          borderTopColor: '#1A1A1A',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 92 : 72,
          paddingBottom: Platform.OS === 'ios' ? 32 : 12,
          paddingTop: 10,
        },
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', marginTop: 2 },
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
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: { alignItems: 'center', justifyContent: 'center', height: 32 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4 },
});
