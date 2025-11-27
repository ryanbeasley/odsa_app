import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard'
import { useLocalSearchParams } from 'expo-router';
import { SectionCard } from '../components/SectionCard';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { SelectField } from '../components/SelectField';
import { colors } from '../styles/theme';
import { Event, RecurrenceRule } from '../types';
import { styles } from './EventsScreen.styles';
import { useAppData } from '../providers/AppDataProvider';
import { useAuth } from '../hooks/useAuth';

/**
 * Full events experience including filters, admin tools, and event list.
 */
export function EventsScreen() {
  const params = useLocalSearchParams<{ eventId?: string | string[]; seriesId?: string | string[] }>();
  const { events: eventsState, groups: groupsState, eventFilters } = useAppData();
  const { isViewingAsAdmin } = useAuth();
  const events = eventsState.events;
  const groups = groupsState.groups;
  const loading = eventsState.loading;
  const saving = eventsState.saving;
  const error = eventsState.error;
  const { attendingOnly, setAttendingOnly, focus, setFocus, clearFocus } = eventFilters;
  const isAdmin = isViewingAsAdmin;
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

  useEffect(() => {
    const rawEvent = Array.isArray(params.eventId) ? params.eventId[0] : params.eventId;
    const rawSeries = Array.isArray(params.seriesId) ? params.seriesId[0] : params.seriesId;
    if (rawEvent) {
      const parsed = Number(rawEvent);
      if (!Number.isNaN(parsed)) {
        setFocus({ type: 'event', value: parsed });
        setAttendingOnly(false);
      }
      return;
    }
    if (rawSeries) {
      setFocus({ type: 'series', value: rawSeries });
      setAttendingOnly(false);
    }
  }, [params.eventId, params.seriesId, setAttendingOnly, setFocus]);

  /**
   * Determines when the admin form has enough data to create/update an event.
   */
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

  /**
   * Creates or updates an event based on the current form state.
   */
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
      eventsState.setError(null);
      if (editingId) {
        await eventsState.updateEvent(editingId, payload);
      } else {
        await eventsState.createEvent(payload);
      }
      setFormState({ name: '', description: '', workingGroupId: 0, startAt: '', endAt: '', location: '' });
      setEditingId(null);
      setIsSeries(false);
      setSeriesEndAt('');
      setRecurrence('none');
      setMonthlyPattern('date');
      setShowForm(false);
      void eventsState.refresh();
    } catch {
      // error handled upstream
    }
  };

  /**
   * Builds the list of events the user should see based on filters/focus state.
   */
  const filteredEvents = useMemo(() => {
    const now = Date.now();
    const query = search.trim().toLowerCase();
    const upcoming = events
      .filter((evt) => new Date(evt.endAt).getTime() >= now)
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    if (focus?.type === 'event') {
      const targetId = focus.value;
      return upcoming.filter(
        (evt) =>
          evt.id === targetId || evt.upcomingOccurrences?.some((occ) => occ.eventId === targetId) || false
      );
    }
    if (focus?.type === 'series') {
      return upcoming.filter((evt) => evt.seriesUuid === focus.value);
    }

    return upcoming
      .filter((evt) => (attendingOnly ? Boolean(evt.attending) : true))
      .filter((evt) => (filterGroupId ? evt.workingGroupId === filterGroupId : true))
      .filter((evt) => {
        if (!query) return true;
        return evt.name.toLowerCase().includes(query) || evt.description.toLowerCase().includes(query);
      });
  }, [attendingOnly, events, filterGroupId, focus, search]);

  const selectedGroup = groups.find((g) => g.id === formState.workingGroupId);
  /**
   * Produces helper text describing whichever event/series is focused.
   */
  const focusedDescriptor = useMemo(() => {
    if (!focus) return null;
    if (focus.type === 'event') {
      const eventMatch =
        events.find((evt) => evt.id === focus.value) ||
        events.find((evt) => evt.upcomingOccurrences?.some((occ) => occ.eventId === focus.value));
      return eventMatch ? `This view only shows "${eventMatch.name}".` : 'Showing shared event.';
    }
    if (focus.type === 'series') {
      const eventMatch = events.find((evt) => evt.seriesUuid === focus.value);
      return eventMatch ? `This view is limited to the "${eventMatch.name}" series.` : 'Showing shared series.';
    }
    return null;
  }, [events, focus]);
  const focusActive = Boolean(focus);

  /**
   * Presents confirmation alerts before deleting an event/series.
   */
  const handleDeletePrompt = (event: Event) => {
    if (!isAdmin) {
      return;
    }
    if (event.seriesUuid) {
      Alert.alert(
        'Delete event',
        'Delete this single occurrence or the entire series?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'This event',
            style: 'destructive',
            onPress: () => {
              void eventsState.deleteEvent(event.id, { series: false }).catch(() => {});
            },
          },
          {
            text: 'Entire series',
            style: 'destructive',
            onPress: () => {
              void eventsState.deleteEvent(event.id, { series: true }).catch(() => {});
            },
          },
        ]
      );
    } else {
      Alert.alert('Delete event', 'Are you sure you want to delete this event?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void eventsState.deleteEvent(event.id, { series: false }).catch(() => {});
          },
        },
      ]);
    }
  };

  /**
   * Copies a deep link pointing to either a single occurrence or the full series.
   */
  const handleCopyLink = (event: Event) => {
    /**
     * Generates the correct URL for the requested scope and copies it.
     */
    const copyLink = async (scope: 'event' | 'series') => {
      try {
        const queryParams =
          scope === 'event'
            ? { eventId: String(event.id) }
            : event.seriesUuid
            ? { seriesId: event.seriesUuid }
            : { eventId: String(event.id) };
        const url = Linking.createURL('/tabs/events', { queryParams });
        await copyToClipboard(url);
        Alert.alert(
          'Link copied',
          scope === 'series'
            ? 'Share this link so members jump directly to this event series.'
            : 'Share this link so members jump directly to this event.'
        );
      } catch {
        Alert.alert('Unable to copy link', 'Try again in a moment.');
      }
    };

    if (event.seriesUuid) {
      Alert.alert('Copy link', 'Do you want to share this specific occurrence or the whole series?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'This event',
          onPress: () => {
            void copyLink('event');
          },
        },
        {
          text: 'Entire series',
          onPress: () => {
            void copyLink('series');
          },
        },
      ]);
    } else {
      void copyLink('event');
    }
  };

  /**
   * Toggles the user's attendance for a single event or an entire series.
   */
  const handleToggleAttendance = async (eventId: number, options: { series: boolean; attending: boolean }) => {
    try {
      eventsState.setError(null);
      await eventsState.toggleAttendance(eventId, options);
    } catch {
      // handled upstream
    }
  };

  /**
   * Opens the native picker for the requested datetime field.
   */
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

  /**
   * Hides the currently open date/time picker.
   */
  const closePicker = () => {
    setPickerVisible(false);
    setPickerField(null);
  };

  /**
   * Applies the picker selection into the relevant form field.
   */
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

  /**
   * Formats stored ISO strings for the datetime-local input on web.
   */
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
                onPress={() => setAttendingOnly(!attendingOnly)}
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
          {!showForm && focus ? (
            <View style={styles.focusBanner}>
              <Feather name="filter" size={16} color={colors.text} />
              <View style={styles.focusBannerText}>
                <Text style={styles.focusBannerTitle}>Filtered by shared link</Text>
                <Text style={styles.focusBannerDescription}>{focusedDescriptor ?? 'Showing shared event.'}</Text>
              </View>
              <TouchableOpacity style={styles.focusClearButton} onPress={clearFocus} activeOpacity={0.85}>
                <Text style={styles.focusClearLabel}>Clear</Text>
              </TouchableOpacity>
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
                                        void handleToggleAttendance(occurrenceEventId, {
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
                      <View style={styles.adminActionsRow}>
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
                        <TouchableOpacity
                          style={[styles.editButton, styles.copyButton]}
                          activeOpacity={0.85}
                          onPress={() => handleCopyLink(event)}
                        >
                          <Feather name="link-2" size={14} color={colors.text} />
                          <Text style={[styles.editLabel, styles.copyLabel]}>Copy link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.editButton, styles.deleteButton]}
                          onPress={() => handleDeletePrompt(event)}
                          activeOpacity={0.85}
                        >
                          <Feather name="trash-2" size={14} color={colors.error} />
                          <Text style={[styles.editLabel, styles.deleteLabel]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
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
                                      void handleToggleAttendance(event.id, { series: false, attending: isAttending });
                                    },
                                  },
                                  {
                                    text: isAttending ? 'All events' : 'All in series',
                                    onPress: () => {
                                      void handleToggleAttendance(event.id, { series: true, attending: isAttending });
                                    },
                                  },
                                  { text: 'Cancel', style: 'cancel' },
                                ]
                              );
                            } else {
                              setSeriesPrompt({ eventId: event.id, attending: isAttending });
                            }
                          } else {
                            void handleToggleAttendance(event.id, { series: false, attending: isAttending });
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
              <Text style={styles.emptyState}>
                {focusActive ? 'No events matched that shared link. It may be outdated.' : 'No events scheduled yet.'}
              </Text>
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
                    void handleToggleAttendance(seriesPrompt.eventId, {
                      series: false,
                      attending: seriesPrompt.attending,
                    });
                    setSeriesPrompt(null);
                  }}
                  style={styles.modalButton}
                />
                <PrimaryButton
                  label={seriesPrompt.attending ? 'All events' : 'All in series'}
                  onPress={() => {
                    void handleToggleAttendance(seriesPrompt.eventId, {
                      series: true,
                      attending: seriesPrompt.attending,
                    });
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

/**
 * Formats a timestamp for display in the event list.
 */
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

/**
 * Builds the label for repeating on a specific calendar date each month.
 */
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

/**
 * Builds the label for repeating on a specific weekday each month.
 */
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

/**
 * Converts a number into its ordinal form (1 -> 1st).
 */
function getOrdinal(value: number) {
  const suffixes: Record<number, string> = { 1: 'st', 2: 'nd', 3: 'rd' };
  const v = value % 100;
  return `${value}${suffixes[v] ?? suffixes[v % 10] ?? 'th'}`;
}

/**
 * Converts an index into its ordinal word (1 -> first).
 */
function getOrdinalWord(index: number) {
  const words = ['first', 'second', 'third', 'fourth', 'fifth'];
  return words[index - 1] ?? `${index}th`;
}

/**
 * Attempts to copy text via Expo Clipboard, then falls back to navigator clipboard.
 */
async function copyToClipboard(value: string) {
  const clipboardModule = await loadClipboardModule();
  if (clipboardModule?.setStringAsync) {
    await clipboardModule.setStringAsync(value);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  } else {
    throw new Error('Clipboard not available');
  }
}

type ClipboardModule = {
  setStringAsync?: (value: string) => Promise<void | boolean>;
};

/**
 * Dynamically loads expo-clipboard so the module isn’t required in all runtimes.
 */
async function loadClipboardModule(): Promise<ClipboardModule | null> {
  const cacheKey = '__expoClipboardModule';
  const cached = (globalThis as Record<string, unknown>)[cacheKey] as ClipboardModule | null | undefined;
  if (cached !== undefined) {
    return cached;
  }
  try {
    const module = (await import('expo-clipboard')) as ClipboardModule;
    (globalThis as Record<string, unknown>)[cacheKey] = module;
    return module;
  } catch (error) {
    console.warn('expo-clipboard not available, falling back to browser clipboard.', error);
    (globalThis as Record<string, unknown>)[cacheKey] = null;
    return null;
  }
}
