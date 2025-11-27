import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  section: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sectionDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  adminPanel: {
    gap: spacing.sm,
  },
  adminToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
  },
  adminToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  adminToggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  form: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  formButton: {
    flex: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  groupList: {
    gap: spacing.md,
  },
  groupItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  groupName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  groupDate: {
    fontSize: 12,
    color: colors.textMuted,
  },
  groupDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  groupMembersLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupMembers: {
    fontSize: 14,
    color: colors.text,
  },
  groupActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  deleteButton: {
    borderColor: colors.error,
    backgroundColor: '#fdecec',
  },
  deleteLabel: {
    color: colors.error,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
