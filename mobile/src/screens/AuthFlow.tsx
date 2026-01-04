import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Hero } from '../components/Hero';
import { AuthScreen } from './AuthScreen';
import { useAuth } from '../hooks/useAuth';
import { styles } from './AuthFlow.styles';

/**
 * Container component that manages the login/signup workflow UI.
 */
export function AuthFlow() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  /**
   * Validates local auth fields then triggers the authenticate call.
   */
  const handleSubmit = async () => {
    if (!username.trim() || password.trim().length < 6) {
      auth.setAuthError('Enter a valid username and password (6+ chars).');
      return;
    }
    if (mode === 'signup' && password !== confirmPassword) {
      auth.setAuthError('Passwords do not match.');
      return;
    }
    try {
      await auth.authenticate(mode, { username, password });
      setUsername('');
      setPassword('');
      setConfirmPassword('');
    } catch {
      // handled in hook
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <Hero eyebrow="Orlando DSA" title="Organize for a better Orlando" />
        <AuthScreen
          mode={mode}
          username={username}
          password={password}
          confirmPassword={confirmPassword}
          authError={auth.authError}
          authLoading={auth.authLoading}
          googleLoading={auth.googleLoading}
          onChangeUsername={(value) => {
            auth.setAuthError(null);
            setUsername(value);
          }}
          onChangePassword={(value) => {
            auth.setAuthError(null);
            setPassword(value);
          }}
          onChangeConfirmPassword={(value) => {
            auth.setAuthError(null);
            setConfirmPassword(value);
          }}
          onSubmit={handleSubmit}
          onGoogleSignIn={auth.googleSignIn}
          onToggleMode={() => {
            auth.setAuthError(null);
            setMode((prev) => (prev === 'signup' ? 'login' : 'signup'));
          }}
        />
      </View>
    </ScrollView>
  );
}
