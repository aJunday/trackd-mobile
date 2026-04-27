import React, { useEffect, useState, createContext, useContext, useCallback } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { Storage } from '../src/utils/storage';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const SESSION_KEY = 'trackd_session_token';

interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  weight?: number;
  weight_kg?: number;
  height_cm?: number;
  age?: number;
  biological_sex?: string;
  activity_level?: string;
  goal_type?: string;
  sport?: string;
  bmr?: number;
  tdee?: number;
  goal_calories: number;
  goal_protein: number;
  goal_carbs: number;
  goal_fats: number;
  onboarding_complete?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  sessionToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  const checkAuth = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      const response = await fetch(`${BACKEND_URL}/api/auth/me`, {
        method: 'GET',
        headers,
        credentials: 'omit',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Stale/expired token — purge from storage so it doesn't keep being restored on next mount
        setUser(null);
        setSessionToken(null);
        Storage.removeItem(SESSION_KEY).catch(() => {});
      }
    } catch (error) {
      console.log('Auth check error:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [sessionToken]);

  // Handle deep linking for OAuth callback
  useEffect(() => {
    const handleUrl = async (event: { url: string }) => {
      const url = event.url;
      console.log('Received URL:', url);
      
      // Check for session_id in URL
      if (url.includes('session_id=')) {
        const sessionIdMatch = url.match(/session_id=([^&]+)/);
        if (sessionIdMatch) {
          const sessionId = sessionIdMatch[1];
          await exchangeSessionId(sessionId);
        }
      }
    };

    // Get initial URL
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl({ url });
      }
    });

    // Listen for URL events
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.remove();
    };
  }, []);

  const exchangeSessionId = async (sessionId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit',
        body: JSON.stringify({ session_id: sessionId }),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setSessionToken(data.session_token);
        Storage.setItem(SESSION_KEY, data.session_token).catch(() => {});
        if (data.user?.onboarding_complete) {
          router.replace('/(auth)/dashboard');
        } else {
          router.replace('/onboarding');
        }
      } else {
        console.error('Session exchange failed');
        router.replace('/');
      }
    } catch (error) {
      console.error('Session exchange error:', error);
      router.replace('/');
    } finally {
      setIsLoading(false);
    }
  };

  // Check auth on mount
  useEffect(() => {
    // Skip if we're processing a callback
    const currentUrl = Platform.OS === 'web' ? window.location.href : '';
    if (currentUrl.includes('session_id=')) {
      const sessionIdMatch = currentUrl.match(/[#?]session_id=([^&]+)/);
      if (sessionIdMatch) {
        exchangeSessionId(sessionIdMatch[1]);
        // Clean URL
        if (Platform.OS === 'web') {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        return;
      }
    }

    // Try to load persisted session
    Storage.getItem(SESSION_KEY).then((token) => {
      if (token) {
        setSessionToken(token);
      } else {
        checkAuth();
      }
    }).catch(() => checkAuth());
  }, []);

  // When sessionToken changes, re-validate it via /api/auth/me
  useEffect(() => {
    if (sessionToken) {
      checkAuth();
    }
  }, [sessionToken]);

  // Handle navigation based on auth state
  useEffect(() => {
    if (!navigationState?.key || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';

    if (!user) {
      // Not logged in: only login screen allowed
      if (inAuthGroup || inOnboarding) {
        router.replace('/');
      }
      return;
    }

    // Logged in
    if (!user.onboarding_complete) {
      // Force onboarding
      if (!inOnboarding) {
        router.replace('/onboarding');
      }
    } else {
      // Onboarded: shouldn't be on login or onboarding
      if (!inAuthGroup && segments[0] !== '+not-found') {
        router.replace('/(auth)/dashboard');
      }
    }
  }, [user, segments, isLoading, navigationState?.key]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    let redirectUrl: string;
    
    if (Platform.OS === 'web') {
      redirectUrl = window.location.origin + '/';
    } else {
      // For native apps, use the app scheme
      redirectUrl = Linking.createURL('/');
    }
    
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (Platform.OS === 'web') {
      window.location.href = authUrl;
    } else {
      Linking.openURL(authUrl);
    }
  };

  const logout = async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (sessionToken) {
        headers['Authorization'] = `Bearer ${sessionToken}`;
      }

      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'omit',
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setSessionToken(null);
      Storage.removeItem(SESSION_KEY).catch(() => {});
      router.replace('/');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, sessionToken, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#000000' },
          animation: 'fade',
        }}
      />
    </AuthProvider>
  );
}
