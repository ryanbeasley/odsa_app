import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

type HeroProps = {
  eyebrow: string;
  title: string;
};

/**
 * Displays the app-wide hero banner with eyebrow/title styling.
 */
export function Hero({ eyebrow, title }: HeroProps) {
  return (
    <View style={styles.hero}>
      <Text style={styles.heroEyebrow}>{eyebrow}</Text>
      <Text style={styles.heroTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
    width: '100%',
  },
  heroEyebrow: {
    color: colors.heroMuted,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.xs,
  }
});
