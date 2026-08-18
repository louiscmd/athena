import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, Platform } from 'react-native';
import { useEffect } from 'react';
import { AthenaProvider } from '@/contexts/AthenaContext';
import { Colors } from '@/constants/theme';
import { handleSpotifyCallback } from '@/lib/spotify';

export default function RootLayout() {
  // Handle Spotify PKCE redirect callback on app load
  useEffect(() => {
    if (Platform.OS === 'web') {
      handleSpotifyCallback().then(ok => {
        if (ok) console.log('Spotify connected via OAuth callback');
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AthenaProvider>
        <StatusBar style="light" backgroundColor={Colors.bg} />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.bg },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="settings"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="onboarding"
            options={{ animation: 'fade', gestureEnabled: false }}
          />
        </Stack>
      </AthenaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
