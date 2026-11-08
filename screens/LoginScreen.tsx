// Log in, or "Create your account" (onboarding step 1 of 4)
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { colors } from '../lib/theme';
import Logo from '../components/Logo';
import { Button, Field, Screen, T, TextLink, Title } from '../components/ui';
import { StepBar } from './OnboardingScreen';

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const eye = (
    <Pressable onPress={() => setShow((s) => !s)} hitSlop={10}>
      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.walnut} />
    </Pressable>
  );

  function check() {
    if (!email.trim() || !password) {
      Alert.alert('Enter your email and password');
      return false;
    }
    return true;
  }

  async function logIn() {
    if (!check()) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) Alert.alert('Log in failed', error.message);
  }

  async function signUp() {
    if (!check()) return;
    if (password.length < 8) return Alert.alert('Password too short', 'Use at least 8 characters.');
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return Alert.alert('Sign up failed', error.message);
    if (!data.session) Alert.alert('Check your email', 'Confirm your email, then log in.');
  }

  async function forgot() {
    if (!email.trim()) return Alert.alert('Type your email first');
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    Alert.alert(error ? 'Could not send' : 'Email sent', error ? error.message : 'Check your inbox for a reset link.');
  }

  if (mode === 'signup') {
    return (
      <Screen
        footer={
          <>
            <T size={13} weight="regular" color={colors.brownLight} center>
              By creating an account you agree to the Terms and Privacy Policy.
            </T>
            <Button label={busy ? 'Creating...' : 'Create account'} onPress={signUp} disabled={busy} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
              <T size={14} weight="regular" color={colors.brownLight}>Already have an account?</T>
              <TextLink label="Log in" onPress={() => setMode('login')} />
            </View>
          </>
        }
      >
        <StepBar step={1} />
        <View style={{ gap: 2, marginTop: 8 }}>
          <Title size={34} color={colors.ink}>Create your account</Title>
          <T size={15} weight="regular" color={colors.brownLight}>Use your email to get started.</T>
        </View>
        <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} right={eye} hint="At least 8 characters" />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: 80, alignItems: 'stretch' }}>
      <Logo height={170} />
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Title size={52}>ShelfLife</Title>
        <T size={16} weight="semibold" color={colors.brownLight}>Share a pantry. Waste less food.</T>
      </View>
      <View style={{ height: 6 }} />
      <Field label="Email" placeholder="you@example.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Field label="Password" placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry={!show} right={eye} />
      <View style={{ alignItems: 'flex-end' }}>
        <TextLink label="Forgot password?" onPress={forgot} color={colors.brownLight} size={13} />
      </View>
      <Button label={busy ? 'Logging in...' : 'Log in'} onPress={logIn} disabled={busy} />
      <Button label="Create account" variant="secondary" onPress={() => setMode('signup')} />
    </Screen>
  );
}
