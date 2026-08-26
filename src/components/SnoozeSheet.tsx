import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { Chip } from './Chip';
import { OptionRow } from './OptionRow';
import { Sheet } from './Sheet';
import { strings } from '@/i18n/strings';
import { colors, radius, spacing, typography } from '@/theme';
import type { SnoozePresetId, SnoozeSetting, SnoozeUnit } from '@/types';

const PRESETS: SnoozePresetId[] = ['6h', '12h', '1d', '1w', 'custom'];

interface SnoozeSheetProps {
  visible: boolean;
  /** Pre-selected when opened — the chore's default. */
  initial: SnoozeSetting;
  onClose: () => void;
  onConfirm: (setting: SnoozeSetting) => void;
}

/** Lets the user defer a reminder, starting from the chore's default. */
export function SnoozeSheet({ visible, initial, onClose, onConfirm }: SnoozeSheetProps) {
  const [preset, setPreset] = useState<SnoozePresetId>(initial.preset);
  const [amount, setAmount] = useState(String(initial.customAmount ?? 2));
  const [unit, setUnit] = useState<SnoozeUnit>(initial.customUnit ?? 'hour');

  const confirm = () => {
    onConfirm(
      preset === 'custom'
        ? { preset, customAmount: Math.max(1, parseInt(amount, 10) || 1), customUnit: unit }
        : { preset },
    );
  };

  return (
    <Sheet visible={visible} title={strings.actions.snoozeTitle} onClose={onClose}>
      {PRESETS.map((id) => (
        <OptionRow
          key={id}
          label={strings.snooze[id]}
          selected={preset === id}
          onPress={() => setPreset(id)}
        />
      ))}

      {preset === 'custom' ? (
        <View style={styles.custom}>
          <View style={styles.amountRow}>
            <Text style={styles.label}>{strings.form.snoozeCustomAmount}</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              style={styles.input}
              accessibilityLabel={strings.form.snoozeCustomAmount}
            />
          </View>
          <View style={styles.unitRow}>
            <Chip
              label={strings.units.hour}
              selected={unit === 'hour'}
              onPress={() => setUnit('hour')}
            />
            <Chip
              label={strings.units.day}
              selected={unit === 'day'}
              onPress={() => setUnit('day')}
            />
          </View>
        </View>
      ) : null}

      <Button label={strings.actions.snooze} onPress={confirm} style={styles.confirm} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  custom: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.xs,
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { ...typography.label, flex: 1 },
  input: {
    width: 90,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  unitRow: { flexDirection: 'row', gap: spacing.sm },
  confirm: { marginTop: spacing.md },
});
