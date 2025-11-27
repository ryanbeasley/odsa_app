import { StyleSheet } from 'react-native';
import { colors, spacing } from '../styles/theme';

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
  sectionCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  announcementBody: {
    gap: spacing.xs,
  },
  announcementItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.xs,
  },
  timestamp: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  message: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 22,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 14,
    fontStyle: 'italic',
  },
  info: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  linkButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(56,106,203,0.08)',
  },
  linkButtonLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  error: {
    color: colors.error,
    fontSize: 13,
  },
  linkText: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  loadingMoreIndicator: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  linkActionButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  linkActionLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  cancelButtonLabel: {
    color: colors.text,
    fontWeight: '600',
  },
});
