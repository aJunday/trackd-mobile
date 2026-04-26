import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_COLOR = '#F5A623';

export default function LoginScreen() {
  const { login, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo/Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Ionicons name="flash" size={56} color={ACCENT_COLOR} />
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title}>TRACKD</Text>
        <View style={styles.goldLine} />
        <Text style={styles.subtitle}>Track everything. Gain everything.</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>
          Log every rep.
          {"\n"}Scan every meal.
          {"\n"}Built on real science.
        </Text>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <View style={styles.feature}>
            <Ionicons name="barbell-outline" size={24} color={ACCENT_COLOR} />
            <Text style={styles.featureText}>Strong-style Workout Logger</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="flame-outline" size={24} color={ACCENT_COLOR} />
            <Text style={styles.featureText}>Smart Macro & TDEE Tracking</Text>
          </View>
          <View style={styles.feature}>
            <Ionicons name="trophy-outline" size={24} color={ACCENT_COLOR} />
            <Text style={styles.featureText}>Auto PR Detection & 1RM Charts</Text>
          </View>
        </View>

        {/* Login Button */}
        <TouchableOpacity
          style={styles.loginButton}
          onPress={login}
          activeOpacity={0.8}
        >
          <Ionicons name="logo-google" size={24} color="#000000" />
          <Text style={styles.loginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our Terms of Service
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT_COLOR,
    marginBottom: 24,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  goldLine: {
    width: 80,
    height: 3,
    backgroundColor: ACCENT_COLOR,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 14,
  },
  tagline: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 16,
    color: '#FFFFFF',
    marginLeft: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    maxWidth: 320,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: '#555555',
    marginTop: 16,
    textAlign: 'center',
  },
});
