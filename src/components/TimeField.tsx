import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { formatTime } from '@/lib/dates';
import { colors, radius, spacing, typography } from '@/theme';
import type { TimeKey } from '@/types';

interface TimeFieldProps {
  label: string;
  value: TimeKey;
  onChange: (value: TimeKey) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parse(value: TimeKey) {
  const [hour24, minute] = value.split(':').map(Number);
  return {
    hour12: hour24 % 12 === 0 ? 12 : hour24 % 12,
    minute,
    isPm: hour24 >= 12,
  };
}

function build(hour12: number, minute: number, isPm: boolean): TimeKey {
  const base = hour12 % 12;
  const hour24 = isPm ? base + 12 : base;
  return `${`${hour24}`.padStart(2, '0')}:${`${minute}`.padStart(2, '0')}`;
}

/**
 * A self-contained time picker. Deliberately avoids the native date-time
 * picker, which has no usable web implementation — this renders identically
 * everywhere.
 */
export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [open, setOpen] = useState(false);
  const { hour12, minute, isPm } = parse(value);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${formatTime(value)}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Ionicons name="alarm-outline" size={18} color={colors.primary} />
        <Text style={styles.triggerText}>{formatTime(value)}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
      </Pressable>

      <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
        <View style={styles.columns}>
          <Column
            values={HOURS}
            selected={hour12}
            format={(h) => `${h}`}
            onSelect={(h) => onChange(build(h, minute, isPm))}
          />
          <Column
            values={MINUTES}
            selected={minute}
            format={(m) => `${m}`.padStart(2, '0')}
            onSelect={(m) => onChange(build(hour12, m, isPm))}
          />
          <View style={styles.meridiem}>
            {[false, true].map((pm) => (
              <Pressable
                key={String(pm)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isPm === pm }}
                onPress={() => onChange(build(hour12, minute, pm))}
                style={[styles.cell, isPm === pm && styles.cellSelected]}
              >
                <Text style={[styles.cellText, isPm === pm && styles.cellTextSelected]}>
                  {pm ? 'PM' : 'AM'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Sheet>
    </View>
  );
}

interface ColumnProps<T extends number> {
  values: T[];
  selected: T;
  format: (value: T) => string;
  onSelect: (value: T) => void;
}

function Column<T extends number>({ values, selected, format, onSelect }: ColumnProps<T>) {
  return (
    <ScrollView style={styles.column} showsVerticalScrollIndicator={false}>
      {values.map((value) => (
        <Pressable
          key={value}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === selected }}
          onPress={() => onSelect(value)}
          style={[styles.cell, value === selected && styles.cellSelected]}
        >
          <Text style={[styles.cellText, value === selected && styles.cellTextSelected]}>
            {format(value)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: { ...typography.label },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  triggerText: { ...typography.body, fontWeight: '600', flex: 1 },
  pressed: { opacity: 0.85 },
  columns: { flexDirection: 'row', gap: spacing.sm, height: 300 },
  column: { flex: 1 },
  meridiem: { flex: 1, gap: spacing.xs },
  cell: {
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellText: { ...typography.body, fontWeight: '600' },
  cellTextSelected: { color: '#FFFFFF' },
});
