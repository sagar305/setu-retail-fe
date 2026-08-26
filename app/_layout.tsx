import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { strings } from '@/i18n/strings';
import { useReminders } from '@/notifications/useReminders';
import { ChoresProvider, useChores } from '@/store/ChoresProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ChoresProvider>
          <StatusBar style="dark" />
          <AppShell />
        </ChoresProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Lives inside both providers so it can route on auth state and drive
 * reminders from chore state.
 */
function AppShell() {
  useReminders();
  useAuthRouting();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="household/setup" options={{ headerShown: false }} />
      <Stack.Screen
        name="chore/edit"
        options={{ presentation: 'modal', title: strings.form.newTitle }}
      />
    </Stack>
  );
}

/**
 * Sends the user to the right place: signed out to the auth screens, signed in
 * without a household to setup, and everyone else to the tabs.
 */
function useAuthRouting(): void {
  const router = useRouter();
  const segments = useSegments();
  const { user, ready: authReady } = useAuth();
  const { ready: dataReady, households } = useChores();

  useEffect(() => {
    if (!authReady) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';
    const inSetup = group === 'household';

    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    // Wait for the household list before deciding where a signed-in user goes.
    if (!dataReady) return;

    if (households.length === 0) {
      if (!inSetup) router.replace('/household/setup');
      return;
    }

    if (inAuthGroup || inSetup) router.replace('/');
  }, [authReady, dataReady, user, households.length, segments, router]);
}

export function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
