import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionCard } from '../components/SectionCard';
import { colors, spacing } from '../styles/theme';

export function EventsScreen() {
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <SectionCard>
          <Text style={styles.sectionLabel}>Upcoming Events</Text>
          <Text style={styles.placeholderCopy}>Event details will live here. Stay tuned!</Text>
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
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  placeholderCopy: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
