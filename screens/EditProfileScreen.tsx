// Edit profile: photo, display name, dietary preferences (incl. Halal/Kosher), anything to avoid.
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { pickAndUploadAvatar } from '../lib/avatar';
import { colors, DIETS } from '../lib/theme';
import { Button, Chip, ChipRow, Field, Header, ProfilePhoto, Screen, SectionLabel, TextLink } from '../components/ui';
import { DIET_ICONS } from './OnboardingScreen';

export default function EditProfileScreen() {
  const { userId, profile, pop, refresh } = useApp();
  const [name, setName] = useState('');
  const [diets, setDiets] = useState<string[]>([]);
  const [avoid, setAvoid] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile?.display_name ?? '');
    setDiets(profile?.dietary ?? []);
    setAvoid(profile?.avoid ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  async function changePhoto() {
    setUploading(true);
    try {
      const url = await pickAndUploadAvatar(userId);
      if (url) setAvatarUrl(url);
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!name.trim()) return Alert.alert('Add a display name');
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), dietary: diets, avoid: avoid.trim() || null, avatar_url: avatarUrl })
      .eq('id', userId);
    setSaving(false);
    if (error) return Alert.alert('Save failed', error.message);
    await refresh();
    pop();
  }

  return (
    <Screen footer={<Button label={saving ? 'Saving...' : 'Save changes'} onPress={save} disabled={saving || uploading} />}>
      <Header title="Edit profile" onBack={pop} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Pressable onPress={changePhoto}>
          <ProfilePhoto url={avatarUrl} size={120} dashed={!avatarUrl} />
        </Pressable>
        <TextLink label={uploading ? 'Uploading...' : 'Change photo'} onPress={changePhoto} />
      </View>
      <Field label="Display name" value={name} onChangeText={setName} placeholder="Your name" hint="Shown to people in your circles" />
      <SectionLabel>Dietary preferences</SectionLabel>
      <ChipRow>
        {DIETS.map((d) => (
          <Chip key={d} label={d} icon={DIET_ICONS[d]} selected={diets.includes(d)} onPress={() => setDiets((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))} />
        ))}
      </ChipRow>
      <Field label="Anything to avoid?" placeholder="e.g. peanuts, shellfish" value={avoid} onChangeText={setAvoid} hint="Meals with these ingredients won't be suggested" />
      <View style={{ height: 4, backgroundColor: colors.background }} />
    </Screen>
  );
}
