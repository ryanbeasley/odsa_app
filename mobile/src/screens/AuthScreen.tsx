import { StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../styles/theme';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { GoogleButton } from '../components/GoogleButton';

type AuthMode = 'login' | 'signup';

type AuthScreenProps = {
  mode: AuthMode;
  email: string;
  password: string;
  authError: string | null;
  authLoading: boolean;
  googleLoading: boolean;
  onChangeEmail: (value: string) => void;
  onChangePassword: (value: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onGoogleSignIn: () => void;
};

export function AuthScreen({
  mode,
  email,
  password,
  authError,
  authLoading,
  googleLoading,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onToggleMode,
  onGoogleSignIn,
}: AuthScreenProps) {
  return (
    <Card>
      <Text style={styles.heading}>{mode === 'signup' ? 'Join the chapter' : 'Welcome back'}</Text>
      <Text style={styles.subheading}>
        {mode === 'signup'
          ? 'Create your account to access member updates.'
          : 'Sign in to edit and view the current greeting.'}
      </Text>
      <TextField
        value={email}
        onChangeText={onChangeEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="you@example.com"
      />
      <TextField
        value={password}
        onChangeText={onChangePassword}
        secureTextEntry
        placeholder="Password"
      />
      {authError ? <Text style={styles.error}>{authError}</Text> : null}
      <PrimaryButton label={mode === 'signup' ? 'Create account' : 'Log in'} loading={authLoading} onPress={onSubmit} />
      <GoogleButton onPress={onGoogleSignIn} loading={googleLoading} disabled={googleLoading} />
      <SecondaryButton
        label={mode === 'signup' ? 'Already a member? Log in' : 'Need an account? Sign up'}
        onPress={onToggleMode}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
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
