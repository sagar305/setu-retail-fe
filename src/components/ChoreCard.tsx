import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { formatRelativeDay } from '@/lib/dates';
import { describeRecurrence } from '@/lib/schedule';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { ChoreOccurrence } from '@/types';

interface ChoreCardProps {
  occurrence: ChoreOccurrence;
  onToggle: () => void;
  onPress?: () => void;
  /** Show the due date (used in overdue lists where dates vary). */
  showDate?: boolean;
}

export function ChoreCard({ occurrence, onToggle, onPress, showDate = false }: ChoreCardProps) {
  const { chore, assignee, completion, isOverdue, dueDate } = occurrence;
  const done = Boolean(completion);

  const meta = [
    chore.room,
    describeRecurrence(chore.recurrence),
    showDate ? formatRelativeDay(dueDate) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={chore.title}
      style={({ pressed }) => [styles.card, pressed && onPress && styles.pressed]}
    >
      <Pressable
        onPress={onToggle}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}
        accessibilityLabel={done ? `Mark ${chore.title} as not done` : `Mark ${chore.title} as done`}
        style={[styles.checkbox, done && styles.checkboxDone]}
      >
        {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </Pressable>

      <View style={styles.body}>
        <Text style={[styles.title, done && styles.titleDone]} numberOfLines={1}>
          {chore.title}
        </Text>
        {meta ? (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
        {isOverdue ? <Text style={styles.overdue}>Overdue</Text> : null}
      </View>

      <View style={styles.trailing}>
        {chore.points > 0 ? <Text style={styles.points}>{chore.points} pts</Text> : null}
        <Avatar member={assignee} size={30} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  pressed: { opacity: 0.9 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.success, borderColor: colors.success },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600', fontSize: 16 },
  titleDone: { color: colors.textFaint, textDecorationLine: 'line-through' },
  meta: { ...typography.caption },
  overdue: { ...typography.caption, color: colors.danger, fontWeight: '700', marginTop: 2 },
  trailing: { alignItems: 'center', gap: spacing.xs },
  points: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
});
