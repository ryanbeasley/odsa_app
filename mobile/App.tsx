import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Hero } from './src/components/Hero';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AnnouncementsScreen } from './src/screens/AnnouncementsScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SupportDetailsScreen } from './src/screens/SupportDetailsScreen';
import { WorkingGroupsScreen } from './src/screens/WorkingGroupsScreen';
import { UpdateProfileScreen } from './src/screens/UpdateProfileScreen';
import { UserManagementScreen } from './src/screens/UserManagementScreen';
import { useAuth } from './src/hooks/useAuth';
import { useAnnouncements } from './src/hooks/useAnnouncements';
import { usePushSubscription } from './src/hooks/usePushSubscription';
import { useWorkingGroups } from './src/hooks/useWorkingGroups';
import { useEvents } from './src/hooks/useEvents';
import { colors } from './src/styles/theme';

export default function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('announcements');
  const [attendingOnly, setAttendingOnly] = useState(false);
  const [settingsView, setSettingsView] = useState<'main' | 'profile' | 'users'>('main');

  const {
    user,
    token,
    authLoading,
    authError,
    googleLoading,
    authenticate,
    googleSignIn,
    logout,
    setAuthError,
    toggleAdminMode,
    isSessionAdmin,
    isViewingAsAdmin,
    updateProfile,
  } = useAuth();

  const {
    announcements,
    draft,
    setDraft,
    loading,
    saving,
    loadingMore,
    hasMore,
    error,
    setError,
    saveAnnouncement,
    loadMoreAnnouncements,
  } = useAnnouncements(token);
  const {
    announcementEnabled: announcementNotificationsEnabled,
    eventEnabled: eventNotificationsEnabled,
    loading: pushLoading,
    error: pushError,
    setError: setPushError,
    toggleAnnouncements: toggleAnnouncementNotifications,
    toggleEventAlerts: toggleEventNotifications,
    disable: disablePush,
  } = usePushSubscription(token);
  const {
    groups,
    loading: groupsLoading,
    saving: groupsSaving,
    error: groupsError,
    setError: setGroupsError,
    refresh: refreshGroups,
    createGroup,
    updateGroup,
  } = useWorkingGroups(token);
  const {
    events,
    loading: eventsLoading,
    saving: eventsSaving,
    error: eventsError,
    setError: setEventsError,
    refresh: refreshEvents,
    createEvent,
    updateEvent,
    toggleAttendance,
  } = useEvents(token);

  useEffect(() => {
    if (!user) {
      setActiveTab('announcements');
    }
  }, [user]);

  useEffect(() => {
    if (activeTab !== 'settings') {
      setSettingsView('main');
    }
  }, [activeTab]);

  const isAdmin = isViewingAsAdmin;
  const canSave = Boolean(isAdmin && draft.trim() && !saving);

  const handleEmailChange = (value: string) => {
    setAuthError(null);
    setEmail(value);
  };

  const handlePasswordChange = (value: string) => {
    setAuthError(null);
    setPassword(value);
  };

  const handleConfirmPasswordChange = (value: string) => {
    setAuthError(null);
    setConfirmPassword(value);
  };

  const handleAuthSubmit = async () => {
    if (!email.trim() || password.trim().length < 6) {
      setAuthError('Enter a valid email and password (6+ chars).');
      return;
    }
    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }

    try {
      await authenticate(authMode, { email, password });
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      // error state already handled inside hook
    }
  };

  const handleLogout = () => {
    setActiveTab('announcements');
    if (token) {
      void disablePush().catch(() => {
        // best-effort cleanup; ignore failures on logout
      });
    }
    logout();
    setError(null);
    setDraft('');
    setConfirmPassword('');
    setPushError(null);
    setGroupsError(null);
    setEventsError(null);
    setSettingsView('main');
  };

  const handleToggleNotifications = async () => {
    if (!token || pushLoading) {
      return;
    }
    try {
      setPushError(null);
      await toggleAnnouncementNotifications();
    } catch {
      // error handled in hook
    }
  };

  const handleToggleEventNotifications = async () => {
    if (!token || pushLoading) {
      return;
    }
    try {
      setPushError(null);
      await toggleEventNotifications();
    } catch {
      // error handled in hook
    }
  };

  const handleOpenProfileSettings = () => {
    setSettingsView('profile');
  };

  const handleOpenUserDirectory = () => {
    setSettingsView('users');
  };

  const handleCloseSettingsView = () => {
    setSettingsView('main');
  };

  const handleSubmitProfile = async (values: {
    firstName?: string | null;
    lastName?: string | null;
    phone?: string | null;
    email?: string;
  }) => {
    await updateProfile(values);
    setSettingsView('main');
  };

  const handleSaveAnnouncement = async () => {
    if (!canSave) {
      return;
    }
    try {
      await saveAnnouncement();
    } catch {
      // error state handled in hook
    }
  };

  const handleCreateWorkingGroup = async (payload: { name: string; description: string; members: string }) => {
    try {
      setGroupsError(null);
      await createGroup(payload);
    } catch {
      // error handled in hook
    }
  };

  const handleUpdateWorkingGroup = async (
    id: number,
    payload: { name: string; description: string; members: string }
  ) => {
    try {
      setGroupsError(null);
      await updateGroup(id, payload);
    } catch {
      // error handled in hook
    }
  };

  const handleCreateEvent = async (payload: {
    name: string;
    description: string;
    workingGroupId: number;
    startAt: string;
    endAt: string;
    location: string;
  }) => {
    try {
      setEventsError(null);
      await createEvent(payload);
    } catch {
      // error handled in hook
    }
  };

  const handleUpdateEvent = async (
    id: number,
    payload: {
      name: string;
      description: string;
      workingGroupId: number;
      startAt: string;
      endAt: string;
      location: string;
    }
  ) => {
    try {
      setEventsError(null);
      await updateEvent(id, payload);
    } catch {
      // error handled in hook
    }
  };

  const handleSelectTab = (tab: TabKey) => {
    if (tab === 'events') {
      setAttendingOnly(true);
    }
    setActiveTab(tab);
  };

  const renderActiveScreen = () => {
    if (!user) {
      return null;
    }
    switch (activeTab) {
      case 'announcements':
        return (
          <AnnouncementsScreen
            user={user}
            announcements={announcements}
            draft={draft}
            loading={loading}
            saving={saving}
            loadingMore={loadingMore}
            error={error}
            isAdmin={Boolean(isAdmin)}
            canSave={canSave}
            hasMore={hasMore}
            onDraftChange={(value) => {
              setError(null);
              setDraft(value);
            }}
            onSave={handleSaveAnnouncement}
            onLoadMore={loadMoreAnnouncements}
          />
        );
      case 'events':
        return (
          <EventsScreen
            events={events}
            groups={groups}
            loading={eventsLoading}
            saving={eventsSaving}
            error={eventsError}
            isAdmin={Boolean(isAdmin)}
            attendingOnly={attendingOnly}
            onToggleAttendingOnly={setAttendingOnly}
            onRefresh={refreshEvents}
            onCreate={handleCreateEvent}
            onUpdate={handleUpdateEvent}
            onToggleAttendance={toggleAttendance}
          />
        );
      case 'support':
        return (
          <SupportDetailsScreen
            token={token}
            onLogout={handleLogout}
            canToggleAdmin={isSessionAdmin}
            isAdminView={isViewingAsAdmin}
            onToggleAdmin={toggleAdminMode}
          />
        );
      case 'workingGroups':
        return (
          <WorkingGroupsScreen
            groups={groups}
            loading={groupsLoading}
            saving={groupsSaving}
            error={groupsError}
            isAdmin={Boolean(isAdmin)}
            onRefresh={refreshGroups}
            onCreate={handleCreateWorkingGroup}
            onUpdate={handleUpdateWorkingGroup}
          />
        );
      case 'settings':
        if (settingsView === 'profile') {
          return (
            <UpdateProfileScreen
              user={(sessionUser ?? user)!}
              onSubmit={handleSubmitProfile}
              onCancel={handleCloseSettingsView}
            />
          );
        }
        if (settingsView === 'users') {
          return (
            <UserManagementScreen
              token={token}
              currentUserId={sessionUser?.id ?? 0}
              onBack={handleCloseSettingsView}
            />
          );
        }
        return (
          <SettingsScreen
            accountUser={(sessionUser ?? user)!}
            onLogout={handleLogout}
            onToggleAdmin={toggleAdminMode}
            canToggleAdmin={isSessionAdmin}
            isAdminView={isViewingAsAdmin}
            notificationsEnabled={announcementNotificationsEnabled}
            eventNotificationsEnabled={eventNotificationsEnabled}
            notificationsLoading={pushLoading}
            notificationsError={pushError}
            onToggleNotifications={handleToggleNotifications}
            onToggleEventNotifications={handleToggleEventNotifications}
            onNavigateUpdateProfile={handleOpenProfileSettings}
            onNavigateUserDirectory={handleOpenUserDirectory}
          />
        );
      case 'home':
      default:
        return (
          <HomeScreen user={user} onNavigate={setActiveTab} />
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      {!user ? (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.content}>
            <Hero eyebrow="Orlando DSA" title="Organize for a better Orlando" />
            <AuthScreen
              mode={authMode}
              email={email}
              password={password}
              confirmPassword={confirmPassword}
              authError={authError}
              authLoading={authLoading}
              googleLoading={googleLoading}
              onChangeEmail={handleEmailChange}
              onChangePassword={handlePasswordChange}
              onChangeConfirmPassword={handleConfirmPasswordChange}
              onSubmit={handleAuthSubmit}
              onGoogleSignIn={googleSignIn}
              onToggleMode={() => {
                setAuthError(null);
                setAuthMode(authMode === 'signup' ? 'login' : 'signup');
              }}
            />
          </View>
        </ScrollView>
      ) : (
        <View style={styles.loggedIn}>
          <View style={styles.loggedInContent}>
            <Hero eyebrow="Orlando DSA" title="Organize for a better Orlando" />
            <View style={styles.tabContent}>{renderActiveScreen()}</View>
          </View>

          <View style={styles.bottomNavWrapper}>
            <BottomNav activeTab={activeTab} onSelectTab={handleSelectTab} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  content: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 16,
  },
  loggedIn: {
    flex: 1,
    justifyContent: 'space-between',
  },
  loggedInContent: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 16,
  },
  tabContent: {
    flex: 1,
    width: '100%',
  },
  bottomNavWrapper: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
});
