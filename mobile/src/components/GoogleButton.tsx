import { StyleSheet, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';
import { AntDesign } from '@expo/vector-icons';
import { colors, radii, spacing } from '../styles/theme';

type GoogleButtonProps = TouchableOpacityProps & {
  loading?: boolean;
};

export function GoogleButton({ loading, disabled, style, ...props }: GoogleButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.buttonDisabled, style]}
      disabled={disabled || loading}
      {...props}
    >
      <View style={styles.content}>
        <AntDesign name="google" size={18} color={colors.primary} />
        <Text style={styles.label}>{loading ? 'Connecting…' : 'Continue with Google'}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    backgroundColor: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontWeight: '600',
  },
});
