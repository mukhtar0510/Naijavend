import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input } from '../components/ui';
import { colors, spacing, typography } from '../theme/tokens';
import { signIn, signUp } from '../store/useSessionStore';

export function SignInScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'signin') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('Confirm')) setMessage('Account created — confirm your email, then sign in.');
      else Alert.alert('Sign in failed', msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.content}>
          <Text style={styles.logo}>
            iDev<Text style={{ color: colors.blue }}>Tenancy</Text>
          </Text>
          <Text style={styles.tagline}>Run your store from your phone.</Text>

          <Card elevated style={{ marginTop: spacing.xl }}>
            <Input
              placeholder="Email"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              style={{ marginBottom: spacing.s }}
            />
            <Input placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
            {message && <Text style={styles.message}>{message}</Text>}
            <Button label={mode === 'signin' ? 'Sign in' : 'Create account'} onPress={submit} busy={busy} style={{ marginTop: spacing.m }} />
            <Text
              onPress={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              style={styles.switchMode}
            >
              {mode === 'signin' ? 'New here? Create an account' : 'Already selling? Sign in'}
            </Text>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { flex: 1, justifyContent: 'center', padding: spacing.l },
  logo: { ...typography.heading, color: colors.text, textAlign: 'center' },
  tagline: { ...typography.small, textAlign: 'center', marginTop: spacing.xs },
  message: { color: colors.success, fontSize: 13, marginTop: spacing.s },
  switchMode: { color: colors.blue, textAlign: 'center', marginTop: spacing.m, fontSize: 14 },
});
