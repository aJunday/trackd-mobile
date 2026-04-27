import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from './_layout';
import OnboardingSlides from '../src/components/OnboardingSlides';

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

  return <OnboardingSlides onSignIn={login} loading={isLoading} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0D0D0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
