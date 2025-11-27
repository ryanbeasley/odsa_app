import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

type PrimaryButtonProps = TouchableOpacityProps & {
  label: string;
  loading?: boolean;
};

/**
 * Primary action button with built-in loading/disabled visuals.
 */
export function PrimaryButton({ label, loading, disabled, style, ...props }: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      accessibilityRole="button"
      style={[styles.button, (isDisabled) && styles.buttonDisabled, style]}
      disabled={isDisabled}
      {...props}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonLabel}>{label}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
