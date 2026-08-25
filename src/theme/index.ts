export const colors = {
  background: '#F6F7FB',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F7',
  border: '#E2E5EF',
  text: '#161A2B',
  textMuted: '#6B7189',
  textFaint: '#9AA0B4',
  primary: '#5B7CFA',
  primarySoft: '#E8EDFF',
  success: '#1FA971',
  successSoft: '#E3F6ED',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#E08700',
  warningSoft: '#FFF3DE',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 20, fontWeight: '700' as const, color: colors.text },
  subheading: { fontSize: 15, fontWeight: '600' as const, color: colors.textMuted },
  body: { fontSize: 15, fontWeight: '400' as const, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textMuted },
  caption: { fontSize: 12, fontWeight: '500' as const, color: colors.textFaint },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0C1330',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
} as const;
