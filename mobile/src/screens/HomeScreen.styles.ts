import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  greetingCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  greetingSubcopy: {
    color: colors.textMuted,
    fontSize: 13,
  },
  roleTag: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  info: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  tileGrid: {
    gap: spacing.sm,
  },
  tile: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tileDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
