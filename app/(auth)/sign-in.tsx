import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell, Button, TextField } from '@/components';
import { strings } from '@/i18n/strings';
import { useAuth } from '@/auth/AuthProvider';
import { colors, typography } from '@/theme';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    const result = await signIn(email, password);
    setBusy(false);

    // On success the root layout redirects once the session lands.
    if (!result.ok) setError(result.error ?? null);
    else router.replace('/');
  };

  return (
    <AuthShell
      title={strings.auth.signInTitle}
      subtitle={strings.auth.signInSubtitle}
      error={error}
      footer={
        <>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>{strings.auth.forgot}</Text>
            </Pressable>
          </Link>
          <Link href="/(auth)/sign-up" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>{strings.auth.toSignUp}</Text>
            </Pressable>
          </Link>
        </>
      }
    >
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
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        onSubmitEditing={submit}
        returnKeyType="go"
      />
      <Button
        label={strings.auth.signIn}
        onPress={submit}
        disabled={!canSubmit}
        loading={busy}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
