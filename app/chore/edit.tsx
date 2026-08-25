import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Chip, TextField } from '@/components';
import { dayOfWeek, todayKey, weekdayLabel } from '@/lib/dates';
import { useChores } from '@/store/ChoresProvider';
import { colors, radius, spacing, typography } from '@/theme';
import type { RecurrenceType } from '@/types';

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'once', label: 'One-off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const POINT_OPTIONS = [0, 1, 2, 3, 5, 8];

export default function EditChoreScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { data, addChore, updateChore, removeChore } = useChores();
  const today = todayKey();

  const existing = useMemo(
    () => (id ? data.chores.find((c) => c.id === id) : undefined),
    [data.chores, id],
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [room, setRoom] = useState(existing?.room ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [type, setType] = useState<RecurrenceType>(existing?.recurrence.type ?? 'weekly');
  const [interval, setInterval] = useState(String(existing?.recurrence.interval ?? 1));
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.recurrence.daysOfWeek ?? [dayOfWeek(today)],
  );
  const [assigneeId, setAssigneeId] = useState<string | null>(existing?.assigneeId ?? null);
  const [points, setPoints] = useState(existing?.points ?? 1);

  const canSave = title.trim().length > 0;

  const toggleDay = (day: number) => {
    setDaysOfWeek((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
  };

  const save = () => {
    if (!canSave) return;

    const parsedInterval = Math.max(1, parseInt(interval, 10) || 1);
    const recurrence = {
      type,
      interval: parsedInterval,
      // Only weekly uses specific days; default to today's weekday if none picked.
      daysOfWeek:
        type === 'weekly'
          ? daysOfWeek.length > 0
            ? daysOfWeek
            : [dayOfWeek(today)]
          : undefined,
    };

    const fields = {
      title: title.trim(),
      room: room.trim() || undefined,
      notes: notes.trim() || undefined,
      assigneeId,
      points,
      recurrence,
    };

    if (existing) updateChore(existing.id, fields);
    else addChore({ ...fields, startDate: today });

    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(`Delete "${existing.title}"?`, 'This also removes its completion history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          removeChore(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: existing ? 'Edit chore' : 'New chore' }} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextField
          label="What needs doing?"
          value={title}
          onChangeText={setTitle}
          placeholder="Take out the bins"
          autoFocus={!existing}
        />

        <TextField
          label="Room or area"
          value={room}
          onChangeText={setRoom}
          placeholder="Kitchen"
        />

        <View style={styles.group}>
          <Text style={styles.label}>Repeats</Text>
          <View style={styles.chipRow}>
            {RECURRENCE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={type === option.value}
                onPress={() => setType(option.value)}
              />
            ))}
          </View>
        </View>

        {type !== 'once' ? (
          <TextField
            label={`Every N ${type === 'daily' ? 'days' : type === 'weekly' ? 'weeks' : 'months'}`}
            value={interval}
            onChangeText={setInterval}
            keyboardType="number-pad"
            placeholder="1"
          />
        ) : null}

        {type === 'weekly' ? (
          <View style={styles.group}>
            <Text style={styles.label}>On these days</Text>
            <View style={styles.chipRow}>
              {[0, 1, 2, 3, 4, 5, 6].map((day) => (
                <Chip
                  key={day}
                  label={weekdayLabel(day)}
                  selected={daysOfWeek.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.group}>
          <Text style={styles.label}>Assigned to</Text>
          {data.members.length === 0 ? (
            <Text style={styles.hint}>
              Add people on the Household tab to assign chores to them.
            </Text>
          ) : (
            <View style={styles.chipRow}>
              <Chip
                label="Anyone"
                selected={assigneeId === null}
                onPress={() => setAssigneeId(null)}
              />
              {data.members.map((member) => (
                <Chip
                  key={member.id}
                  label={member.name}
                  color={member.color}
                  selected={assigneeId === member.id}
                  onPress={() => setAssigneeId(member.id)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>Points</Text>
          <View style={styles.chipRow}>
            {POINT_OPTIONS.map((value) => (
              <Chip
                key={value}
                label={String(value)}
                selected={points === value}
                onPress={() => setPoints(value)}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Notes"
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything worth remembering"
          multiline
          style={styles.notes}
        />

        <View style={styles.actions}>
          <Button label={existing ? 'Save changes' : 'Add chore'} onPress={save} disabled={!canSave} />
          {existing ? (
            <>
              <Button
                label={existing.archived ? 'Unarchive' : 'Archive'}
                variant="secondary"
                onPress={() => {
                  updateChore(existing.id, { archived: !existing.archived });
                  router.back();
                }}
              />
              <Button label="Delete chore" variant="danger" onPress={confirmDelete} />
            </>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  group: { gap: spacing.sm },
  label: { ...typography.label },
  hint: { ...typography.caption },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  notes: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.sm, borderRadius: radius.md },
});
