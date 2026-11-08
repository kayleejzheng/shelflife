// Settings: account, reminders (expiring food + weekly check-in), support, log out.
import { useEffect, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { setReminders } from '../lib/notifications';
import { colors, SUPPORT_EMAIL } from '../lib/theme';
import { Button, Card, Divider, Header, NavRow, Screen, SectionLabel, T, Toggle } from '../components/ui';
import PromptModal, { PromptField } from '../components/PromptModal';

type Editing = 'email' | 'password' | 'phone' | null;

export default function SettingsScreen() {
  const { userId, email, profile, pop, push, refresh } = useApp();
  const [notifications, setNotifications] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

  useEffect(() => {
    setNotifications(profile?.notifications ?? true);
  }, [profile]);

  async function toggleNotifications(on: boolean) {
    setNotifications(on);
    const ok = await setReminders(on).catch(() => false);
    if (on && !ok) {
      setNotifications(false);
      Alert.alert('Notifications are off', 'Allow notifications for Expo Go in your phone settings to get reminders.');
      return;
    }
    await supabase.from('profiles').update({ notifications: on }).eq('id', userId);
    refresh();
  }

  const forms: Record<Exclude<Editing, null>, { title: string; fields: PromptField[] }> = {
    email: { title: 'Change email', fields: [{ key: 'value', label: 'New email', initial: email, inputProps: { autoCapitalize: 'none', keyboardType: 'email-address' } }] },
    password: { title: 'Change password', fields: [{ key: 'value', label: 'New password', placeholder: 'At least 8 characters', inputProps: { secureTextEntry: true } }] },
    phone: { title: profile?.phone ? 'Phone number' : 'Add phone number', fields: [{ key: 'value', label: 'Phone', initial: profile?.phone ?? '', inputProps: { keyboardType: 'phone-pad' } }] },
  };

  async function submit({ value }: Record<string, string>) {
    const v = value.trim();
    if (editing === 'email') {
      const { error } = await supabase.auth.updateUser({ email: v });
      if (error) return Alert.alert('Could not change email', error.message);
      Alert.alert('Almost done', 'Check your new inbox to confirm the change.');
    } else if (editing === 'password') {
      if (v.length < 8) return Alert.alert('Use at least 8 characters');
      const { error } = await supabase.auth.updateUser({ password: v });
      if (error) return Alert.alert('Could not change password', error.message);
      Alert.alert('Password updated');
    } else if (editing === 'phone') {
      const { error } = await supabase.from('profiles').update({ phone: v || null }).eq('id', userId);
      if (error) return Alert.alert('Could not save', error.message);
      refresh();
    }
    setEditing(null);
  }

  function logOut() {
    Alert.alert('Log out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  return (
    <>
      <Screen>
        <Header title="Settings" onBack={pop} />

        <SectionLabel>Account</SectionLabel>
        <Card tone="input" style={{ gap: 0, paddingVertical: 2 }}>
          <NavRow label="Change email" sublabel={email} onPress={() => setEditing('email')} />
          <Divider />
          <NavRow label="Change password" onPress={() => setEditing('password')} />
          <Divider />
          <NavRow label={profile?.phone ? 'Phone number' : 'Add phone number'} sublabel={profile?.phone ?? undefined} onPress={() => setEditing('phone')} />
          <Divider />
          <NavRow label="Edit profile" sublabel="Name, photo, dietary preferences" onPress={() => push('editProfile')} />
        </Card>

        <SectionLabel>Notifications</SectionLabel>
        <Card tone="input" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T size={16} weight="bold">Reminders</T>
            <T size={13} weight="regular" color={colors.brownLight}>Daily nudge about expiring food, plus a weekly check-in on Sundays to update your stock</T>
          </View>
          <Toggle value={notifications} onChange={toggleNotifications} />
        </Card>

        <SectionLabel>Support</SectionLabel>
        <Card tone="input" style={{ gap: 0, paddingVertical: 2 }}>
          <NavRow label="Help & support" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=ShelfLife%20help`)} />
        </Card>

        <View style={{ marginTop: 12 }}>
          <Button variant="danger" label="Log out" onPress={logOut} />
        </View>
      </Screen>

      {editing && (
        <PromptModal visible title={forms[editing].title} fields={forms[editing].fields} onClose={() => setEditing(null)} onSubmit={submit} />
      )}
    </>
  );
}
