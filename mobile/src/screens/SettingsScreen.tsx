import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { colors } from '../styles/theme';
import { styles } from './SettingsScreen.styles';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../providers/AppDataProvider';
import { useLogoutHandler } from '../hooks/useLogoutHandler';

export function SettingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { push } = useAppData();
  const handleLogout = useLogoutHandler();
  const accountUser = (auth.sessionUser ?? auth.user)!;
  const canToggleAdmin = auth.isSessionAdmin;
  const isAdminView = auth.isViewingAsAdmin;
  const baseRoleLabel = canToggleAdmin ? 'Admin' : 'Member';
  const viewStatus = isAdminView ? 'Admin view' : 'Member view';

  const handleToggleNotifications = async () => {
    if (push.loading) {
      return;
    }
    try {
      push.setError(null);
      await push.toggleAnnouncements();
    } catch {
      // handled downstream
    }
  };

  const handleToggleEventNotifications = async () => {
    if (push.loading) {
      return;
    }
    try {
      push.setError(null);
      await push.toggleEventAlerts();
    } catch {
      // handled downstream
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Account overview</Text>
          <Text style={styles.sectionDescription}>Quick account summary and mode toggle.</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Feather name="user" size={18} color={colors.text} />
              </View>
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryLabel}>Signed in as</Text>
                <Text style={styles.summaryValue}>{accountUser.email}</Text>
                {accountUser.firstName || accountUser.lastName ? (
                  <Text style={styles.summaryDetail}>
                    {[accountUser.firstName, accountUser.lastName].filter(Boolean).join(' ')}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.badge}>{baseRoleLabel}</Text>
            </View>

            {canToggleAdmin ? (
              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Feather name="eye" size={18} color={colors.text} />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryLabel}>Current view</Text>
                  <Text style={styles.summaryValue}>
                    {isAdminView
                      ? 'You are seeing admin-only tools.'
                      : 'Viewing as a member to mirror their experience.'}
                  </Text>
                </View>
                <Text style={[styles.badge, !isAdminView && styles.badgeMuted]}>{viewStatus}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.navPanel}>
            <TouchableOpacity
              style={styles.navItem}
              onPress={() => router.push('/tabs/settings/profile')}
              activeOpacity={0.8}
            >
              <View style={styles.navItemContent}>
                <Feather name="edit-3" size={18} color={colors.text} />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>Update user information</Text>
                  <Text style={styles.navDescription}>Update your contact info so organizers can reach you.</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {canToggleAdmin ? (
              <TouchableOpacity style={styles.navItem} onPress={auth.toggleAdminMode} activeOpacity={0.8}>
                <View style={styles.navItemContent}>
                  <Feather name="refresh-cw" size={18} color={colors.text} />
                  <View style={styles.navTextGroup}>
                    <Text style={styles.navLabel}>Switch view</Text>
                    <Text style={styles.navDescription}>
                      {isAdminView ? 'Go to member view to preview their experience.' : 'Return to admin view.'}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.statusBadge, !isAdminView && styles.statusBadgeMuted]}>{viewStatus}</Text>
              </TouchableOpacity>
            ) : null}

            {canToggleAdmin ? (
              <TouchableOpacity
                style={styles.navItem}
                onPress={() => router.push('/tabs/settings/users')}
                activeOpacity={0.8}
              >
                <View style={styles.navItemContent}>
                  <Feather name="users" size={18} color={colors.text} />
                  <View style={styles.navTextGroup}>
                    <Text style={styles.navLabel}>Users</Text>
                    <Text style={styles.navDescription}>Review members and promote trusted organizers.</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <Text style={styles.sectionDescription}>Enable push alerts when new announcements are posted.</Text>

          <View style={styles.navPanel}>
            <TouchableOpacity style={styles.navItem} onPress={handleToggleNotifications} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather
                  name={push.announcementEnabled ? 'check-square' : 'square'}
                  size={18}
                  color={colors.text}
                />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>Announcement alerts</Text>
                  <Text style={styles.navDescription}>
                    {push.announcementEnabled
                      ? 'You will get a push notification for new announcements.'
                      : 'Stay informed when admins post updates.'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusBadge, !push.announcementEnabled && styles.statusBadgeMuted]}>
                {push.loading ? '...' : push.announcementEnabled ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navItem} onPress={handleToggleEventNotifications} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather
                  name={push.eventEnabled ? 'check-square' : 'square'}
                  size={18}
                  color={colors.text}
                />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>Event alerts</Text>
                  <Text style={styles.navDescription}>
                    Receive day-of and one-hour reminders for events you&apos;re attending.
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusBadge, !push.eventEnabled && styles.statusBadgeMuted]}>
                {push.loading ? '...' : push.eventEnabled ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
            {push.error ? <Text style={styles.errorText}>{push.error}</Text> : null}
          </View>
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Session</Text>
          <Text style={styles.sectionDescription}>Sign out when you&apos;re done organizing on this device.</Text>

          <View style={styles.navPanel}>
            <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather name="log-out" size={18} color={colors.error} />
                <Text style={[styles.navLabel, styles.logoutLabel]}>Log out</Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.error} />
            </TouchableOpacity>
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
}
