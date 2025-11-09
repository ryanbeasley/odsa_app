import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SectionCard } from '../components/SectionCard';
import { colors, radii, spacing } from '../styles/theme';

type SettingsScreenProps = {
  onLogout: () => void;
  onToggleAdmin: () => void;
  canToggleAdmin: boolean;
  isAdminView: boolean;
};

export function SettingsScreen({ onLogout, onToggleAdmin, canToggleAdmin, isAdminView }: SettingsScreenProps) {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard style={styles.section}>
          <Text style={styles.sectionLabel}>Settings</Text>
          <Text style={styles.sectionDescription}>Manage your account and app preferences.</Text>

          <View style={styles.navPanel}>
            {canToggleAdmin ? (
              <>
                <TouchableOpacity style={styles.navItem} onPress={onToggleAdmin} activeOpacity={0.8}>
                  <View style={styles.navItemContent}>
                    <Feather name="shield" size={18} color={colors.text} />
                    <View style={styles.navTextGroup}>
                      <Text style={styles.navLabel}>Admin Mode</Text>
                      <Text style={styles.navDescription}>
                        {isAdminView ? 'Tap to switch to member view.' : 'Tap to switch to admin view.'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.statusBadge, !isAdminView && styles.statusBadgeMuted]}>
                    {isAdminView ? 'Admin view' : 'Member view'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.navSpacer} />
              </>
            ) : (
              <>
                <Text style={styles.lockedCopy}>Admin controls are unavailable for your account.</Text>
                <View style={styles.navSpacer} />
              </>
            )}

            <TouchableOpacity style={[styles.navItem, styles.logoutItem]} onPress={onLogout} activeOpacity={0.8}>
              <View style={styles.navItemContent}>
                <Feather name="log-out" size={18} color={colors.error} />
                <Text style={[styles.navLabel, styles.logoutLabel]}>Log out</Text>
              </View>
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
    gap: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 220,
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
  navSpacer: {
    flex: 1,
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
});
