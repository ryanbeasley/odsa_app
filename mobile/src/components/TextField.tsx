import { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

type TextFieldProps = TextInputProps & {
  label?: string;
  helperText?: string;
};

/**
 * Standardized text input with optional label/helper text styling.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(({ label, helperText, style, ...rest }, ref) => (
  <View style={styles.container}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      ref={ref}
      placeholderTextColor="#b8adad"
      style={[styles.input, rest.multiline && styles.multiline, style]}
      {...rest}
    />
    {helperText ? <Text style={styles.helper}>{helperText}</Text> : null}
  </View>
));

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.xs / 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  helper: {
    fontSize: 12,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
    minHeight: 48,
  },
  multiline: {
    textAlignVertical: 'top',
  },
});
