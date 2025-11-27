import { ReactNode } from 'react';
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

type SectionCardProps = ViewProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Lightweight card wrapper for grouping related settings/content sections.
 */
export function SectionCard({ children, style, ...props }: SectionCardProps) {
  return (
    <View style={[styles.sectionCard, style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
});
