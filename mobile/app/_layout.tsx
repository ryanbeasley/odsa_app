import { ReactNode } from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { colors } from '../src/styles/theme';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { AuthFlow } from '../src/screens/AuthFlow';

/**
 * Provides the global providers/layout wrapper shared by every route.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.container}>
            <AuthGate>
              <Slot />
            </AuthGate>
          </View>
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * Gates the app content behind authentication, showing the auth flow when needed.
 */
function AuthGate({ children }: { children: ReactNode }) {
  const { user, authHydrating } = useAuth();
  if (authHydrating) {
    return null;
  }
  if (!user) {
    return <AuthFlow />;
  }
  return <>{children}</>;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
});
