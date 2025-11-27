import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { colors } from '../styles/theme';
import { TabKey } from '../components/BottomNav';
import { Card } from '../components/Card';
import { SectionCard } from '../components/SectionCard';
import { styles } from './HomeScreen.styles';
import { useAuth } from '../hooks/useAuth';
import { TAB_ROUTES } from '../navigation/tabs';
import { useAppData } from '../providers/AppDataProvider';

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

/**
 * Personalized hub that greets the user and links to key areas.
 */
export function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { eventFilters } = useAppData();
  if (!user) {
    return null;
  }

  const friendlyName = user.email.split('@')[0];
  /**
   * Navigates to the requested tab, resetting filters as needed.
   */
  const handleNavigate = (tab: TabKey) => {
    if (tab === 'events') {
      eventFilters.setAttendingOnly(false);
      eventFilters.clearFocus();
    }
    const target = TAB_ROUTES[tab];
    if (target) {
      router.push(target);
    }
  };

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
                onPress={() => handleNavigate(item.key)}
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
