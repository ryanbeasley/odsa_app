import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import appConfig from '../../app.json';
import { SectionCard } from '../components/SectionCard';
import { colors, radii, spacing } from '../styles/theme';
import { User } from '../types';

type SettingsScreenProps = {
  user: User;
  onLogout: () => void;
  onToggleAdmin: () => void;
  canToggleAdmin: boolean;
  isAdminView: boolean;
  notificationsEnabled: boolean;
  notificationsLoading: boolean;
  notificationsError: string | null;
  onToggleNotifications: () => void;
};

const appVersion = (appConfig as { expo?: { version?: string } }).expo?.version ?? '1.0.0';

export function SettingsScreen({
  user,
  onLogout,
  onToggleAdmin,
  canToggleAdmin,
  isAdminView,
  notificationsEnabled,
  notificationsLoading,
  notificationsError,
  onToggleNotifications,
}: SettingsScreenProps) {
  const baseRoleLabel = canToggleAdmin ? 'Admin' : 'Member';
  const viewStatus = isAdminView ? 'Admin view' : 'Member view';

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
                <Text style={styles.summaryValue}>{user.email}</Text>
              </View>
              <Text style={styles.badge}>{baseRoleLabel}</Text>
            </View>

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
              {canToggleAdmin ? (
                <Text style={[styles.badge, !isAdminView && styles.badgeMuted]}>{viewStatus}</Text>
              ) : (
                <Text style={[styles.badge, styles.badgeMuted]}>Member</Text>
              )}
            </View>
          </View>

          <View style={styles.navPanel}>
            {canToggleAdmin ? (
              <TouchableOpacity style={styles.navItem} onPress={onToggleAdmin} activeOpacity={0.8}>
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
            ) : (
              <Text style={styles.lockedCopy}>Admin-only controls are hidden for members.</Text>
            )}
          </View>
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Notifications</Text>
          <Text style={styles.sectionDescription}>Enable push alerts when new announcements are posted.</Text>

          <View style={styles.navPanel}>
            <TouchableOpacity style={styles.navItem} onPress={onToggleNotifications} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather
                  name={notificationsEnabled ? 'check-square' : 'square'}
                  size={18}
                  color={colors.text}
                />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>Announcement alerts</Text>
                  <Text style={styles.navDescription}>
                    {notificationsEnabled
                      ? 'You will get a push notification for new announcements.'
                      : 'Stay informed when admins post updates.'}
                  </Text>
                </View>
              </View>
              <Text style={[styles.statusBadge, !notificationsEnabled && styles.statusBadgeMuted]}>
                {notificationsLoading ? '...' : notificationsEnabled ? 'On' : 'Off'}
              </Text>
            </TouchableOpacity>
            {notificationsError ? <Text style={styles.errorText}>{notificationsError}</Text> : null}
          </View>
        </SectionCard>

        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>App info & session</Text>
          <Text style={styles.sectionDescription}>Version details and logout.</Text>

          <View style={styles.navPanel}>
            <View style={styles.navItem}>
              <View style={styles.navItemContent}>
                <Feather name="smartphone" size={18} color={colors.text} />
                <View style={styles.navTextGroup}>
                  <Text style={styles.navLabel}>App version</Text>
                  <Text style={styles.navDescription}>You are running {appVersion}.</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={onLogout} activeOpacity={0.8}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
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
    fontSize: 14,
    color: colors.textMuted,
  },
  navPanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.surface,
    minHeight: 120,
  },
  navItem: {
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  navTextGroup: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  navDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadgeMuted: {
    backgroundColor: colors.border,
    color: colors.textMuted,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
  },
  logoutItem: {
    backgroundColor: colors.surface,
    borderColor: colors.error,
  },
  logoutLabel: {
    color: colors.error,
  },
  lockedCopy: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  summaryCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgeMuted: {
    backgroundColor: colors.border,
    color: colors.textMuted,
  },
});
