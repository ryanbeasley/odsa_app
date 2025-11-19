import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import appConfig from '../../app.json';
import { SectionCard } from '../components/SectionCard';
import { colors, radii, spacing } from '../styles/theme';
import { User } from '../types';
import { useSupportLinks } from '../hooks/useSupportLinks';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';

type SupportDetailsScreenProps = {
  token: string | null;
  onLogout: () => void;
  canToggleAdmin: boolean;
  isAdminView: boolean;
  onToggleAdmin: () => void;
};

const appVersion = (appConfig as { expo?: { version?: string } }).expo?.version ?? '1.0.0';

export function SupportDetailsScreen({ token, onLogout, canToggleAdmin, isAdminView, onToggleAdmin }: SupportDetailsScreenProps) {
  const {
    links,
    loading: linksLoading,
    saving: linksSaving,
    removingId,
    reordering,
    error: linksError,
    setError: setLinksError,
    createLink,
    updateLink,
    deleteLink,
    reorderLinks,
  } = useSupportLinks(token);
  const [formState, setFormState] = useState({ title: '', description: '', link: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const isEditing = editingId !== null;
  const canSubmitLink = useMemo(() => {
    return Boolean(formState.title.trim() && formState.description.trim() && formState.link.trim());
  }, [formState.description, formState.link, formState.title]);

  const handleLinkPress = (href: string) => {
    Linking.openURL(href).catch(() => {
      Alert.alert('Unable to open link', `Try again or copy this address:\n${href}`);
    });
  };

  const handleStartEdit = (link: { id: number; title: string; description: string; link: string }) => {
    setEditingId(link.id);
    setFormState({
      title: link.title,
      description: link.description,
      link: link.link,
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setFormState({ title: '', description: '', link: '' });
  };

  const handleSubmitLink = async () => {
    if (!canSubmitLink || linksSaving) {
      return;
    }
    try {
      if (isEditing && editingId) {
        await updateLink(editingId, {
          title: formState.title.trim(),
          description: formState.description.trim(),
          link: formState.link.trim(),
        });
      } else {
        await createLink({
          title: formState.title.trim(),
          description: formState.description.trim(),
          link: formState.link.trim(),
        });
      }
      resetForm();
    } catch {
      // error handled in hook
    }
  };

  const handleDeleteLink = async (id: number) => {
    try {
      await deleteLink(id);
      if (editingId === id) {
        resetForm();
      }
    } catch {
      // error handled in hook
    }
  };

  const handleMoveLink = async (id: number, direction: 'up' | 'down') => {
    const currentIndex = links.findIndex((link) => link.id === id);
    if (currentIndex === -1) {
      return;
    }
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= links.length) {
      return;
    }

    const nextOrder = [...links];
    const [moved] = nextOrder.splice(currentIndex, 1);
    nextOrder.splice(targetIndex, 0, moved);

    try {
      await reorderLinks(nextOrder.map((link) => link.id));
    } catch {
      // error handled in hook
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Support & app details</Text>
          <Text style={styles.sectionDescription}>
            Find help fast and keep the app tidy. Admins can edit what members see.
          </Text>

          <View style={styles.navPanel}>
            {linksLoading ? (
              <ActivityIndicator color={colors.primary} />
            ) : links.length ? (
              links.map((link, index) =>
                isAdminView && canToggleAdmin ? (
                  <View key={link.id} style={[styles.navItem, styles.adminNavItem]}>
                    <TouchableOpacity
                      style={styles.navItemContent}
                      activeOpacity={0.85}
                      onPress={() => handleLinkPress(link.link)}
                    >
                      <Feather name="external-link" size={18} color={colors.text} />
                      <View style={styles.navTextGroup}>
                        <Text style={styles.navLabel}>{link.title}</Text>
                        <Text style={styles.navDescription}>{link.description}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.adminActions}>
                      <TouchableOpacity
                        style={[styles.chipButton, styles.reorderChip]}
                        onPress={() => handleMoveLink(link.id, 'up')}
                        disabled={reordering || index === 0}
                      >
                        <Feather
                          name="arrow-up"
                          size={14}
                          color={reordering || index === 0 ? colors.textMuted : colors.text}
                        />
                        <Text
                          style={[
                            styles.chipLabel,
                            reordering || index === 0 ? styles.chipLabelMuted : null,
                          ]}
                        >
                          Up
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chipButton, styles.reorderChip]}
                        onPress={() => handleMoveLink(link.id, 'down')}
                        disabled={reordering || index === links.length - 1}
                      >
                        <Feather
                          name="arrow-down"
                          size={14}
                          color={reordering || index === links.length - 1 ? colors.textMuted : colors.text}
                        />
                        <Text
                          style={[
                            styles.chipLabel,
                            reordering || index === links.length - 1 ? styles.chipLabelMuted : null,
                          ]}
                        >
                          Down
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.chipButton}
                        onPress={() => handleStartEdit(link)}
                        disabled={linksSaving || reordering}
                      >
                        <Feather name="edit-3" size={14} color={colors.text} />
                        <Text style={styles.chipLabel}>Edit</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chipButton, styles.deleteChip]}
                        onPress={() => handleDeleteLink(link.id)}
                        disabled={linksSaving || reordering || removingId === link.id}
                      >
                        {removingId === link.id ? (
                          <ActivityIndicator size="small" color={colors.error} />
                        ) : (
                          <>
                            <Feather name="trash-2" size={14} color={colors.error} />
                            <Text style={[styles.chipLabel, styles.deleteChipLabel]}>Remove</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    key={link.id}
                    style={styles.navItem}
                    activeOpacity={0.85}
                    onPress={() => handleLinkPress(link.link)}
                  >
                    <View style={styles.navItemContent}>
                      <Feather name="external-link" size={18} color={colors.text} />
                      <View style={styles.navTextGroup}>
                        <Text style={styles.navLabel}>{link.title}</Text>
                        <Text style={styles.navDescription}>{link.description}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              )
            ) : (
              <Text style={styles.lockedCopy}>No support links yet.</Text>
            )}

            {linksError ? <Text style={styles.errorText}>{linksError}</Text> : null}

            <View style={styles.navItem}>
              <View style={styles.navItemContent}>
                <Feather name="smartphone" size={18} color={colors.text} />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>App version</Text>
                  <Text style={styles.navDescription}>You are running {appVersion}.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={onLogout} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather name="log-out" size={18} color={colors.error} />
                <Text style={[styles.navLabel, styles.logoutLabel]}>Log out</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>

          {isAdminView && canToggleAdmin ? (
            <View style={styles.editCard}>
              <Text style={styles.sectionLabel}>{isEditing ? 'Edit link' : 'Add a support link'}</Text>
              <Text style={styles.sectionDescription}>
                Links added here will be visible to all members in Support & app details.
              </Text>
              <TextField
                placeholder="Title"
                value={formState.title}
                onChangeText={(value) => {
                  setLinksError(null);
                  setFormState((prev) => ({ ...prev, title: value }));
                }}
              />
              <TextField
                placeholder="Description"
                value={formState.description}
                onChangeText={(value) => {
                  setLinksError(null);
                  setFormState((prev) => ({ ...prev, description: value }));
                }}
                multiline
                style={styles.multilineInput}
              />
              <TextField
                placeholder="Link (https://...)"
                value={formState.link}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={(value) => {
                  setLinksError(null);
                  setFormState((prev) => ({ ...prev, link: value }));
                }}
              />
              {linksError ? <Text style={styles.errorText}>{linksError}</Text> : null}
              <PrimaryButton
                label={isEditing ? 'Save changes' : 'Add link'}
                onPress={handleSubmitLink}
                loading={linksSaving}
                disabled={!canSubmitLink || linksSaving}
              />
              {isEditing ? (
                <SecondaryButton label="Cancel edit" onPress={resetForm} />
              ) : null}
            </View>
          ) : null}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  adminNavItem: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  adminActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
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
  logoutItem: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
  },
  logoutLabel: {
    color: colors.error,
  },
  lockedCopy: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
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
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  chipLabelMuted: {
    color: colors.textMuted,
  },
  deleteChip: {
    borderColor: colors.error,
    backgroundColor: colors.surface,
  },
  deleteChipLabel: {
    color: colors.error,
  },
  reorderChip: {
    backgroundColor: colors.surfaceAlt,
  },
  editCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  multilineInput: {
    minHeight: 64,
  },
  tinyButton: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tinyButtonLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
});
