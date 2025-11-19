import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radii, spacing } from '../styles/theme';
import { TabKey } from '../components/BottomNav';
import { User } from '../types';
import { Card } from '../components/Card';
import { SectionCard } from '../components/SectionCard';

type HomeScreenProps = {
  user: User;
  onNavigate: (tab: TabKey) => void;
};

type NavTile = {
  key: TabKey;
  label: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
};

const navTiles: NavTile[] = [
  { key: 'announcements', label: 'Announcements', description: 'Read or post chapter updates.', icon: 'message-circle' },
  { key: 'events', label: 'Events', description: 'Upcoming actions, canvasses, and trainings.', icon: 'flag' },
  { key: 'workingGroups', label: 'Working Groups', description: 'Who does what and who is on the committee.', icon: 'users' },
  { key: 'support', label: 'Support & app details', description: 'Find links and app info.', icon: 'life-buoy' },
  { key: 'settings', label: 'Settings', description: 'Manage your account and admin tools.', icon: 'settings' },
];

export function HomeScreen({ user, onNavigate }: HomeScreenProps) {
  const friendlyName = user.email.split('@')[0];

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        <Card style={styles.greetingCard}>
          <View style={styles.greetingHeader}>
            <View>
              <Text style={styles.eyebrow}>Welcome back</Text>
              <Text style={styles.greetingTitle}>Hello comrade {friendlyName}</Text>
              <Text style={styles.roleTag}>{user.role === 'admin' ? 'Admin' : 'Member'}</Text>
            </View>
          </View>
          <Text style={styles.greetingSubcopy}>Choose where to go next.</Text>
        </Card>

        <SectionCard style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Navigate the app</Text>
          <Text style={styles.info}>Jump to the areas people ask for most often.</Text>
          <View style={styles.tileGrid}>
            {navTiles.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.tile}
                activeOpacity={0.85}
                onPress={() => onNavigate(item.key)}
              >
                <View style={styles.tileIcon}>
                  <Feather name={item.icon} size={18} color={colors.text} />
                </View>
                <View style={styles.tileCopy}>
                  <Text style={styles.tileLabel}>{item.label}</Text>
                  <Text style={styles.tileDescription}>{item.description}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
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
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl * 4,
  },
  greetingCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  greetingHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.lg,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  greetingSubcopy: {
    color: colors.textMuted,
    fontSize: 13,
  },
  roleTag: {
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.bannerMemberBg,
    color: colors.bannerMemberText,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  info: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  tileGrid: {
    gap: spacing.sm,
  },
  tile: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileCopy: {
    flex: 1,
    gap: spacing.xs / 2,
  },
  tileLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  tileDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
