import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Chip, EmptyState, Screen } from '@/components';
import { strings } from '@/i18n/strings';
import { formatDay, formatRelativeDay, todayKey } from '@/lib/dates';
import { useChores } from '@/store/ChoresProvider';
import {
  DayHistory,
  HISTORY_WINDOW_DAYS,
  historyByDay,
  summariseHistory,
} from '@/store/selectors';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { ChoreOccurrence, OccurrenceStatus } from '@/types';

/** Day-by-day record of what got done, skipped and missed. */
export default function HistoryScreen() {
  const { data, ready } = useChores();
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const today = todayKey();

  const allDays = useMemo(() => historyByDay(data, today), [data, today]);

  // Filtering by member re-buckets each day rather than dropping whole days,
  // so the dates on screen stay comparable between filters.
  const days = useMemo(() => {
    if (!memberFilter) return allDays;

    const mine = (o: ChoreOccurrence) => o.chore.assigneeId === memberFilter;
    return allDays
      .map((day) => {
        const done = day.done.filter(mine);
        const skipped = day.skipped.filter(mine);
        const missed = day.missed.filter(mine);
        return { ...day, done, skipped, missed, total: done.length + skipped.length + missed.length };
      })
      .filter((day) => day.total > 0);
  }, [allDays, memberFilter]);

  const totals = useMemo(() => summariseHistory(days), [days]);

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={typography.title}>{strings.history.title}</Text>
          <Text style={styles.subtitle}>{strings.history.subtitle(HISTORY_WINDOW_DAYS)}</Text>
        </View>

        {data.members.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filters}
          >
            <Chip
              label={strings.history.allMembers}
              selected={memberFilter === null}
              onPress={() => setMemberFilter(null)}
            />
            {data.members.map((member) => (
              <Chip
                key={member.id}
                label={member.name}
                color={member.color}
                selected={memberFilter === member.id}
                onPress={() => setMemberFilter(memberFilter === member.id ? null : member.id)}
              />
            ))}
          </ScrollView>
        ) : null}

        {days.length === 0 ? (
          <EmptyState
            icon="calendar-outline"
            title={strings.history.emptyTitle}
            message={strings.history.emptyMessage}
          />
        ) : (
          <>
            <View style={styles.totals}>
              <Text style={styles.totalsHeadline}>
                {strings.history.summary(totals.done, totals.total)}
              </Text>
              <View style={styles.totalsRow}>
                <Tally kind="done" count={totals.done} />
                <Tally kind="skipped" count={totals.skipped} />
                <Tally kind="missed" count={totals.missed} />
              </View>
            </View>

            <View style={styles.days}>
              {days.map((day) => (
                <DayCard key={day.date} day={day} today={today} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const STATUS_STYLE: Record<
  Exclude<OccurrenceStatus, 'pending'> | 'missed',
  { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }
> = {
  done: { icon: 'checkmark-circle', color: colors.success, label: strings.history.done },
  skipped: { icon: 'play-skip-forward', color: colors.textFaint, label: strings.history.skipped },
  missed: { icon: 'alert-circle', color: colors.danger, label: strings.history.missed },
};

function Tally({ kind, count }: { kind: keyof typeof STATUS_STYLE; count: number }) {
  const style = STATUS_STYLE[kind];
  return (
    <View style={styles.tally}>
      <Ionicons name={style.icon} size={15} color={style.color} />
      <Text style={[styles.tallyText, { color: style.color }]}>
        {count} {style.label}
      </Text>
    </View>
  );
}

function DayCard({ day, today }: { day: DayHistory; today: string }) {
  const rows: { occurrence: ChoreOccurrence; kind: keyof typeof STATUS_STYLE }[] = [
    ...day.done.map((o) => ({ occurrence: o, kind: 'done' as const })),
    ...day.skipped.map((o) => ({ occurrence: o, kind: 'skipped' as const })),
    ...day.missed.map((o) => ({ occurrence: o, kind: 'missed' as const })),
  ];

  const allDone = day.done.length === day.total;

  return (
    <View style={styles.dayCard}>
      <View style={styles.dayHeader}>
        <View style={styles.dayHeading}>
          <Text style={styles.dayTitle}>{formatRelativeDay(day.date, today)}</Text>
          <Text style={styles.dayDate}>{formatDay(day.date)}</Text>
        </View>
        <Text style={[styles.dayCount, allDone && styles.dayCountPerfect]}>
          {strings.history.dayCount(day.done.length, day.total)}
        </Text>
      </View>

      {allDone ? <Text style={styles.perfect}>{strings.history.perfectDay}</Text> : null}

      <View style={styles.rows}>
        {rows.map(({ occurrence, kind }) => {
          const style = STATUS_STYLE[kind];
          return (
            <View key={`${occurrence.chore.id}-${kind}`} style={styles.row}>
              <Ionicons name={style.icon} size={16} color={style.color} />
              <Text
                style={[styles.rowTitle, kind !== 'done' && styles.rowTitleMuted]}
                numberOfLines={1}
              >
                {occurrence.chore.title}
              </Text>
              <Avatar member={occurrence.assignee} size={22} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  header: { paddingTop: spacing.md, gap: 2 },
  subtitle: { ...typography.body, color: colors.textMuted },
  filters: { gap: spacing.sm, paddingVertical: spacing.lg, paddingRight: spacing.lg },
  totals: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  totalsHeadline: { ...typography.body, fontWeight: '700', fontSize: 16 },
  totalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  tally: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  tallyText: { ...typography.caption, fontWeight: '700' },
  days: { gap: spacing.md, marginTop: spacing.lg },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayHeading: { gap: 1 },
  dayTitle: { ...typography.body, fontWeight: '700', fontSize: 16 },
  dayDate: { ...typography.caption },
  dayCount: { ...typography.body, fontWeight: '700', color: colors.textMuted },
  dayCountPerfect: { color: colors.success },
  perfect: { ...typography.caption, color: colors.success, fontWeight: '700' },
  rows: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { ...typography.body, flex: 1 },
  rowTitleMuted: { color: colors.textMuted },
});
