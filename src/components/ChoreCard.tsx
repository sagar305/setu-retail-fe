import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from './Avatar';
import { strings } from '@/i18n/strings';
import { formatRelativeDay, formatTime } from '@/lib/dates';
import { describeRecurrence } from '@/lib/schedule';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { ChoreOccurrence } from '@/types';

interface ChoreCardProps {
  occurrence: ChoreOccurrence;
  onToggle: () => void;
  onPress?: () => void;
  onSnooze?: () => void;
  onSkip?: () => void;
  /** Rolling chores only: log it as done on an earlier day. */
  onEarlyDone?: () => void;
  /** Show the due date — used in overdue lists where dates vary. */
  showDate?: boolean;
}

export function ChoreCard({
  occurrence,
  onToggle,
  onPress,
  onSnooze,
  onSkip,
  onEarlyDone,
  showDate = false,
}: ChoreCardProps) {
  const { chore, assignee, status, isOverdue, dueDate, snooze } = occurrence;
  const done = status === 'done';
  const skipped = status === 'skipped';

  const meta = [
    chore.room,
    describeRecurrence(chore.recurrence),
    showDate ? formatRelativeDay(dueDate) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={chore.title}
        style={({ pressed }) => [styles.main, pressed && onPress && styles.pressed]}
      >
        <Pressable
          onPress={onToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={`${chore.title} — ${done ? strings.actions.undo : strings.actions.done}`}
          style={[styles.checkbox, done && styles.checkboxDone, skipped && styles.checkboxSkipped]}
        >
          {done ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
          {skipped ? <Ionicons name="close" size={16} color={colors.textFaint} /> : null}
        </Pressable>

        <View style={styles.body}>
          <Text style={[styles.title, (done || skipped) && styles.titleSettled]} numberOfLines={1}>
            {chore.title}
          </Text>
          {meta ? (
            <Text style={styles.meta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <Text style={styles.time}>{formatTime(chore.reminderTime)}</Text>
            {chore.points > 0 ? (
              <Text style={styles.points}>{strings.common.points(chore.points)}</Text>
            ) : null}
            {isOverdue ? <Text style={styles.overdue}>Reh gaya</Text> : null}
            {skipped ? <Text style={styles.skipped}>{strings.actions.skipped}</Text> : null}
            {snooze && status === 'pending' ? (
              <Text style={styles.snoozed}>
                {strings.today.snoozedUntil(
                  new Date(snooze.remindAt).toLocaleString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    day: 'numeric',
                    month: 'short',
                  }),
                )}
              </Text>
            ) : null}
          </View>
        </View>

        <Avatar member={assignee} size={32} />
      </Pressable>

      {status === 'pending' && (onSnooze || onSkip) ? (
        <View style={styles.actions}>
          {onSnooze ? (
            <Pressable
              onPress={onSnooze}
              accessibilityRole="button"
              accessibilityLabel={`${chore.title} — ${strings.actions.snooze}`}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="time-outline" size={15} color={colors.textMuted} />
              <Text style={styles.actionText}>{strings.actions.snooze}</Text>
            </Pressable>
          ) : null}
          {onEarlyDone ? (
            <Pressable
              onPress={onEarlyDone}
              accessibilityRole="button"
              accessibilityLabel={`${chore.title} — ${strings.earlyDone.action}`}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
              <Text style={styles.actionText}>{strings.earlyDone.action}</Text>
            </Pressable>
          ) : null}
          {onSkip ? (
            <Pressable
              onPress={onSkip}
              accessibilityRole="button"
              accessibilityLabel={`${chore.title} — ${strings.actions.skip}`}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Ionicons name="play-skip-forward-outline" size={15} color={colors.textMuted} />
              <Text style={styles.actionText}>{strings.actions.skip}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, ...shadow.card },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.85 },
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
  checkboxSkipped: { backgroundColor: colors.surfaceMuted },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600', fontSize: 16 },
  titleSettled: { color: colors.textFaint, textDecorationLine: 'line-through' },
  meta: { ...typography.caption },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  time: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  overdue: { ...typography.caption, color: colors.danger, fontWeight: '700' },
  skipped: { ...typography.caption, color: colors.textFaint, fontWeight: '700' },
  snoozed: { ...typography.caption, color: colors.warning, fontWeight: '600' },
  points: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  actionText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
});
