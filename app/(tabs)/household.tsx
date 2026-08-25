import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, EmptyState, Screen, SectionHeader } from '@/components';
import { todayKey } from '@/lib/dates';
import { useChores } from '@/store/ChoresProvider';
import { memberStats } from '@/store/selectors';
import { colors, radius, shadow, spacing, typography } from '@/theme';

export default function HouseholdScreen() {
  const { data, ready, addMember, removeMember, resetAll } = useChores();
  const [name, setName] = useState('');
  const today = todayKey();

  const stats = useMemo(() => memberStats(data, today), [data, today]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    addMember(trimmed);
    setName('');
  };

  const confirmRemove = (id: string, memberName: string) => {
    Alert.alert(
      `Remove ${memberName}?`,
      'Their chores stay, but become unassigned.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeMember(id) },
      ],
    );
  };

  const confirmReset = () => {
    Alert.alert(
      'Clear all data?',
      'This deletes every member, chore and completion on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => void resetAll() },
      ],
    );
  };

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[typography.title, styles.pageTitle]}>Household</Text>

        <View style={styles.addCard}>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder="Add someone…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            style={styles.input}
          />
          <Button label="Add" onPress={submit} disabled={!name.trim()} style={styles.addButton} />
        </View>

        {stats.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No one here yet"
            message="Add the people who share the chores. You can assign chores to them and track who does what."
          />
        ) : (
          <>
            <SectionHeader title="Last 30 days" count={stats.length} />
            <View style={styles.list}>
              {stats.map(({ member, completed, points, assigned }) => (
                <View key={member.id} style={styles.row}>
                  <Avatar member={member} size={40} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{member.name}</Text>
                    <Text style={styles.rowMeta}>
                      {completed} done · {points} pts · {assigned} assigned
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${member.name}`}
                    hitSlop={8}
                    onPress={() => confirmRemove(member.id, member.name)}
                  >
                    <Ionicons name="close-circle-outline" size={22} color={colors.textFaint} />
                  </Pressable>
                </View>
              ))}
            </View>
          </>
        )}

        <SectionHeader title="Data" />
        <Button label="Clear all data" variant="danger" onPress={confirmReset} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { paddingTop: spacing.md },
  addCard: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  addButton: { paddingHorizontal: spacing.xl },
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
});
