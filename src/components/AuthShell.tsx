import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@/theme';

interface AuthShellProps {
  title: string;
  subtitle: string;
  error?: string | null;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared frame for the sign-in, sign-up and reset screens. */
export function AuthShell({ title, subtitle, error, children, footer }: AuthShellProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={typography.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.fields}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.xl },
  header: { gap: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted },
  error: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { ...typography.body, color: colors.danger, fontWeight: '600' },
  fields: { gap: spacing.lg },
  footer: { gap: spacing.md, alignItems: 'center' },
});
