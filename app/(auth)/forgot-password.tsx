import React, { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthShell, Button, TextField } from '@/components';
import { strings } from '@/i18n/strings';
import { useAuth } from '@/auth/AuthProvider';
import { colors, typography } from '@/theme';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);

    const result = await sendPasswordReset(email);
    setBusy(false);

    if (result.ok) setSent(true);
    else setError(result.error ?? null);
  };

  return (
    <AuthShell
      title={strings.auth.forgotTitle}
      subtitle={sent ? strings.auth.resetSent : strings.auth.forgotSubtitle}
      error={error}
      footer={
        <Link href="/(auth)/sign-in" asChild>
          <Pressable accessibilityRole="link">
            <Text style={styles.link}>{strings.auth.back}</Text>
          </Pressable>
        </Link>
      }
    >
      {!sent ? (
        <>
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
          <Button
            label={strings.auth.sendReset}
            onPress={submit}
            disabled={!email.trim()}
            loading={busy}
          />
        </>
      ) : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  link: { ...typography.body, color: colors.primary, fontWeight: '600' },
});
