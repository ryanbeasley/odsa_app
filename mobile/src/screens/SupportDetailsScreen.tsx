import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import appConfig from '../../app.json';
import { SectionCard } from '../components/SectionCard';
import { colors } from '../styles/theme';
import { useSupportLinks } from '../hooks/useSupportLinks';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { styles } from './SupportDetailsScreen.styles';
import { useAuth } from '../hooks/useAuth';
import { useLogoutHandler } from '../hooks/useLogoutHandler';

const appVersion = (appConfig as { expo?: { version?: string } }).expo?.version ?? '1.0.0';

/**
 * Screen that lists support resources and lets admins manage those links.
 */
export function SupportDetailsScreen() {
  const auth = useAuth();
  const handleLogout = useLogoutHandler();
  const token = auth.token;
  const canToggleAdmin = auth.isSessionAdmin;
  const isAdminView = auth.isViewingAsAdmin;
  const onToggleAdmin = auth.toggleAdminMode;
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
  /**
   * Determines whether the admin link form has valid data.
   */
  const canSubmitLink = useMemo(() => {
    return Boolean(formState.title.trim() && formState.description.trim() && formState.link.trim());
  }, [formState.description, formState.link, formState.title]);

  /**
   * Opens a support link, showing an alert if it cannot be opened.
   */
  const handleLinkPress = (href: string) => {
    Linking.openURL(href).catch(() => {
      Alert.alert('Unable to open link', `Try again or copy this address:\n${href}`);
    });
  };

  /**
   * Populates the form with an existing link so it can be edited.
   */
  const handleStartEdit = (link: { id: number; title: string; description: string; link: string }) => {
    setEditingId(link.id);
    setFormState({
      title: link.title,
      description: link.description,
      link: link.link,
    });
  };

  /**
   * Clears form fields and exits edit mode.
   */
  const resetForm = () => {
    setEditingId(null);
    setFormState({ title: '', description: '', link: '' });
  };

  /**
   * Creates or updates a support link depending on whether we are editing.
   */
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

  /**
   * Removes a support link (and resets the form if it was being edited).
   */
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

  /**
   * Reorders a support link up or down within the list.
   */
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

            <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.8}>
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
