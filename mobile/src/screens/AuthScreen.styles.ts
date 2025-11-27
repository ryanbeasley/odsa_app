import { StyleSheet } from 'react-native';
import { colors } from '../styles/theme';

export const styles = StyleSheet.create({
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subheading: {
    fontSize: 14,
    color: colors.textMuted,
  },
  error: {
    color: colors.error,
  },
});
