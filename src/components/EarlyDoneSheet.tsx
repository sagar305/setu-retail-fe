import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { OptionRow } from './OptionRow';
import { Sheet } from './Sheet';
import { strings } from '@/i18n/strings';
import { DateKey, addDays, formatDay, formatRelativeDay, todayKey } from '@/lib/dates';
import { advanceFrom } from '@/lib/schedule';
import { colors, radius, spacing, typography } from '@/theme';
import type { Chore } from '@/types';

interface EarlyDoneSheetProps {
  visible: boolean;
  chore: Chore;
  onClose: () => void;
  onConfirm: (completedOn: DateKey) => void;
}

/** How many days back the quick picks go before falling back to a list. */
const RECENT_DAYS = 14;

/**
 * Records a rolling chore as done on a day of the user's choosing, and shows
 * what that does to the next occurrence before they commit.
 */
export function EarlyDoneSheet({ visible, chore, onClose, onConfirm }: EarlyDoneSheetProps) {
  const today = todayKey();
  const [selected, setSelected] = useState<DateKey>(today);

  const options = useMemo(
    () => Array.from({ length: RECENT_DAYS }, (_, i) => addDays(today, -i)),
    [today],
  );

  // Shown live so the consequence of the chosen date is never a surprise.
  const nextDue = advanceFrom(chore.recurrence, selected);

  return (
    <Sheet visible={visible} title={strings.earlyDone.title} onClose={onClose}>
      {options.map((date) => (
        <OptionRow
          key={date}
          label={formatRelativeDay(date, today)}
          description={formatDay(date)}
          selected={selected === date}
          onPress={() => setSelected(date)}
        />
      ))}

      {nextDue ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            {strings.earlyDone.help(formatDay(nextDue))}
          </Text>
        </View>
      ) : null}

      <Button
        label={strings.earlyDone.confirm}
        onPress={() => onConfirm(selected)}
        style={styles.confirm}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  previewText: { ...typography.body, color: colors.primary, fontWeight: '600' },
  confirm: { marginTop: spacing.md },
});
