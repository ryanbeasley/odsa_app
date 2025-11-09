import { forwardRef } from 'react';
import { StyleSheet, TextInput, TextInputProps } from 'react-native';
import { colors, radii, spacing } from '../styles/theme';

export const TextField = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <TextInput
    ref={ref}
    placeholderTextColor="#b8adad"
    style={[styles.input, props.multiline && styles.multiline, props.style]}
    {...props}
  />
));

TextField.displayName = 'TextField';

const styles = StyleSheet.create({
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
