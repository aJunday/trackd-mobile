/**
 * Cross-platform storage helper.
 * Web: uses localStorage (synchronous but wrapped in promise for API parity).
 * Native: uses AsyncStorage.
 *
 * Using localStorage on web makes testing easier (Playwright can inject session tokens).
 */
import { Platform } from 'react-native';

let nativeStorage: any = null;
if (Platform.OS !== 'web') {
  nativeStorage = require('@react-native-async-storage/async-storage').default;
}

export const Storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return window.localStorage.getItem(key);
      }
      return await nativeStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.setItem(key, value);
        return;
      }
      await nativeStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || !window.localStorage) return;
        window.localStorage.removeItem(key);
        return;
      }
      await nativeStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};
