import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  section: {
    gap: spacing.md,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  backLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  description: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    color: colors.error,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableHeaderText: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  tableBody: {
    gap: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    gap: spacing.sm,
  },
  emailColumn: {
    flex: 1,
  },
  adminColumn: {
    width: 80,
    textAlign: 'right',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
  },
  emailText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  nameText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  selfText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyState: {
    fontSize: 14,
    color: colors.textMuted,
    padding: spacing.md,
  },
});
