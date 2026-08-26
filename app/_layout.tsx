import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { strings } from '@/i18n/strings';
import { useReminders } from '@/notifications/useReminders';
import { ChoresProvider } from '@/store/ChoresProvider';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ChoresProvider>
        <StatusBar style="dark" />
        <AppShell />
      </ChoresProvider>
    </SafeAreaProvider>
  );
}

/** Lives inside the provider so reminders can read and write chore state. */
function AppShell() {
  useReminders();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chore/edit"
        options={{ presentation: 'modal', title: strings.form.newTitle }}
      />
    </Stack>
  );
}
