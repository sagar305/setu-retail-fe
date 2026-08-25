import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Avatar, Chip, EmptyState, Screen } from '@/components';
import { formatRelativeDay, todayKey } from '@/lib/dates';
import { describeRecurrence, nextOccurrence } from '@/lib/schedule';
import { useChores } from '@/store/ChoresProvider';
import { colors, radius, shadow, spacing, typography } from '@/theme';
import type { Chore } from '@/types';

type Filter = 'all' | 'mine' | 'unassigned' | 'archived';

export default function ChoresScreen() {
  const router = useRouter();
  const { data, ready } = useChores();
  const [filter, setFilter] = useState<Filter>('all');
  const [memberFilter, setMemberFilter] = useState<string | null>(null);
  const today = todayKey();

  const chores = useMemo(() => {
    return data.chores
      .filter((chore) => {
        if (filter === 'archived') return chore.archived;
        if (chore.archived) return false;
        if (filter === 'unassigned') return !chore.assigneeId;
        if (filter === 'mine' && memberFilter) return chore.assigneeId === memberFilter;
        return true;
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [data.chores, filter, memberFilter]);

  const selectMember = (id: string) => {
    if (memberFilter === id) {
      setMemberFilter(null);
      setFilter('all');
    } else {
      setMemberFilter(id);
      setFilter('mine');
    }
  };

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={typography.title}>All chores</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a chore"
            onPress={() => router.push('/chore/edit')}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <Chip
            label="All"
            selected={filter === 'all'}
            onPress={() => {
              setFilter('all');
              setMemberFilter(null);
            }}
          />
          <Chip
            label="Unassigned"
            selected={filter === 'unassigned'}
            onPress={() => {
              setFilter('unassigned');
              setMemberFilter(null);
            }}
          />
          <Chip
            label="Archived"
            selected={filter === 'archived'}
            onPress={() => {
              setFilter('archived');
              setMemberFilter(null);
            }}
          />
          {data.members.map((member) => (
            <Chip
              key={member.id}
              label={member.name}
              color={member.color}
              selected={filter === 'mine' && memberFilter === member.id}
              onPress={() => selectMember(member.id)}
            />
          ))}
        </ScrollView>

        {chores.length === 0 ? (
          <EmptyState
            icon="clipboard-outline"
            title={filter === 'all' ? 'No chores yet' : 'Nothing here'}
            message={
              filter === 'all'
                ? 'Tap + to create your first chore — pick how often it repeats and who it belongs to.'
                : 'Try a different filter.'
            }
          />
        ) : (
          <View style={styles.list}>
            {chores.map((chore) => (
              <ChoreRow
                key={chore.id}
                chore={chore}
                today={today}
                onPress={() => router.push(`/chore/edit?id=${chore.id}`)}
                member={data.members.find((m) => m.id === chore.assigneeId)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

interface ChoreRowProps {
  chore: Chore;
  today: string;
  member?: React.ComponentProps<typeof Avatar>['member'];
  onPress: () => void;
}

function ChoreRow({ chore, today, member, onPress }: ChoreRowProps) {
  const next = chore.archived ? undefined : nextOccurrence(chore, today);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar member={member} size={36} />
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {chore.title}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[chore.room, describeRecurrence(chore.recurrence)].filter(Boolean).join(' · ')}
        </Text>
        <Text style={styles.rowNext}>
          {chore.archived
            ? 'Archived'
            : next
              ? `Next: ${formatRelativeDay(next, today)}`
              : 'No upcoming date'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
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
  filters: { gap: spacing.sm, paddingVertical: spacing.lg, paddingRight: spacing.lg },
  list: { gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.body, fontWeight: '600', fontSize: 16 },
  rowMeta: { ...typography.caption },
  rowNext: { ...typography.caption, color: colors.primary, fontWeight: '600' },
});
