import React from 'react';
import { OptionRow } from './OptionRow';
import { Sheet } from './Sheet';
import { strings } from '@/i18n/strings';
import type { FrequencyPreset } from '@/types';

/** Order shown in the picker. */
export const FREQUENCY_PRESETS: FrequencyPreset[] = [
  'once',
  'daily',
  'alternate',
  'weekday',
  'sunday',
  'twiceMonthly',
  'monthly',
  'alternateSunday',
  'custom',
];

/** Presets that need the user to also pick a weekday. */
export const PRESETS_NEEDING_WEEKDAY: FrequencyPreset[] = ['monthly', 'twiceMonthly'];

const DESCRIPTIONS: Partial<Record<FrequencyPreset, string>> = {
  alternate: 'Har doosre din',
  weekday: 'Ravivar chhod kar',
  twiceMonthly: 'Mahine me do baar, chune hue din',
  monthly: 'Mahine me ek baar, chune hue din',
  alternateSunday: 'Har doosre Ravivar',
  custom: 'Din, hafte ya tareekh khud chunein',
};

interface FrequencySheetProps {
  visible: boolean;
  selected: FrequencyPreset;
  onClose: () => void;
  onSelect: (preset: FrequencyPreset) => void;
}

export function FrequencySheet({ visible, selected, onClose, onSelect }: FrequencySheetProps) {
  return (
    <Sheet visible={visible} title={strings.form.frequencyPick} onClose={onClose}>
      {FREQUENCY_PRESETS.map((preset) => (
        <OptionRow
          key={preset}
          label={strings.frequency[preset]}
          description={DESCRIPTIONS[preset]}
          selected={selected === preset}
          onPress={() => {
            onSelect(preset);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
