import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell, Button, Chip, TextField } from '@/components';
import { strings } from '@/i18n/strings';
import { useChores } from '@/store/ChoresProvider';
import { spacing } from '@/theme';

type Mode = 'create' | 'join';

/** Shown when a signed-in user does not belong to any household yet. */
export default function HouseholdSetupScreen() {
  const router = useRouter();
  const { createHousehold, joinHousehold } = useChores();

  const [mode, setMode] = useState<Mode>('create');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = mode === 'create' ? name.trim().length > 0 : code.trim().length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      if (mode === 'create') await createHousehold(name);
      else await joinHousehold(code);
      router.replace('/');
    } catch (caught) {
      const message = (caught as Error).message;
      setError(
        mode === 'join' && /no_data_found|nahi mila/i.test(message)
          ? strings.household.joinFailed
          : message,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title={strings.household.setupTitle}
      subtitle={strings.household.setupSubtitle}
      error={error}
    >
      <View style={styles.tabs}>
        <Chip
          label={strings.household.createTab}
          selected={mode === 'create'}
          onPress={() => setMode('create')}
        />
        <Chip
          label={strings.household.joinTab}
          selected={mode === 'join'}
          onPress={() => setMode('join')}
        />
      </View>

      {mode === 'create' ? (
        <TextField
          label={strings.household.householdName}
          value={name}
          onChangeText={setName}
          placeholder={strings.household.householdNamePlaceholder}
          autoFocus
        />
      ) : (
        <TextField
          label={strings.household.codeLabel}
          value={code}
          onChangeText={(text) => setCode(text.toUpperCase())}
          placeholder={strings.household.codePlaceholder}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={8}
          style={styles.code}
          autoFocus
        />
      )}

      <Button
        label={mode === 'create' ? strings.household.create : strings.household.join}
        onPress={submit}
        disabled={!canSubmit}
        loading={busy}
      />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: spacing.sm },
  code: { letterSpacing: 4, fontWeight: '700', fontSize: 20 },
});
