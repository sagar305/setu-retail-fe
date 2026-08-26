import React from 'react';
import { Stack } from 'expo-router';

/**
 * Groups the auth screens under a single `(auth)` route so the root stack can
 * hide their headers as one unit.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
