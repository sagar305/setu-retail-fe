import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Avatar, Button, EmptyState, Screen, SectionHeader } from '@/components';
import { strings } from '@/i18n/strings';
import { todayKey } from '@/lib/dates';
import { useAuth } from '@/auth/AuthProvider';
import { useChores } from '@/store/ChoresProvider';
import { memberStats } from '@/store/selectors';
import { colors, radius, shadow, spacing, typography } from '@/theme';

export default function HouseholdScreen() {
  const { user, signOut } = useAuth();
  const { data, ready, household, removeMember, rotateInviteCode, pendingWrites } = useChores();
  const [copied, setCopied] = useState(false);
  const today = todayKey();

  const stats = useMemo(() => memberStats(data, today), [data, today]);
  const isOwner = household?.ownerId === user?.id;

  const copyCode = async () => {
    if (!household) return;
    await Clipboard.setStringAsync(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmRotate = () => {
    Alert.alert(strings.household.rotateTitle, strings.household.rotateMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      {
        text: strings.household.rotate,
        style: 'destructive',
        onPress: () => {
          void rotateInviteCode().catch((error: Error) =>
            Alert.alert(strings.household.rotateTitle, error.message),
          );
        },
      },
    ]);
  };

  const confirmRemove = (userId: string, memberName: string) => {
    Alert.alert(strings.household.removeTitle(memberName), strings.household.removeMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      {
        text: strings.form.confirmRemove,
        style: 'destructive',
        onPress: () => {
          // The server refuses while they still hold chores, and explains why.
          void removeMember(userId).catch((error: Error) =>
            Alert.alert(strings.household.removeTitle(memberName), error.message),
          );
        },
      },
    ]);
  };

  const confirmSignOut = () => {
    Alert.alert(strings.auth.signOutTitle, strings.auth.signOutMessage, [
      { text: strings.form.cancel, style: 'cancel' },
      { text: strings.auth.signOut, style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  if (!ready) return <Screen />;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[typography.title, styles.pageTitle]}>
          {household?.name ?? strings.household.title}
        </Text>

        {pendingWrites > 0 ? (
          <View style={styles.pending}>
            <Ionicons name="cloud-offline-outline" size={16} color={colors.warning} />
            <Text style={styles.pendingText}>
              {strings.household.pendingWrites(pendingWrites)}
            </Text>
          </View>
        ) : null}

        <SectionHeader title={strings.household.inviteHeading} />
        <View style={styles.inviteCard}>
          <Text style={styles.code} accessibilityLabel={household?.inviteCode}>
            {household?.inviteCode ?? '—'}
          </Text>
          <Text style={styles.inviteHelp}>{strings.household.inviteHelp}</Text>
          <View style={styles.inviteActions}>
            <Button
              label={copied ? strings.household.copied : strings.household.copy}
              variant="secondary"
              onPress={copyCode}
              style={styles.inviteButton}
            />
            {isOwner ? (
              <Button
                label={strings.household.rotate}
                variant="ghost"
                onPress={confirmRotate}
                style={styles.inviteButton}
              />
            ) : null}
          </View>
        </View>

        {stats.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={strings.household.emptyTitle}
            message={strings.household.inviteHelp}
          />
        ) : (
          <>
            <SectionHeader title={strings.household.statsHeading} count={stats.length} />
            <View style={styles.list}>
              {stats.map(({ member, completed, points, assigned }) => {
                const isSelf = member.id === user?.id;
                const isHouseholdOwner = member.id === household?.ownerId;

                return (
                  <View key={member.id} style={styles.row}>
                    <Avatar member={member} size={40} />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>
                        {member.name}
                        {isSelf ? ` · ${strings.household.you}` : ''}
                        {isHouseholdOwner ? ` · ${strings.household.owner}` : ''}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {strings.household.stats(completed, points, assigned)}
                      </Text>
                    </View>
                    {isOwner && !isSelf ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={strings.household.removeTitle(member.name)}
                        hitSlop={8}
                        onPress={() => confirmRemove(member.id, member.name)}
                      >
                        <Ionicons name="close-circle-outline" size={22} color={colors.textFaint} />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <SectionHeader title={strings.household.dataHeading} />
        <Button label={strings.auth.signOut} variant="danger" onPress={confirmSignOut} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  pageTitle: { paddingTop: spacing.md },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  pendingText: { ...typography.caption, color: colors.warning, fontWeight: '600', flex: 1 },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  code: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 6,
    color: colors.primary,
    textAlign: 'center',
  },
  inviteHelp: { ...typography.caption, textAlign: 'center' },
  inviteActions: { flexDirection: 'row', gap: spacing.sm },
  inviteButton: { flex: 1 },
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
