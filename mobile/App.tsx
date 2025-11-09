import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Hero } from './src/components/Hero';
import { BottomNav, TabKey } from './src/components/BottomNav';
import { AuthScreen } from './src/screens/AuthScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { EventsScreen } from './src/screens/EventsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { useAuth } from './src/hooks/useAuth';
import { useAnnouncements } from './src/hooks/useAnnouncements';
import { colors } from './src/styles/theme';

export default function App() {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('home');

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

  useEffect(() => {
    if (!user) {
      setActiveTab('home');
    }
  }, [user]);

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

  const handleAuthSubmit = async () => {
    if (!email.trim() || password.trim().length < 6) {
      setAuthError('Enter a valid email and password (6+ chars).');
      return;
    }

    try {
      await authenticate(authMode, { email, password });
      setEmail('');
      setPassword('');
    } catch {
      // error state already handled inside hook
    }
  };

  const handleLogout = () => {
    setActiveTab('home');
    logout();
    setError(null);
    setDraft('');
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

  const renderActiveScreen = () => {
    if (!user) {
      return null;
    }
    switch (activeTab) {
      case 'events':
        return <EventsScreen />;
      case 'calendar':
        return <CalendarScreen />;
      case 'settings':
        return (
          <SettingsScreen
            onLogout={handleLogout}
            onToggleAdmin={toggleAdminMode}
            canToggleAdmin={isSessionAdmin}
            isAdminView={isViewingAsAdmin}
          />
        );
      case 'home':
      default:
        return (
          <HomeScreen
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
              authError={authError}
              authLoading={authLoading}
              googleLoading={googleLoading}
              onChangeEmail={handleEmailChange}
              onChangePassword={handlePasswordChange}
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
            <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />
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
