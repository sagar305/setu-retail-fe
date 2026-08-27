import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChoreCard, EmptyState, Screen, SectionHeader, SnoozeSheet } from '@/components';
import { strings } from '@/i18n/strings';
import { formatDay, todayKey } from '@/lib/dates';
import { useChores } from '@/store/ChoresProvider';
import { completionRate, occurrencesOn, overdueOccurrences } from '@/store/selectors';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { ChoreOccurrence, SnoozeSetting } from '@/types';

export default function TodayScreen() {
  const router = useRouter();
  const { data, ready, completeChore, uncompleteChore, skipChore, snoozeChore, syncError, pendingWrites } =
    useChores();
  const today = todayKey();

  const [snoozeTarget, setSnoozeTarget] = useState<ChoreOccurrence | null>(null);

  const todays = useMemo(() => occurrencesOn(data, today, today), [data, today]);
  const overdue = useMemo(() => overdueOccurrences(data, today), [data, today]);

  const done = todays.filter((o) => o.status !== 'pending').length;
  const progress = completionRate(todays);

  const toggle = (occurrence: ChoreOccurrence) => {
    const { chore, dueDate, status } = occurrence;
    if (status === 'done') uncompleteChore(chore.id, dueDate);
    else completeChore(chore.id, dueDate);
  };

  const applySnooze = (setting: SnoozeSetting) => {
    if (!snoozeTarget) return;
    snoozeChore(snoozeTarget.chore.id, snoozeTarget.dueDate, setting);
    setSnoozeTarget(null);
  };

  const renderCard = (occurrence: ChoreOccurrence, showDate = false) => (
    <ChoreCard
      key={`${occurrence.chore.id}-${occurrence.dueDate}`}
      occurrence={occurrence}
      showDate={showDate}
      onToggle={() => toggle(occurrence)}
      onPress={() => router.push(`/chore/edit?id=${occurrence.chore.id}`)}
      onSnooze={() => setSnoozeTarget(occurrence)}
      onSkip={() => skipChore(occurrence.chore.id, occurrence.dueDate)}
    />
  );

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={typography.title}>{strings.today.title}</Text>
            <Text style={styles.date}>{formatDay(today)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={strings.form.newTitle}
            onPress={() => router.push('/chore/edit')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {syncError || pendingWrites > 0 ? (
          <View style={styles.syncBanner} accessibilityRole="alert">
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.syncText}>
              {syncError ?? strings.household.pendingWrites(pendingWrites)}
            </Text>
          </View>
        ) : null}

        {todays.length > 0 ? (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {strings.today.progress(done, todays.length)}
              </Text>
              <Text style={styles.progressPercent}>{Math.round(progress * 100)}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
          </View>
        ) : null}

        {overdue.length > 0 ? (
          <>
            <SectionHeader title={strings.today.overdue} count={overdue.length} />
            <View style={styles.list}>{overdue.map((o) => renderCard(o, true))}</View>
          </>
        ) : null}

        {todays.length > 0 ? (
          <>
            <SectionHeader title={strings.today.dueToday} count={todays.length} />
            <View style={styles.list}>{todays.map((o) => renderCard(o))}</View>
          </>
        ) : null}

        {todays.length === 0 && overdue.length === 0 ? (
          <EmptyState
            icon="cafe-outline"
            title={strings.today.nothingTitle}
            message={
              data.chores.length === 0
                ? strings.today.nothingFirstChore
                : strings.today.nothingElse
            }
          />
        ) : null}
      </ScrollView>

      {snoozeTarget ? (
        <SnoozeSheet
          visible
          initial={snoozeTarget.chore.defaultSnooze}
          onClose={() => setSnoozeTarget(null)}
          onConfirm={applySnooze}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  headerText: { gap: 2 },
  date: { ...typography.body, color: colors.textMuted },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
  },
  pressed: { opacity: 0.85 },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  syncText: { ...typography.caption, color: colors.warning, fontWeight: '600', flex: 1 },
  progressCard: {
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { ...typography.body, fontWeight: '600' },
  progressPercent: { ...typography.body, fontWeight: '700', color: colors.primary },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.success },
  list: { gap: spacing.md },
});
