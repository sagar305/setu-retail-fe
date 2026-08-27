import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/theme';

interface OptionRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
}

/** A single selectable row inside a Sheet. */
export function OptionRow({ label, description, selected, onPress }: OptionRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
    >
      <View style={styles.body}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  rowSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.85 },
  body: { flex: 1, gap: 2 },
  label: { ...typography.body, fontWeight: '600' },
  labelSelected: { color: colors.primary },
  description: { ...typography.caption },
});
