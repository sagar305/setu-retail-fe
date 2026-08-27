import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  Button,
  Chip,
  FrequencySheet,
  PRESETS_NEEDING_WEEKDAY,
  TextField,
  TimeField,
} from '@/components';
import { WEEKDAY_LABELS, strings } from '@/i18n/strings';
import { dayOfWeek, todayKey } from '@/lib/dates';
import { describeRecurrence, describeSnooze } from '@/lib/schedule';
import { useChores } from '@/store/ChoresProvider';
import { colors, radius, spacing, typography } from '@/theme';
import type {
  CustomUnit,
  FrequencyPreset,
  Recurrence,
  SnoozePresetId,
  SnoozeSetting,
  SnoozeUnit,
} from '@/types';

const POINT_OPTIONS = [0, 1, 2, 3, 5, 8];
const SNOOZE_PRESETS: SnoozePresetId[] = ['6h', '12h', '1d', '1w', 'custom'];
const CUSTOM_UNITS: CustomUnit[] = ['day', 'week', 'month'];
const MONTH_DATES = Array.from({ length: 31 }, (_, i) => i + 1);
const DEFAULT_REMINDER_TIME = '09:00';

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
  const [points, setPoints] = useState(existing?.points ?? 1);
  const [assigneeId, setAssigneeId] = useState<string | null>(existing?.assigneeId ?? null);
  const [reminderTime, setReminderTime] = useState(existing?.reminderTime ?? DEFAULT_REMINDER_TIME);

  const [preset, setPreset] = useState<FrequencyPreset>(existing?.recurrence.preset ?? 'daily');
  const [weekday, setWeekday] = useState(existing?.recurrence.weekday ?? dayOfWeek(today));
  const [customUnit, setCustomUnit] = useState<CustomUnit>(
    existing?.recurrence.custom?.unit ?? 'week',
  );
  const [customInterval, setCustomInterval] = useState(
    String(existing?.recurrence.custom?.interval ?? 1),
  );
  const [customDays, setCustomDays] = useState<number[]>(
    existing?.recurrence.custom?.daysOfWeek ?? [dayOfWeek(today)],
  );
  const [customDates, setCustomDates] = useState<number[]>(
    existing?.recurrence.custom?.datesOfMonth ?? [],
  );

  const [snoozePreset, setSnoozePreset] = useState<SnoozePresetId>(
    existing?.defaultSnooze.preset ?? '1d',
  );
  const [snoozeAmount, setSnoozeAmount] = useState(
    String(existing?.defaultSnooze.customAmount ?? 2),
  );
  const [snoozeUnit, setSnoozeUnit] = useState<SnoozeUnit>(
    existing?.defaultSnooze.customUnit ?? 'hour',
  );

  const [frequencyOpen, setFrequencyOpen] = useState(false);

  const hasMembers = data.members.length > 0;
  const canSave = title.trim().length > 0 && Boolean(assigneeId);

  const toggle = (list: number[], value: number) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort((a, b) => a - b);

  const buildRecurrence = (): Recurrence => {
    if (preset === 'custom') {
      return {
        preset,
        custom: {
          unit: customUnit,
          interval: Math.max(1, parseInt(customInterval, 10) || 1),
          daysOfWeek: customUnit === 'week' ? customDays : undefined,
          datesOfMonth: customUnit === 'month' ? customDates : undefined,
        },
      };
    }
    if (PRESETS_NEEDING_WEEKDAY.includes(preset)) return { preset, weekday };
    return { preset };
  };

  const buildSnooze = (): SnoozeSetting =>
    snoozePreset === 'custom'
      ? {
          preset: snoozePreset,
          customAmount: Math.max(1, parseInt(snoozeAmount, 10) || 1),
          customUnit: snoozeUnit,
        }
      : { preset: snoozePreset };

  const save = () => {
    if (!canSave || !assigneeId) return;

    const fields = {
      title: title.trim(),
      room: room.trim() || undefined,
      notes: notes.trim() || undefined,
      assigneeId,
      points,
      reminderTime,
      recurrence: buildRecurrence(),
      defaultSnooze: buildSnooze(),
    };

    if (existing) updateChore(existing.id, fields);
    else addChore({ ...fields, startDate: today });

    router.back();
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(strings.form.deleteTitle(existing.title), strings.form.deleteMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      {
        text: strings.form.confirmDelete,
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
      <Stack.Screen
        options={{ title: existing ? strings.form.editTitle : strings.form.newTitle }}
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TextField
          label={strings.form.name}
          value={title}
          onChangeText={setTitle}
          placeholder={strings.form.namePlaceholder}
          autoFocus={!existing}
        />

        <TextField
          label={strings.form.room}
          value={room}
          onChangeText={setRoom}
          placeholder={strings.form.roomPlaceholder}
        />

        <View style={styles.group}>
          <Text style={styles.label}>{strings.form.frequency}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => setFrequencyOpen(true)}
            style={({ pressed }) => [styles.selector, pressed && styles.pressed]}
          >
            <Ionicons name="repeat-outline" size={18} color={colors.primary} />
            <Text style={styles.selectorText}>{describeRecurrence(buildRecurrence())}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.textFaint} />
          </Pressable>
        </View>

        {PRESETS_NEEDING_WEEKDAY.includes(preset) ? (
          <View style={styles.group}>
            <Text style={styles.label}>{strings.form.weekday}</Text>
            <View style={styles.chipRow}>
              {WEEKDAY_LABELS.map((dayLabel, index) => (
                <Chip
                  key={dayLabel}
                  label={dayLabel}
                  selected={weekday === index}
                  onPress={() => setWeekday(index)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {preset === 'custom' ? (
          <View style={styles.group}>
            <Text style={styles.label}>{strings.form.customUnit}</Text>
            <View style={styles.chipRow}>
              {CUSTOM_UNITS.map((unit) => (
                <Chip
                  key={unit}
                  label={strings.units[unit]}
                  selected={customUnit === unit}
                  onPress={() => setCustomUnit(unit)}
                />
              ))}
            </View>
            <TextField
              label={strings.form.customUnit}
              value={customInterval}
              onChangeText={setCustomInterval}
              keyboardType="number-pad"
              placeholder="1"
            />

            {customUnit === 'week' ? (
              <View style={styles.group}>
                <Text style={styles.label}>{strings.form.customDays}</Text>
                <View style={styles.chipRow}>
                  {WEEKDAY_LABELS.map((dayLabel, index) => (
                    <Chip
                      key={dayLabel}
                      label={dayLabel}
                      selected={customDays.includes(index)}
                      onPress={() => setCustomDays((current) => toggle(current, index))}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {customUnit === 'month' ? (
              <View style={styles.group}>
                <Text style={styles.label}>{strings.form.customDates}</Text>
                <View style={styles.chipRow}>
                  {MONTH_DATES.map((date) => (
                    <Chip
                      key={date}
                      label={String(date)}
                      selected={customDates.includes(date)}
                      onPress={() => setCustomDates((current) => toggle(current, date))}
                    />
                  ))}
                </View>
                <Text style={styles.hint}>{strings.form.customDatesHint}</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <TimeField
          label={strings.form.reminderTime}
          value={reminderTime}
          onChange={setReminderTime}
        />

        <View style={styles.group}>
          <Text style={styles.label}>{strings.form.snooze}</Text>
          <View style={styles.chipRow}>
            {SNOOZE_PRESETS.map((id) => (
              <Chip
                key={id}
                label={strings.snooze[id]}
                selected={snoozePreset === id}
                onPress={() => setSnoozePreset(id)}
              />
            ))}
          </View>
          {snoozePreset === 'custom' ? (
            <>
              <TextField
                label={strings.form.snoozeCustomAmount}
                value={snoozeAmount}
                onChangeText={setSnoozeAmount}
                keyboardType="number-pad"
                placeholder="2"
              />
              <View style={styles.chipRow}>
                <Chip
                  label={strings.units.hour}
                  selected={snoozeUnit === 'hour'}
                  onPress={() => setSnoozeUnit('hour')}
                />
                <Chip
                  label={strings.units.day}
                  selected={snoozeUnit === 'day'}
                  onPress={() => setSnoozeUnit('day')}
                />
              </View>
            </>
          ) : null}
          <Text style={styles.hint}>{describeSnooze(buildSnooze())}</Text>
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>{strings.form.assignee}</Text>
          {!hasMembers ? (
            <Text style={styles.hint}>{strings.form.noMembers}</Text>
          ) : (
            <>
              <View style={styles.chipRow}>
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
              {!assigneeId ? (
                <Text style={styles.required}>{strings.form.assigneeRequired}</Text>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.label}>{strings.form.points}</Text>
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
          label={strings.form.notes}
          value={notes}
          onChangeText={setNotes}
          placeholder={strings.form.notesPlaceholder}
          multiline
          style={styles.notes}
        />

        <View style={styles.actions}>
          <Button
            label={existing ? strings.form.save : strings.form.create}
            onPress={save}
            disabled={!canSave}
          />
          {existing ? (
            <>
              <Button
                label={existing.archived ? strings.form.unarchive : strings.form.archive}
                variant="secondary"
                onPress={() => {
                  updateChore(existing.id, { archived: !existing.archived });
                  router.back();
                }}
              />
              <Button label={strings.form.delete} variant="danger" onPress={confirmDelete} />
            </>
          ) : null}
        </View>
      </ScrollView>

      <FrequencySheet
        visible={frequencyOpen}
        selected={preset}
        onClose={() => setFrequencyOpen(false)}
        onSelect={setPreset}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  group: { gap: spacing.sm },
  label: { ...typography.label },
  hint: { ...typography.caption },
  required: { ...typography.caption, color: colors.danger, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  selector: {
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
  selectorText: { ...typography.body, fontWeight: '600', flex: 1 },
  pressed: { opacity: 0.85 },
  notes: { minHeight: 96, textAlignVertical: 'top', paddingTop: spacing.md },
  actions: { gap: spacing.md, marginTop: spacing.sm },
});
