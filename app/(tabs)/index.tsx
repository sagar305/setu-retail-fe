import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ChoreCard, EmptyState, Screen, SectionHeader } from '@/components';
import { formatDay, todayKey } from '@/lib/dates';
import { useChores } from '@/store/ChoresProvider';
import { completionRate, occurrencesOn, overdueOccurrences } from '@/store/selectors';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { ChoreOccurrence } from '@/types';

export default function TodayScreen() {
  const router = useRouter();
  const { data, ready, completeChore, uncompleteChore } = useChores();
  const today = todayKey();

  const todays = useMemo(() => occurrencesOn(data, today, today), [data, today]);
  const overdue = useMemo(() => overdueOccurrences(data, today), [data, today]);

  const done = todays.filter((o) => o.completion).length;
  const progress = completionRate(todays);

  const toggle = (occurrence: ChoreOccurrence) => {
    const { chore, dueDate, completion } = occurrence;
    if (completion) uncompleteChore(chore.id, dueDate);
    else completeChore(chore.id, dueDate, chore.assigneeId ?? null);
  };

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={typography.title}>Today</Text>
            <Text style={styles.date}>{formatDay(today)}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a chore"
            onPress={() => router.push('/chore/edit')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        {todays.length > 0 ? (
          <View style={styles.progressCard}>
            <View style={styles.progressRow}>
              <Text style={styles.progressLabel}>
                {done} of {todays.length} done
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
            <SectionHeader title="Overdue" count={overdue.length} />
            <View style={styles.list}>
              {overdue.map((occurrence) => (
                <ChoreCard
                  key={`${occurrence.chore.id}-${occurrence.dueDate}`}
                  occurrence={occurrence}
                  showDate
                  onToggle={() => toggle(occurrence)}
                  onPress={() => router.push(`/chore/edit?id=${occurrence.chore.id}`)}
                />
              ))}
            </View>
          </>
        ) : null}

        {todays.length > 0 ? (
          <>
            <SectionHeader title="Due today" count={todays.length} />
            <View style={styles.list}>
              {todays.map((occurrence) => (
                <ChoreCard
                  key={`${occurrence.chore.id}-${occurrence.dueDate}`}
                  occurrence={occurrence}
                  onToggle={() => toggle(occurrence)}
                  onPress={() => router.push(`/chore/edit?id=${occurrence.chore.id}`)}
                />
              ))}
            </View>
          </>
        ) : null}

        {todays.length === 0 && overdue.length === 0 ? (
          <EmptyState
            icon="cafe-outline"
            title="Nothing due today"
            message={
              data.chores.length === 0
                ? 'Add your first chore and it will show up here on the days it is due.'
                : 'Enjoy the break — your next chore will appear when it comes around.'
            }
          />
        ) : null}
      </ScrollView>
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
