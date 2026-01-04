import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors } from '../styles/theme';
import { styles } from './WorkingGroupsScreen.styles';
import { useAppData } from '../providers/AppDataProvider';
import { useAuth } from '../hooks/useAuth';

/**
 * Admin/member view for browsing and managing working groups.
 */
export function WorkingGroupsScreen() {
  const { groups: groupsState } = useAppData();
  const { isViewingAsAdmin } = useAuth();
  const groups = groupsState.groups;
  const loading = groupsState.loading;
  const saving = groupsState.saving;
  const error = groupsState.error;
  const isAdmin = isViewingAsAdmin;
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({ name: '', description: '', members: '' });
  const [editingId, setEditingId] = useState<number | null>(null);
  const formToggleLabel = showForm ? 'Hide form' : editingId ? 'Edit working group' : 'Add working group';

  /**
   * Ensures the admin form is filled out before enabling submission.
   */
  const canSubmit = useMemo(() => {
    return Boolean(formState.name.trim() && formState.description.trim() && formState.members.trim() && !saving);
  }, [formState.description, formState.members, formState.name, saving]);

  /**
   * Creates or updates a working group based on the form state.
   */
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
        await groupsState.updateGroup(editingId, payload);
      } else {
        await groupsState.createGroup(payload);
      }
      resetForm();
    } catch {
      // error handled upstream
    }
  };

  /**
   * Clears the form and hides the admin editor.
   */
  const resetForm = () => {
    setFormState({ name: '', description: '', members: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const startEditForm = (group: typeof groups[number]) => {
    setFormState({
      name: group.name,
      description: group.description,
      members: group.members,
    });
    setEditingId(group.id);
    setShowForm(true);
  };

  /**
   * Confirms and deletes a working group along with its events.
   */
  const handleDeleteGroup = (id: number, name: string) => {
    Alert.alert(
      'Delete working group',
      `Deleting "${name}" will also remove all of its events. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            groupsState.deleteGroup(id);
          },
        },
      ]
    );
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
            <WorkingGroupForm
              showForm={showForm}
              formToggleLabel={formToggleLabel}
              toggleForm={() => setShowForm((prev) => !prev)}
              formState={formState}
              setFormState={setFormState}
              error={error}
              editingId={editingId}
              saving={saving}
              canSubmit={canSubmit}
              onCancel={resetForm}
              onSubmit={handleSubmit}
            />
          ) : null}

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : groups.length ? (
            <View style={styles.groupList}>
              {groups.map((group) => (
                <WorkingGroupCard
                  key={group.id}
                  group={group}
                  isAdmin={isAdmin}
                  onEdit={() => startEditForm(group)}
                  onDelete={() => handleDeleteGroup(group.id, group.name)}
                />
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

type AppData = ReturnType<typeof useAppData>;
type WorkingGroup = AppData['groups']['groups'][number];

type FormState = {
  name: string;
  description: string;
  members: string;
};

type WorkingGroupFormProps = {
  showForm: boolean;
  formToggleLabel: string;
  toggleForm: () => void;
  formState: FormState;
  setFormState: React.Dispatch<React.SetStateAction<FormState>>;
  error: string | null;
  editingId: number | null;
  saving: boolean;
  canSubmit: boolean;
  onCancel: () => void;
  onSubmit: () => void;
};

function WorkingGroupForm({
  showForm,
  formToggleLabel,
  toggleForm,
  formState,
  setFormState,
  error,
  editingId,
  saving,
  canSubmit,
  onCancel,
  onSubmit,
}: WorkingGroupFormProps) {
  return (
    <View style={styles.adminPanel}>
      <TouchableOpacity
        style={styles.adminToggle}
        onPress={toggleForm}
        activeOpacity={0.85}
      >
        <View style={styles.adminToggleContent}>
          <Feather name={showForm ? 'minus-square' : 'plus-square'} size={18} color={colors.text} />
          <Text style={styles.adminToggleLabel}>{formToggleLabel}</Text>
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
            <SecondaryButton label="Cancel" onPress={onCancel} style={styles.formButton} />
            <PrimaryButton
              label={editingId ? 'Update' : 'Save'}
              onPress={onSubmit}
              disabled={!canSubmit}
              loading={saving}
              style={styles.formButton}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

type WorkingGroupCardProps = {
  group: WorkingGroup;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
};

function WorkingGroupCard({ group, isAdmin, onEdit, onDelete }: WorkingGroupCardProps) {
  return (
    <View style={styles.groupItem}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupName}>{group.name}</Text>
        <Text style={styles.groupDate}>{formatTimestamp(group.createdAt)}</Text>
      </View>
      <Text style={styles.groupDescription}>{group.description}</Text>
      <Text style={styles.groupMembersLabel}>Committee members</Text>
      <Text style={styles.groupMembers}>{group.members}</Text>
      {isAdmin ? (
        <View style={styles.groupActions}>
          <ActionButton icon="edit-2" label="Edit" onPress={onEdit} />
          <ActionButton icon="trash-2" label="Delete" onPress={onDelete} danger />
        </View>
      ) : null}
    </View>
  );
}

type ActionButtonProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
};

function ActionButton({ icon, label, onPress, danger = false }: ActionButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.editButton, danger && styles.deleteButton]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Feather name={icon} size={14} color={danger ? colors.error : colors.text} />
      <Text style={[styles.editLabel, danger && styles.deleteLabel]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Formats a timestamp for the working group list.
 */
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
