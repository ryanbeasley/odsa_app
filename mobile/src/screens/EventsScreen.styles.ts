import { StyleSheet } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl * 3,
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
  groupPicker: {
    gap: spacing.xs,
  },
  groupPickerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  groupHint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  listItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  itemDate: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  attendeeCount: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  metaValue: {
    fontSize: 14,
    color: colors.text,
  },
  metaLink: {
    fontSize: 14,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  seriesBox: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  seriesList: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  occurrenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  occurrenceRight: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  occurrencePill: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: '#f0f5ff',
  },
  occurrenceText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  occurrenceCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs / 2,
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  occurrenceCountText: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  occurrenceAttendButton: {
    paddingVertical: spacing.xs / 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  occurrenceAttendButtonActive: {
    borderColor: '#badbcc',
    backgroundColor: '#d1e7dd',
  },
  occurrenceAttendLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  occurrenceAttendLabelActive: {
    color: '#0f5132',
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
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  adminActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
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
  copyButton: {
    backgroundColor: colors.surface,
  },
  copyLabel: {
    color: colors.text,
  },
  calendarButton: {
    backgroundColor: colors.surfaceAlt,
  },
  attendingButton: {
    backgroundColor: '#d1e7dd',
    borderColor: '#badbcc',
  },
  signUpButton: {
    backgroundColor: colors.surfaceAlt,
  },
  attendingLabel: {
    color: '#0f5132',
  },
  signUpLabel: {
    color: colors.text,
  },
  emptyState: {
    color: colors.textMuted,
    fontSize: 14,
  },
  filterPanel: {
    gap: spacing.sm,
  },
  focusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
  focusBannerText: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  focusBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  focusBannerDescription: {
    fontSize: 12,
    color: colors.textMuted,
  },
  focusClearButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs / 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  focusClearLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
  },
  pickerButtonLabel: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  webInputWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  webDateInput: {
    width: '100%',
    height: 36,
    fontSize: 14,
    color: colors.text,
    borderWidth: 0,
    outlineWidth: 0,
    backgroundColor: 'transparent',
  },
  seriesToggle: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkboxLabel: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  seriesControls: {
    gap: spacing.sm,
  },
  monthlyPatternWrapper: {
    gap: spacing.sm,
  },
  monthlyOptions: {
    gap: spacing.xs,
  },
  monthlyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  monthlyOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#f0f5ff',
  },
  monthlyOptionCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  monthlyOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  monthlyOptionDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  modalMessage: {
    fontSize: 14,
    color: colors.textMuted,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalButton: {
    flex: 1,
  },
  modalClose: {
    marginTop: spacing.sm,
    alignSelf: 'center',
  },
  modalCloseText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
