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
import DateTimePicker from '@react-native-community/datetimepicker';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { SelectField } from '../components/SelectField';
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
    monthlyPattern?: 'date' | 'weekday';
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
    monthlyPattern?: 'date' | 'weekday';
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
  const [monthlyPattern, setMonthlyPattern] = useState<'date' | 'weekday'>('date');
  type PickerField = 'startAt' | 'endAt' | 'seriesEndAt';
  const [pickerField, setPickerField] = useState<PickerField | null>(null);
  const [pickerValue, setPickerValue] = useState<Date>(new Date());
  const [pickerVisible, setPickerVisible] = useState(false);
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
        monthlyPattern: isSeries && recurrence === 'monthly' ? monthlyPattern : undefined,
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
      setMonthlyPattern('date');
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

  const openPicker = (field: PickerField) => {
    const currentValue = (() => {
      if (field === 'seriesEndAt') {
        return seriesEndAt ? new Date(seriesEndAt) : new Date();
      }
      const raw = formState[field];
      return raw ? new Date(raw) : new Date();
    })();
    setPickerValue(currentValue);
    setPickerField(field);
    setPickerVisible(true);
  };

  const closePicker = () => {
    setPickerVisible(false);
    setPickerField(null);
  };

  const applyPickerValue = () => {
    if (!pickerField) {
      return;
    }
    const iso = pickerValue.toISOString();
    if (pickerField === 'seriesEndAt') {
      setSeriesEndAt(iso);
    } else {
      setFormState((prev) => ({ ...prev, [pickerField]: iso }));
    }
    closePicker();
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
              <SelectField
                label="Working group"
                value={filterGroupId ?? 0}
                placeholder="All groups"
                options={[
                  { label: 'All groups', value: 0 },
                  ...groups.map((group) => ({ label: group.name, value: group.id })),
                ]}
                onValueChange={(selected) => {
                  const numericValue = Number(selected);
                  setFilterGroupId(numericValue === 0 ? null : numericValue);
                }}
              />
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
                    setMonthlyPattern('date');
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
                    setMonthlyPattern('date');
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
                      <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('startAt')}>
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
                      <TouchableOpacity style={styles.pickerButton} onPress={() => openPicker('endAt')}>
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
                  <SelectField
                    label="Working group"
                    value={formState.workingGroupId}
                    placeholder="Select a working group"
                    options={[
                      { label: 'Select a working group', value: 0 },
                      ...groups.map((group) => ({ label: group.name, value: group.id })),
                    ]}
                    onValueChange={(selected) =>
                      setFormState((prev) => ({ ...prev, workingGroupId: Number(selected) }))
                    }
                    disabled={!groups.length}
                    helperText={
                      !groups.length
                        ? 'Create a working group first to associate this event.'
                        : selectedGroup
                        ? `Selected: ${selectedGroup.name}`
                        : 'Choose the sponsoring working group.'
                    }
                  />
                  <View style={styles.seriesToggle}>
                    <TouchableOpacity
                      style={styles.checkboxRow}
                      activeOpacity={0.85}
                    onPress={() => {
                      setIsSeries((prev) => {
                        const next = !prev;
                        if (next && recurrence === 'none') {
                          setRecurrence('weekly');
                        }
                        if (!next) {
                          setRecurrence('none');
                          setSeriesEndAt('');
                          setMonthlyPattern('date');
                        }
                        return next;
                      });
                    }}
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
                              onPress={() => openPicker('seriesEndAt')}
                            >
                              <Feather name="calendar" size={16} color={colors.text} />
                              <Text style={styles.pickerButtonLabel}>Select series end</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                        {seriesEndAt ? (
                          <Text style={styles.groupHint}>Ends {formatTimestamp(seriesEndAt)}</Text>
                        ) : null}
                        <SelectField
                          label="Repeat"
                          value={recurrence === 'none' ? '' : recurrence}
                          placeholder="Select cadence"
                          options={[
                            { label: 'Daily', value: 'daily' },
                            { label: 'Weekly', value: 'weekly' },
                            { label: 'Monthly', value: 'monthly' },
                          ]}
                          onValueChange={(value) => {
                            setRecurrence(value as RecurrenceRule);
                            if (value !== 'monthly') {
                              setMonthlyPattern('date');
                            }
                          }}
                        />
                        {recurrence === 'monthly' ? (
                          <View style={styles.monthlyPatternWrapper}>
                            <Text style={styles.groupPickerLabel}>Monthly pattern</Text>
                            <View style={styles.monthlyOptions}>
                              <TouchableOpacity
                                style={[
                                  styles.monthlyOption,
                                  monthlyPattern === 'date' && styles.monthlyOptionActive,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => setMonthlyPattern('date')}
                              >
                                <Feather
                                  name={monthlyPattern === 'date' ? 'check-circle' : 'circle'}
                                  size={18}
                                  color={colors.text}
                                />
                                <View style={styles.monthlyOptionCopy}>
                                  <Text style={styles.monthlyOptionLabel}>Same calendar date</Text>
                                  <Text style={styles.monthlyOptionDescription}>
                                    {formatMonthlyDateLabel(formState.startAt)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.monthlyOption,
                                  monthlyPattern === 'weekday' && styles.monthlyOptionActive,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => setMonthlyPattern('weekday')}
                              >
                                <Feather
                                  name={monthlyPattern === 'weekday' ? 'check-circle' : 'circle'}
                                  size={18}
                                  color={colors.text}
                                />
                                <View style={styles.monthlyOptionCopy}>
                                  <Text style={styles.monthlyOptionLabel}>Same weekday pattern</Text>
                                  <Text style={styles.monthlyOptionDescription}>
                                    {formatMonthlyWeekdayLabel(formState.startAt)}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ) : null}
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
                          setMonthlyPattern('date');
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
      {Platform.OS !== 'web' ? (
        <Modal
          transparent
          animationType="fade"
          visible={pickerVisible}
          onRequestClose={closePicker}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Select date &amp; time</Text>
              <DateTimePicker
                value={pickerValue}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'inline' : 'spinner'}
                onChange={(_, date) => {
                  if (date) {
                    setPickerValue(date);
                  }
                }}
              />
              <View style={styles.modalActions}>
                <SecondaryButton label="Cancel" onPress={closePicker} style={styles.modalButton} />
                <PrimaryButton label="Save" onPress={applyPickerValue} style={styles.modalButton} />
              </View>
            </View>
          </View>
        </Modal>
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

function formatMonthlyDateLabel(startAt?: string) {
  if (!startAt) {
    return 'Select a start date first.';
  }
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    return 'Select a valid start date first.';
  }
  const day = date.getDate();
  return `Repeats on the ${getOrdinal(day)} each month`;
}

function formatMonthlyWeekdayLabel(startAt?: string) {
  if (!startAt) {
    return 'Select a start date first.';
  }
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) {
    return 'Select a valid start date first.';
  }
  const weekIndex = Math.ceil(date.getDate() / 7);
  const weekday = weekdayNames[date.getDay()];
  return `Repeats on the ${getOrdinalWord(weekIndex)} ${weekday} each month`;
}

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getOrdinal(value: number) {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const v = value % 100;
  return `${value}${suffixes[v] ?? suffixes[v % 10] ?? 'th'}`;
}

function getOrdinalWord(index: number) {
  const words = ['first', 'second', 'third', 'fourth', 'fifth'];
  return words[index - 1] ?? `${index}th`;
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
