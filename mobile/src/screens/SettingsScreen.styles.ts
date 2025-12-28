import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 14,
    color: colors.textMuted,
  },
  navPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 120,
  },
  navItem: {
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  navTextGroup: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  navDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadgeMuted: {
    backgroundColor: colors.border,
    color: colors.textMuted,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  statusHint: {
    color: colors.textMuted,
    fontSize: 12,
  },
  logoutItem: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
  },
  logoutLabel: {
    color: colors.error,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  summaryDetail: {
    fontSize: 13,
    color: colors.textMuted,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeMuted: {
    backgroundColor: colors.border,
    color: colors.textMuted,
  },
});
