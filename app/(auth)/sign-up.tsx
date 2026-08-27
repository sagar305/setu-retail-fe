import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { AuthShell, Button, TextField } from '@/components';
import { strings } from '@/i18n/strings';
import { useAuth } from '@/auth/AuthProvider';
import { colors, radius, spacing, typography } from '@/theme';

export default function SignUpScreen() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  const canSubmit =
    fullName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const result = await signUp(email, password, fullName);
    setBusy(false);

    if (!result.ok) {
      setError(result.error ?? null);
      return;
    }
    // Email confirmation is required, so there is no session to redirect on.
    if (result.needsEmailConfirmation) setAwaitingConfirmation(true);
  };

  if (awaitingConfirmation) {
    return (
      <AuthShell title={strings.auth.confirmTitle} subtitle={strings.auth.confirmMessage(email)}>
        <View style={styles.confirmCard}>
          <Ionicons name="mail-outline" size={28} color={colors.primary} />
          <Text style={styles.confirmText}>{strings.auth.confirmMessage(email)}</Text>
        </View>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{strings.auth.toSignIn}</Text>
          </Pressable>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={strings.auth.signUpTitle}
      subtitle={strings.auth.signUpSubtitle}
      error={error}
      footer={
        <Link href="/(auth)/sign-in" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{strings.auth.toSignIn}</Text>
          </Pressable>
        </Link>
      }
    >
      <TextField
        label={strings.auth.name}
        value={fullName}
        onChangeText={setFullName}
        placeholder={strings.auth.namePlaceholder}
        autoComplete="name"
      />
      <TextField
        label={strings.auth.email}
        value={email}
        onChangeText={setEmail}
        placeholder={strings.auth.emailPlaceholder}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
      />
      <TextField
        label={strings.auth.password}
        value={password}
        onChangeText={setPassword}
        hint={strings.auth.passwordHint}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <Button
        label={strings.auth.signUp}
        onPress={submit}
        disabled={!canSubmit}
        loading={busy}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.body, color: colors.primary, fontWeight: '600' },
  confirmCard: {
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  confirmText: { ...typography.body, textAlign: 'center' },
});
