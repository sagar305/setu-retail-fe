import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';
import type { Member } from '@/types';

interface AvatarProps {
  member?: Member;
  size?: number;
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export function Avatar({ member, size = 32 }: AvatarProps) {
  const dimension = { width: size, height: size, borderRadius: size / 2 };
  const background = member ? member.color : colors.surfaceMuted;

  return (
    <View style={[styles.avatar, dimension, { backgroundColor: background }]}>
      <Text
        style={[
          styles.text,
          { fontSize: size * 0.4 },
          !member && styles.unassignedText,
        ]}
      >
        {member ? initials(member.name) : '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#FFFFFF', fontWeight: '700' },
  unassignedText: { color: colors.textFaint },
});
