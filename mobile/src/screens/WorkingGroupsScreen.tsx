import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors, radii, spacing } from '../styles/theme';
import { WorkingGroup } from '../types';

type WorkingGroupsScreenProps = {
  groups: WorkingGroup[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAdmin: boolean;
  onRefresh: () => void;
  onCreate: (payload: { name: string; description: string; members: string }) => Promise<void>;
  onUpdate: (id: number, payload: { name: string; description: string; members: string }) => Promise<void>;
};

export function WorkingGroupsScreen({
  groups,
  loading,
  saving,
  error,
  isAdmin,
  onRefresh,
  onCreate,
  onUpdate,
}: WorkingGroupsScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({ name: '', description: '', members: '' });
  const [editingId, setEditingId] = useState<number | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(formState.name.trim() && formState.description.trim() && formState.members.trim() && !saving);
  }, [formState.description, formState.members, formState.name, saving]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        members: formState.members.trim(),
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      handleResetForm();
    } catch {
      // error handled upstream
    }
  };

  const handleResetForm = () => {
    setFormState({ name: '', description: '', members: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Working Groups</Text>
          <Text style={styles.sectionDescription}>
            Browse chapter working groups, their focus areas, and who is on the committee.
          </Text>

          {isAdmin ? (
            <View style={styles.adminPanel}>
              <TouchableOpacity
                style={styles.adminToggle}
                onPress={() => setShowForm((prev) => !prev)}
                activeOpacity={0.85}
              >
                <View style={styles.adminToggleContent}>
                  <Feather name={showForm ? 'minus-square' : 'plus-square'} size={18} color={colors.text} />
                  <Text style={styles.adminToggleLabel}>
                    {showForm ? 'Hide form' : editingId ? 'Edit working group' : 'Add working group'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              {showForm ? (
                <View style={styles.form}>
                  <TextField
                    label="Name"
                    value={formState.name}
                    onChangeText={(value) => setFormState((prev) => ({ ...prev, name: value }))}
                    placeholder="E.g., Electoral, Political Education"
                  />
                  <TextField
                    label="Description"
                    value={formState.description}
                    onChangeText={(value) => setFormState((prev) => ({ ...prev, description: value }))}
                    placeholder="What this working group does"
                    multiline
                    style={styles.textArea}
                  />
                  <TextField
                    label="Committee members"
                    value={formState.members}
                    onChangeText={(value) => setFormState((prev) => ({ ...prev, members: value }))}
                    placeholder="List first + last names (comma-separated)"
                    multiline
                    style={styles.textArea}
                  />
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.formActions}>
                    <SecondaryButton label="Cancel" onPress={handleResetForm} style={styles.formButton} />
                    <PrimaryButton
                      label={editingId ? 'Update' : 'Save'}
                      onPress={handleSubmit}
                      disabled={!canSubmit}
                      loading={saving}
                      style={styles.formButton}
                    />
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : groups.length ? (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <View key={group.id} style={styles.groupItem}>
                  <View style={styles.groupHeader}>
                    <Text style={styles.groupName}>{group.name}</Text>
                    <Text style={styles.groupDate}>{formatTimestamp(group.createdAt)}</Text>
                  </View>
                  <Text style={styles.groupDescription}>{group.description}</Text>
                  <Text style={styles.groupMembersLabel}>Committee members</Text>
                  <Text style={styles.groupMembers}>{group.members}</Text>
                  {isAdmin ? (
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={() => {
                        setFormState({
                          name: group.name,
                          description: group.description,
                          members: group.members,
                        });
                        setEditingId(group.id);
                        setShowForm(true);
                      }}
                      activeOpacity={0.85}
                    >
                      <Feather name="edit-2" size={14} color={colors.text} />
                      <Text style={styles.editLabel}>Edit</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyState}>No working groups yet.</Text>
          )}
        </SectionCard>
      </ScrollView>
    </View>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
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
  emptyState: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
