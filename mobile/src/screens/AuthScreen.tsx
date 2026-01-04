import { Text } from 'react-native';
import { Card } from '../components/Card';
import { TextField } from '../components/TextField';
import { PrimaryButton } from '../components/PrimaryButton';
import { SecondaryButton } from '../components/SecondaryButton';
import { GoogleButton } from '../components/GoogleButton';
import { styles } from './AuthScreen.styles';

type AuthMode = 'login' | 'signup';

type AuthScreenProps = {
  mode: AuthMode;
  username: string;
  password: string;
  confirmPassword: string;
  authError: string | null;
  authLoading: boolean;
  googleLoading: boolean;
  onChangeUsername: (value: string) => void;
  onChangePassword: (value: string) => void;
  onChangeConfirmPassword: (value: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onGoogleSignIn: () => void;
};

/**
 * Shared login/signup form used by the auth flow.
 */
export function AuthScreen({
  mode,
  username,
  password,
  confirmPassword,
  authError,
  authLoading,
  googleLoading,
  onChangeUsername,
  onChangePassword,
  onChangeConfirmPassword,
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
        value={username}
        onChangeText={onChangeUsername}
        autoCapitalize="none"
        placeholder="Username"
      />
      <TextField
        value={password}
        onChangeText={onChangePassword}
        secureTextEntry
        placeholder="Password"
      />
      {mode === 'signup' ? (
        <TextField
          value={confirmPassword}
          onChangeText={onChangeConfirmPassword}
          secureTextEntry
          placeholder="Confirm password"
        />
      ) : null}
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

