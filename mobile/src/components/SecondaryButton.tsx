import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

type SecondaryButtonProps = TouchableOpacityProps & {
  label: string;
};

export function SecondaryButton({ label, style, ...props }: SecondaryButtonProps) {
  return (
    <TouchableOpacity style={[styles.button, style]} {...props}>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
  },
  label: {
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
