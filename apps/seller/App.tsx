import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from './src/store/useSessionStore';
import { RootNavigator, type Screen } from './src/navigation/RootNavigator';
import { SignInScreen } from './src/screens/SignInScreen';

export default function App() {
  const { session, loading } = useSession();
  const [initialScreen, setInitialScreen] = useState<Screen>('dashboard');

  useEffect(() => {
    if (!session) setInitialScreen('dashboard');
  }, [session]);

  if (loading) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {session ? <RootNavigator initialScreen={initialScreen} /> : <SignInScreen />}
    </SafeAreaProvider>
  );
}
