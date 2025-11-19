import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { colors, radii, spacing } from '../styles/theme';
import { Event, RecurrenceRule, WorkingGroup } from '../types';

type EventsScreenProps = {
  events: Event[];
  groups: WorkingGroup[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  isAdmin: boolean;
  attendingOnly: boolean;
  onToggleAttendingOnly: (value: boolean) => void;
  onRefresh: () => void;
  onCreate: (payload: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
  }) => Promise<void>;
  onUpdate: (id: number, payload: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
    recurrence?: RecurrenceRule;
    seriesEndAt?: string | null;
  }) => Promise<void>;
  onToggleAttendance: (eventId: number, options: { series: boolean; attending: boolean }) => Promise<void>;
};

export function EventsScreen({
  events,
  groups,
  loading,
  saving,
  error,
  isAdmin,
  attendingOnly,
  onToggleAttendingOnly,
  onRefresh,
  onCreate,
  onUpdate,
  onToggleAttendance,
}: EventsScreenProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formState, setFormState] = useState({
    name: '',
    description: '',
    workingGroupId: 0,
    startAt: '',
    endAt: '',
    location: '',
  });
  const [isSeries, setIsSeries] = useState(false);
  const [seriesEndAt, setSeriesEndAt] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceRule>('none');
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());
  const [search, setSearch] = useState('');
  const [filterGroupId, setFilterGroupId] = useState<number | null>(null);
  const [seriesPrompt, setSeriesPrompt] = useState<{ eventId: number; attending: boolean } | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(
      formState.name.trim() &&
      formState.description.trim() &&
      formState.location.trim() &&
      formState.startAt.trim() &&
      formState.endAt.trim() &&
      formState.workingGroupId &&
      !saving
    );
  }, [formState.description, formState.endAt, formState.location, formState.name, formState.startAt, formState.workingGroupId, saving]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      return;
    }
    try {
      const payload = {
        name: formState.name.trim(),
        description: formState.description.trim(),
        workingGroupId: formState.workingGroupId,
        startAt: formState.startAt.trim(),
        endAt: formState.endAt.trim(),
        location: formState.location.trim(),
        recurrence: isSeries ? recurrence : 'none',
        seriesEndAt: isSeries && seriesEndAt ? seriesEndAt.trim() : null,
      };
      if (editingId) {
        await onUpdate(editingId, payload);
      } else {
        await onCreate(payload);
      }
      setFormState({ name: '', description: '', workingGroupId: 0, startAt: '', endAt: '', location: '' });
      setEditingId(null);
      setIsSeries(false);
      setSeriesEndAt('');
      setRecurrence('none');
      setShowForm(false);
      onRefresh();
    } catch {
      // error handled upstream
    }
  };

  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLowerCase();
    return events
      .filter((evt) => new Date(evt.endAt).getTime() >= now)
      .filter((evt) => (attendingOnly ? Boolean(evt.attending) : true))
      .filter((evt) => (filterGroupId ? evt.workingGroupId === filterGroupId : true))
      .filter((evt) => {
        if (!query) return true;
        return evt.name.toLowerCase().includes(query) || evt.description.toLowerCase().includes(query);
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events, filterGroupId, search, attendingOnly]);

  const selectedGroup = groups.find((g) => g.id === formState.workingGroupId);

  const handlePickDate = (field: 'startAt' | 'endAt') => {
    const current = formState[field] ? new Date(formState[field]) : new Date();
    setPickerValue(current);
    setActivePicker(field === 'startAt' ? 'start' : 'end');
  };

  const toLocalInputValue = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const offsetMs = date.getTimezoneOffset() * 60000;
    const local = new Date(date.getTime() - offsetMs);
    return local.toISOString().slice(0, 16);
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setActivePicker(null);
      return;
    }
    if (date && activePicker) {
      const iso = date.toISOString();
      setFormState((prev) => ({
        ...prev,
        [activePicker === 'start' ? 'startAt' : 'endAt']: iso,
      }));
      setActivePicker(null);
    }
  };

  const handleInlineDateChange = (field: 'startAt' | 'endAt') => (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      return;
    }
    if (date) {
      const iso = date.toISOString();
      setFormState((prev) => ({
        ...prev,
        [field]: iso,
      }));
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Upcoming Events</Text>
          {showForm ? (
            <Text style={styles.sectionDescription}>
              {editingId ? 'Edit event' : 'Create a new event'}.
            </Text>
          ) : (
            <Text style={styles.sectionDescription}>
              See what&apos;s on the calendar and which working group is leading it.
            </Text>
          )}

          {!showForm ? (
            <View style={styles.filterPanel}>
              <TextField
                label="Search"
                value={search}
                onChangeText={(value) => setSearch(value)}
                placeholder="Search by name or description"
              />
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => onToggleAttendingOnly(!attendingOnly)}
                activeOpacity={0.85}
              >
                <Feather name={attendingOnly ? 'check-square' : 'square'} size={18} color={colors.text} />
                <Text style={styles.checkboxLabel}>Events I&apos;m attending</Text>
              </TouchableOpacity>
              <View style={styles.groupPicker}>
                <Text style={styles.groupPickerLabel}>Working group</Text>
                {Platform.OS === 'web' ? (
                  <View style={styles.webInputWrapper}>
                    <select
                      value={filterGroupId ?? 0}
                      onChange={(e) => setFilterGroupId(Number(e.target.value) === 0 ? null : Number(e.target.value))}
                      style={styles.webSelect as unknown as React.CSSProperties}
                    >
                      <option value={0}>All groups</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </View>
                ) : (
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={filterGroupId ?? 0}
                      style={styles.picker}
                      onValueChange={(value) => setFilterGroupId(value === 0 ? null : Number(value))}
                    >
                      <Picker.Item label="All groups" value={0} />
                      {groups.map((group) => (
                        <Picker.Item key={group.id} label={group.name} value={group.id} />
                      ))}
                    </Picker>
                  </View>
                )}
              </View>
              {isAdmin ? (
                <PrimaryButton
                  label="Add event"
                  onPress={() => {
                    setShowForm(true);
                    setEditingId(null);
                    setFormState({ name: '', description: '', workingGroupId: 0, startAt: '', endAt: '', location: '' });
                    setIsSeries(false);
                    setSeriesEndAt('');
                    setRecurrence('none');
                  }}
                />
              ) : null}
            </View>
          ) : null}

          {isAdmin && showForm ? (
            <View style={styles.adminPanel}>
              <TouchableOpacity
                style={styles.adminToggle}
                onPress={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setIsSeries(false);
                  setSeriesEndAt('');
                  setRecurrence('none');
                }}
                activeOpacity={0.85}
              >
                <View style={styles.adminToggleContent}>
                  <Feather name="arrow-left" size={18} color={colors.text} />
                  <Text style={styles.adminToggleLabel}>
                    Back to events
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
                    placeholder="Event title"
                  />
                  <TextField
                    label="Description"
                    value={formState.description}
                    onChangeText={(value) => setFormState((prev) => ({ ...prev, description: value }))}
                    placeholder="What this event is about"
                    multiline
                    style={styles.textArea}
                  />
                  <TextField
                    label="Date & time"
                    value={formState.startAt ? formatTimestamp(formState.startAt) : ''}
                    placeholder="Pick a start date/time"
                    editable={false}
                  />
                  <View style={styles.webInputWrapper}>
                    {Platform.OS === 'web' ? (
                      <input
                        type="datetime-local"
                        value={formState.startAt ? toLocalInputValue(formState.startAt) : ''}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            startAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                          }))
                        }
                        style={styles.webDateInput as unknown as React.CSSProperties}
                      />
                    ) : (
                      <TouchableOpacity style={styles.pickerButton} onPress={() => handlePickDate('startAt')}>
                        <Feather name="calendar" size={16} color={colors.text} />
                        <Text style={styles.pickerButtonLabel}>Select start</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextField
                    label="End date & time"
                    value={formState.endAt ? formatTimestamp(formState.endAt) : ''}
                    placeholder="Pick an end date/time"
                    editable={false}
                  />
                  <View style={styles.webInputWrapper}>
                    {Platform.OS === 'web' ? (
                      <input
                        type="datetime-local"
                        value={formState.endAt ? toLocalInputValue(formState.endAt) : ''}
                        onChange={(e) =>
                          setFormState((prev) => ({
                            ...prev,
                            endAt: e.target.value ? new Date(e.target.value).toISOString() : '',
                          }))
                        }
                        style={styles.webDateInput as unknown as React.CSSProperties}
                      />
                    ) : (
                      <TouchableOpacity style={styles.pickerButton} onPress={() => handlePickDate('endAt')}>
                        <Feather name="clock" size={16} color={colors.text} />
                        <Text style={styles.pickerButtonLabel}>Select end</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextField
                    label="Location or link"
                    value={formState.location}
                    onChangeText={(value) => setFormState((prev) => ({ ...prev, location: value }))}
                    placeholder="123 Main St or https://discord.gg/..."
                  />
                  <View style={styles.groupPicker}>
                    <Text style={styles.groupPickerLabel}>Working group</Text>
                    {Platform.OS === 'web' ? (
                      <View style={styles.webInputWrapper}>
                        <select
                          value={formState.workingGroupId}
                          onChange={(e) => setFormState((prev) => ({ ...prev, workingGroupId: Number(e.target.value) }))}
                          style={styles.webSelect as unknown as React.CSSProperties}
                        >
                          <option value={0}>Select a working group</option>
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </View>
                    ) : (
                      <View style={styles.pickerWrapper}>
                        <Picker
                          selectedValue={formState.workingGroupId}
                          style={styles.picker}
                        onValueChange={(value) => setFormState((prev) => ({ ...prev, workingGroupId: Number(value) }))}
                      >
                        <Picker.Item label="Select a working group" value={0} />
                        {groups.map((group) => (
                          <Picker.Item key={group.id} label={group.name} value={group.id} />
                        ))}
                      </Picker>
                    </View>
                    )}
                    {!groups.length ? (
                      <Text style={styles.groupHint}>Create a working group first to associate this event.</Text>
                    ) : (
                      <Text style={styles.groupHint}>
                        {selectedGroup ? `Selected: ${selectedGroup.name}` : 'Choose the sponsoring working group.'}
                      </Text>
                    )}
                  </View>
                  <View style={styles.seriesToggle}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      activeOpacity={0.85}
                      onPress={() => setIsSeries((prev) => !prev)}
                    >
                      <Feather name={isSeries ? 'check-square' : 'square'} size={18} color={colors.text} />
                      <Text style={styles.checkboxLabel}>Make series</Text>
                    </TouchableOpacity>
                    {isSeries ? (
                      <View style={styles.seriesControls}>
                        <Text style={styles.groupPickerLabel}>Series ends</Text>
                        <View style={styles.webInputWrapper}>
                          {Platform.OS === 'web' ? (
                            <input
                              type="datetime-local"
                              value={seriesEndAt ? toLocalInputValue(seriesEndAt) : ''}
                              onChange={(e) =>
                                setSeriesEndAt(e.target.value ? new Date(e.target.value).toISOString() : '')
                              }
                              style={styles.webDateInput as unknown as React.CSSProperties}
                            />
                          ) : (
                            <TouchableOpacity
                              style={styles.pickerButton}
                              onPress={() => {
                                setPickerValue(seriesEndAt ? new Date(seriesEndAt) : new Date());
                                setActivePicker('end');
                              }}
                            >
                              <Feather name="calendar" size={16} color={colors.text} />
                              <Text style={styles.pickerButtonLabel}>Select series end</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        <Text style={styles.groupPickerLabel}>Repeat</Text>
                        {Platform.OS === 'web' ? (
                          <View style={styles.webInputWrapper}>
                            <select
                              value={recurrence}
                              onChange={(e) => setRecurrence(e.target.value as RecurrenceRule)}
                              style={styles.webSelect as unknown as React.CSSProperties}
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                            </select>
                          </View>
                        ) : (
                          <View style={styles.pickerWrapper}>
                            <Picker
                              selectedValue={recurrence}
                              style={styles.picker}
                              onValueChange={(value) => setRecurrence(value as RecurrenceRule)}
                            >
                              <Picker.Item label="Daily" value="daily" />
                              <Picker.Item label="Weekly" value="weekly" />
                              <Picker.Item label="Monthly" value="monthly" />
                            </Picker>
                          </View>
                        )}
                      </View>
                    ) : null}
                  </View>
                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <View style={styles.formActions}>
                    <SecondaryButton
                      label="Cancel"
                      onPress={() => {
                        setShowForm(false);
                        setEditingId(null);
                        setIsSeries(false);
                        setSeriesEndAt('');
                        setRecurrence('none');
                      }}
                      style={styles.formButton}
                    />
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

          {!showForm ? (
            loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : filteredEvents.length ? (
              <View style={styles.list}>
                {filteredEvents.map((event) => (
                  <View key={event.id} style={styles.listItem}>
                    <View style={styles.itemHeader}>
                    <Text style={styles.itemName}>{event.name}</Text>
                    <View style={styles.itemMeta}>
                      <Text style={styles.itemDate}>{formatTimestamp(event.startAt)}</Text>
                      <Text style={styles.attendeeCount}>{event.attendeeCount ?? 0} attending</Text>
                    </View>
                  </View>
                    <Text style={styles.itemDescription}>{event.description}</Text>
                    <Text style={styles.metaLabel}>Working group</Text>
                    <Text style={styles.metaValue}>{event.workingGroupName ?? `#${event.workingGroupId}`}</Text>
                    <Text style={styles.metaLabel}>Location</Text>
                    <Text style={styles.metaValue}>{event.location}</Text>
                    <Text style={styles.metaLabel}>Ends</Text>
                    <Text style={styles.metaValue}>{formatTimestamp(event.endAt)}</Text>
                    {event.seriesUuid ? (
                      <Text style={styles.metaValue}>
                        Series: {event.recurrence ?? 'recurring'} {event.seriesEndAt ? `(ends ${formatTimestamp(event.seriesEndAt)})` : ''}
                      </Text>
                    ) : null}
                    {event.upcomingOccurrences && event.upcomingOccurrences.length > 1 ? (
                      <View style={styles.seriesBox}>
                        <Text style={styles.metaLabel}>More in this series</Text>
                        <View style={styles.seriesList}>
                          {event.upcomingOccurrences
                            .filter((occ) => occ.eventId !== event.id || occ.startAt !== event.startAt)
                            .map((occurrence) => {
                              const occurrenceEventId = Number(occurrence.eventId ?? event.id);
                              const occurrenceFromEvents = events.find(
                                (e) => e.id === occurrence.eventId || (e.seriesUuid === event.seriesUuid && e.startAt === occurrence.startAt)
                              );
                              const occurrenceAttending = occurrenceFromEvents?.attending ?? Boolean(occurrence.attending);
                              const occurrenceCount = occurrenceFromEvents?.attendeeCount ?? occurrence.attendeeCount ?? 0;
                              return (
                                <View key={`${occurrence.eventId ?? occurrence.startAt}`} style={styles.occurrenceRow}>
                                  <View style={styles.occurrencePill}>
                                    <Text style={styles.occurrenceText}>{formatTimestamp(occurrence.startAt)}</Text>
                                  </View>
                                  <View style={styles.occurrenceRight}>
                                    <View style={styles.occurrenceCountPill}>
                                      <Feather name="users" size={12} color={colors.text} />
                                      <Text style={styles.occurrenceCountText}>{occurrenceCount}</Text>
                                    </View>
                                    <TouchableOpacity
                                      style={[
                                        styles.occurrenceAttendButton,
                                        occurrenceAttending && styles.occurrenceAttendButtonActive,
                                      ]}
                                      onPress={() => {
                                        if (!occurrenceEventId) return;
                                        void onToggleAttendance(occurrenceEventId, {
                                          series: false,
                                          attending: occurrenceAttending,
                                        });
                                      }}
                                      disabled={!occurrenceEventId}
                                    >
                                      <Text
                                        style={[
                                          styles.occurrenceAttendLabel,
                                          occurrenceAttending && styles.occurrenceAttendLabelActive,
                                        ]}
                                      >
                                        {occurrenceAttending ? 'Attending' : 'Attend'}
                                      </Text>
                                    </TouchableOpacity>
                                  </View>
                                </View>
                              );
                            })}
                        </View>
                      </View>
                    ) : null}
                    {isAdmin ? (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => {
                          setFormState({
                            name: event.name,
                            description: event.description,
                            workingGroupId: event.workingGroupId,
                            startAt: event.startAt,
                            endAt: event.endAt,
                            location: event.location,
                          });
                          setIsSeries(Boolean(event.seriesUuid));
                          setSeriesEndAt(event.seriesEndAt ?? '');
                          setRecurrence((event.recurrence as RecurrenceRule) ?? 'none');
                          setEditingId(event.id);
                          setShowForm(true);
                        }}
                        activeOpacity={0.85}
                      >
                        <Feather name="edit-2" size={14} color={colors.text} />
                        <Text style={styles.editLabel}>Edit</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[styles.editButton, event.attending ? styles.attendingButton : styles.signUpButton]}
                        onPress={() => {
                          const isAttending = Boolean(event.attending);
                          if (event.seriesUuid) {
                            if (Platform.OS !== 'web') {
                              Alert.alert(
                                isAttending ? 'Cancel attendance' : 'Sign up for series',
                                'Apply to this event only or all in the series?',
                                [
                                  {
                                    text: isAttending ? 'This event' : 'This event only',
                                    onPress: () => {
                                      void onToggleAttendance(event.id, { series: false, attending: isAttending });
                                      setSeriesAllMap((prev) =>
                                        event.seriesUuid ? { ...prev, [event.seriesUuid]: false } : prev
                                      );
                                    },
                                  },
                                  {
                                    text: isAttending ? 'All events' : 'All in series',
                                    onPress: () => {
                                      void onToggleAttendance(event.id, { series: true, attending: isAttending });
                                    },
                                  },
                                  { text: 'Cancel', style: 'cancel' },
                                ]
                              );
                            } else {
                              setSeriesPrompt({ eventId: event.id, attending: isAttending });
                            }
                          } else {
                            void onToggleAttendance(event.id, { series: false, attending: isAttending });
                          }
                        }}
                        activeOpacity={0.85}
                      >
                        <Feather name={event.attending ? 'check' : 'user-plus'} size={14} color={event.attending ? '#0f5132' : colors.text} />
                        <Text style={[styles.editLabel, event.attending ? styles.attendingLabel : styles.signUpLabel]}>
                          {event.attending ? 'Attending' : 'Sign up'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyState}>No events scheduled yet.</Text>
            )
          ) : null}
        </SectionCard>
      </ScrollView>
      {Platform.OS === 'web' && seriesPrompt ? (
                <Modal transparent animationType="fade" visible onRequestClose={() => setSeriesPrompt(null)}>
                  <View style={styles.modalBackdrop}>
                    <View style={styles.modalCard}>
                      <Text style={styles.modalTitle}>{seriesPrompt.attending ? 'Cancel attendance' : 'Sign up for series'}</Text>
                      <Text style={styles.modalMessage}>Apply to this event only or all in the series?</Text>
                      <View style={styles.modalActions}>
                        <SecondaryButton
                          label={seriesPrompt.attending ? 'This event' : 'This event only'}
                          onPress={() => {
                            void onToggleAttendance(seriesPrompt.eventId, { series: false, attending: seriesPrompt.attending });
                            setSeriesPrompt(null);
                          }}
                          style={styles.modalButton}
                        />
                        <PrimaryButton
                          label={seriesPrompt.attending ? 'All events' : 'All in series'}
                          onPress={() => {
                            void onToggleAttendance(seriesPrompt.eventId, { series: true, attending: seriesPrompt.attending });
                            setSeriesPrompt(null);
                          }}
                          style={styles.modalButton}
                        />
              </View>
              <TouchableOpacity style={styles.modalClose} onPress={() => setSeriesPrompt(null)}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
      {activePicker && Platform.OS !== 'web' ? (
        <DateTimePicker
          value={pickerValue}
          mode="datetime"
          display="default"
          onChange={handleDateChange}
        />
      ) : null}
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
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  itemDate: {
    fontSize: 12,
    color: colors.textMuted,
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
    backgroundColor: colors.primaryMuted,
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
  editLabel: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
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
  pickerWrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  picker: {
    height: 44,
    width: '100%',
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
  webSelect: {
    width: '100%',
    height: 36,
    fontSize: 14,
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: 0,
    outlineWidth: 0,
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
