import { ReactNode, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { colors } from '../styles/theme';
import { styles } from './SettingsScreen.styles';
import { useAuth } from '../hooks/useAuth';
import { useAppData } from '../providers/AppDataProvider';
import { useLogoutHandler } from '../hooks/useLogoutHandler';
import { SERVER_URL } from '../config';

/**
 * Settings hub for account info, admin tools, and notification preferences.
 */
export function SettingsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { push, events } = useAppData();
  const handleLogout = useLogoutHandler();
  const accountUser = (auth.sessionUser ?? auth.user)!;
  const canToggleAdmin = auth.isSessionAdmin;
  const isAdminView = auth.isViewingAsAdmin;
  const baseRoleLabel = canToggleAdmin ? 'Admin' : 'Member';
  const viewStatus = isAdminView ? 'Admin view' : 'Member view';
  const viewDescription = isAdminView
    ? 'You are seeing admin-only tools.'
    : 'Viewing as a member to mirror their experience.';
  const [discordSyncing, setDiscordSyncing] = useState(false);
  const [discordSyncMessage, setDiscordSyncMessage] = useState<string | null>(null);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  /**
   * Toggles announcement or event push notifications.
   */
  const handleToggleNotifications = async (type: 'announcements' | 'events') => {
    if (push.loading) {
      return;
    }
    try {
      push.setError(null);
      if (type === 'announcements') {
        await push.toggleAnnouncements();
      } else {
        await push.toggleEventAlerts();
      }
    } catch {
      // handled downstream
    }
  };

  const getStatusText = (enabled: boolean) =>
    push.loading ? '...' : enabled ? 'On' : 'Off';
  const getSmsStatusText = (enabled: boolean) =>
    smsSaving ? '...' : enabled ? 'On' : 'Off';

  const handleToggleSmsAlerts = async () => {
    if (smsSaving) {
      return;
    }
    try {
      setSmsSaving(true);
      setSmsError(null);
      await auth.updateProfile({ eventAlertsSmsEnabled: !accountUser.eventAlertsSmsEnabled });
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : 'Failed to update SMS alerts');
    } finally {
      setSmsSaving(false);
    }
  };

  const handleDiscordSync = async () => {
    if (discordSyncing || !auth.token) {
      return;
    }
    try {
      setDiscordSyncing(true);
      setDiscordSyncMessage(null);
      const response = await fetch(`${SERVER_URL}/api/discord-sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auth.token}`,
        },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? 'Failed to sync Discord events');
      }
      const data = (await response.json()) as { synced: number; skipped?: number };
      const skipped = data.skipped ?? 0;
      setDiscordSyncMessage(`Synced ${data.synced} events. Skipped ${skipped}.`);
      events.refresh();
    } catch (error) {
      setDiscordSyncMessage(error instanceof Error ? error.message : 'Failed to sync Discord events');
    } finally {
      setDiscordSyncing(false);
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
                <Text style={styles.summaryValue}>{viewDescription}</Text>
              </View>
              <Text style={[styles.badge, !isAdminView && styles.badgeMuted]}>{viewStatus}</Text>
            </View>
          ) : null}
          </View>

          <View style={styles.navPanel}>
            <NavItem
              icon="edit-3"
              label="Update user information"
              description="Update your contact info so organizers can reach you."
              onPress={() => router.push('/tabs/settings/profile')}
              right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
            />

            {canToggleAdmin ? (
              <NavItem
                icon="refresh-cw"
                label="Switch view"
                description={isAdminView ? 'Go to member view to preview their experience.' : 'Return to admin view.'}
                onPress={auth.toggleAdminMode}
                right={<Text style={[styles.statusBadge, !isAdminView && styles.statusBadgeMuted]}>{viewStatus}</Text>}
              />
            ) : null}

            {canToggleAdmin ? (
              <NavItem
                icon="users"
                label="Users"
                description="Review members and promote trusted organizers."
                onPress={() => router.push('/tabs/settings/users')}
                right={<Feather name="chevron-right" size={18} color={colors.textMuted} />}
              />
            ) : null}
          </View>
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <Text style={styles.sectionDescription}>Enable push alerts when new announcements are posted.</Text>

          <NotificationsSection
            push={push}
            onToggle={handleToggleNotifications}
            getStatusText={getStatusText}
            smsEnabled={Boolean(accountUser.eventAlertsSmsEnabled)}
            smsStatusText={getSmsStatusText(Boolean(accountUser.eventAlertsSmsEnabled))}
            onToggleSms={handleToggleSmsAlerts}
            smsError={smsError}
          />
        </SectionCard>

        {isAdminView ? (
          <AdminToolsSection
            discordSyncing={discordSyncing}
            discordSyncMessage={discordSyncMessage}
            onSync={handleDiscordSync}
          />
        ) : null}

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

type NotificationsSectionProps = {
  push: ReturnType<typeof useAppData>['push'];
  onToggle: (type: 'announcements' | 'events') => void;
  getStatusText: (enabled: boolean) => string;
  smsEnabled: boolean;
  smsStatusText: string;
  onToggleSms: () => void;
  smsError: string | null;
};

function NotificationsSection({
  push,
  onToggle,
  getStatusText,
  smsEnabled,
  smsStatusText,
  onToggleSms,
  smsError,
}: NotificationsSectionProps) {
  return (
    <View style={styles.navPanel}>
      <NavItem
        icon={push.announcementEnabled ? 'check-square' : 'square'}
        label="Announcement alerts"
        description={
          push.announcementEnabled
            ? 'You will get a push notification for new announcements.'
            : 'Stay informed when admins post updates.'
        }
        onPress={() => onToggle('announcements')}
        right={
          <Text style={[styles.statusBadge, !push.announcementEnabled && styles.statusBadgeMuted]}>
            {getStatusText(push.announcementEnabled)}
          </Text>
        }
      />
      <NavItem
        icon={push.eventEnabled ? 'check-square' : 'square'}
        label="Event alerts"
        description="Receive 24-hour and one-hour reminders for events you&apos;re attending."
        onPress={() => onToggle('events')}
        right={
          <Text style={[styles.statusBadge, !push.eventEnabled && styles.statusBadgeMuted]}>
            {getStatusText(push.eventEnabled)}
          </Text>
        }
      />
      <NavItem
        icon={smsEnabled ? 'check-square' : 'square'}
        label="SMS Event alerts"
        description="Receive 24-hour and one-hour reminders for events you&apos;re attending via text."
        onPress={onToggleSms}
        right={<Text style={[styles.statusBadge, !smsEnabled && styles.statusBadgeMuted]}>{smsStatusText}</Text>}
      />
      {push.error ? <Text style={styles.errorText}>{push.error}</Text> : null}
      {smsError ? <Text style={styles.errorText}>{smsError}</Text> : null}
    </View>
  );
}

type AdminToolsSectionProps = {
  discordSyncing: boolean;
  discordSyncMessage: string | null;
  onSync: () => void;
};

function AdminToolsSection({ discordSyncing, discordSyncMessage, onSync }: AdminToolsSectionProps) {
  return (
    <SectionCard style={styles.section}>
      <Text style={styles.sectionLabel}>Admin tools</Text>
      <Text style={styles.sectionDescription}>Sync external event sources.</Text>

      <View style={styles.navPanel}>
        <NavItem
          icon="repeat"
          label="Sync Events From Discord"
          description="Import scheduled events from the connected Discord server."
          onPress={onSync}
          right={
            <Text style={[styles.statusBadge, discordSyncing && styles.statusBadgeMuted]}>
              {discordSyncing ? 'Syncing...' : 'Run'}
            </Text>
          }
        />
        {discordSyncMessage ? <Text style={styles.statusHint}>{discordSyncMessage}</Text> : null}
      </View>
    </SectionCard>
  );
}

type NavItemProps = {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
  onPress: () => void;
  right?: ReactNode;
};

function NavItem({ icon, label, description, onPress, right }: NavItemProps) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.navItemContent}>
        <Feather name={icon} size={18} color={colors.text} />
        <View style={styles.navTextGroup}>
          <Text style={styles.navLabel}>{label}</Text>
          {description ? <Text style={styles.navDescription}>{description}</Text> : null}
        </View>
      </View>
      {right ?? <Feather name="chevron-right" size={18} color={colors.textMuted} />}
    </TouchableOpacity>
  );
}
