import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Button, EmptyState, Screen, SectionHeader } from '@/components';
import { strings } from '@/i18n/strings';
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
    // Assignee is mandatory, so someone still holding chores cannot be removed
    // until those chores are reassigned or deleted.
    const owned = data.chores.filter((c) => c.assigneeId === id && !c.archived).length;
    if (owned > 0) {
      Alert.alert(
        strings.household.removeTitle(memberName),
        strings.household.removeBlocked(memberName, owned),
        [{ text: strings.actions.close }],
      );
      return;
    }

    Alert.alert(strings.household.removeTitle(memberName), strings.household.removeMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      {
        text: strings.form.confirmRemove,
        style: 'destructive',
        onPress: () => removeMember(id),
      },
    ]);
  };

  const confirmReset = () => {
    Alert.alert(strings.household.clearTitle, strings.household.clearMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      { text: strings.form.confirmClear, style: 'destructive', onPress: () => void resetAll() },
    ]);
  };

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[typography.title, styles.pageTitle]}>{strings.household.title}</Text>

        <View style={styles.addCard}>
          <TextInput
            value={name}
            onChangeText={setName}
            onSubmitEditing={submit}
            placeholder={strings.household.addPlaceholder}
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            style={styles.input}
          />
          <Button label={strings.household.add} onPress={submit} disabled={!name.trim()} style={styles.addButton} />
        </View>

        {stats.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={strings.household.emptyTitle}
            message={strings.household.emptyMessage}
          />
        ) : (
          <>
            <SectionHeader title={strings.household.statsHeading} count={stats.length} />
            <View style={styles.list}>
              {stats.map(({ member, completed, points, assigned }) => (
                <View key={member.id} style={styles.row}>
                  <Avatar member={member} size={40} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{member.name}</Text>
                    <Text style={styles.rowMeta}>
                      {strings.household.stats(completed, points, assigned)}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={strings.household.removeTitle(member.name)}
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

        <SectionHeader title={strings.household.dataHeading} />
        <Button label={strings.household.clearAll} variant="danger" onPress={confirmReset} />
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
