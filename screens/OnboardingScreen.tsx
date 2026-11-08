// Onboarding steps 2-4 (step 1 is "Create your account" in LoginScreen):
// 2 Set up your profile, 3 Dietary preferences, 4 Your circle (Join / Create / Skip).
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { colors, DIETS, plural } from '../lib/theme';
import { pickAndUploadAvatar } from '../lib/avatar';
import { setReminders } from '../lib/notifications';
import {
  Button, Card, Chip, ChipRow, Field, IconName, ProfilePhoto, Screen, Segmented, T, TextLink, Title,
} from '../components/ui';

// "1 of 4" progress dashes at the top of every onboarding step
export function StepBar({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i < step ? colors.sage : colors.kraft }} />
      ))}
      <T size={13} weight="bold" color={colors.brownLight} style={{ marginLeft: 6 }}>{`${step} of ${total}`}</T>
    </View>
  );
}

export const DIET_ICONS: Record<string, IconName> = {
  Vegetarian: 'leaf-outline',
  Vegan: 'flower-outline',
  'Gluten-free': 'nutrition-outline',
  'Dairy-free': 'water-outline',
  'Nut-free': 'shield-checkmark-outline',
  Pescatarian: 'fish-outline',
  Halal: 'moon-outline',
  Kosher: 'restaurant-outline',
};

export const CIRCLE_KINDS: { key: string; icon: IconName }[] = [
  { key: 'Roommates', icon: 'home-outline' },
  { key: 'Family', icon: 'heart-outline' },
  { key: 'Friends', icon: 'star-outline' },
];

type CircleMode = 'join' | 'create' | 'skip';

export default function OnboardingScreen() {
  const { userId, profile, refresh } = useApp();
  const [step, setStep] = useState(2);
  const [busy, setBusy] = useState(false);

  // Step 2
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Step 3
  const [diets, setDiets] = useState<string[]>([]);
  const [avoid, setAvoid] = useState('');
  // Step 4
  const [circleMode, setCircleMode] = useState<CircleMode>('create');
  const [circleName, setCircleName] = useState('');
  const [kind, setKind] = useState('Roommates');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ name: string; member_count: number } | null>(null);

  useEffect(() => {
    setName(profile?.display_name ?? '');
    setAvatarUrl(profile?.avatar_url ?? null);
  }, [profile]);

  // Look up the circle as soon as the code looks complete
  useEffect(() => {
    const c = code.trim();
    if (c.length < 6) return setPreview(null);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('circle_preview', { code: c });
      setPreview(Array.isArray(data) && data.length ? data[0] : null);
    }, 350);
    return () => clearTimeout(t);
  }, [code]);

  async function choosePhoto() {
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

  async function saveProfile() {
    if (!name.trim()) return Alert.alert('Add a display name', 'It is shown to people in your circles.');
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim(), avatar_url: avatarUrl }).eq('id', userId);
    setBusy(false);
    if (error) return Alert.alert('Save failed', error.message);
    setStep(3);
  }

  async function saveDiet(skip = false) {
    setBusy(true);
    const { error } = await supabase
      .from('profiles')
      .update(skip ? { dietary: [], avoid: null } : { dietary: diets, avoid: avoid.trim() || null })
      .eq('id', userId);
    setBusy(false);
    if (error) return Alert.alert('Save failed', error.message);
    setStep(4);
  }

  async function finish(skip = false) {
    setBusy(true);
    try {
      if (!skip && circleMode === 'create') {
        if (!circleName.trim()) throw new Error('Give your circle a name, or tap Skip.');
        const { error } = await supabase.from('circles').insert({ name: circleName.trim(), kind });
        if (error) throw error;
      }
      if (!skip && circleMode === 'join') {
        if (!code.trim()) throw new Error('Type an invite code, or tap Skip.');
        const { data, error } = await supabase.rpc('request_join', { code: code.trim() });
        if (error) throw error;
        Alert.alert('Request sent', `The owner of ${data} will see your request.`);
      }
      const { error } = await supabase.from('profiles').update({ onboarded: true, notifications: true }).eq('id', userId);
      if (error) throw error;
      setReminders(true); // daily expiring + weekly check-in reminders
      await refresh();
    } catch (e) {
      Alert.alert('Could not finish', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (step === 2) {
    return (
      <Screen footer={<Button label={busy ? 'Saving...' : 'Continue'} onPress={saveProfile} disabled={busy || uploading} />}>
        <StepBar step={2} />
        <Title size={34} color={colors.ink} style={{ marginTop: 8 }}>Set up your profile</Title>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <Pressable onPress={choosePhoto}>
            <ProfilePhoto url={avatarUrl} size={104} dashed={!avatarUrl} />
            <View style={{ position: 'absolute', right: 2, bottom: 2, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.green, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="add" size={18} color={colors.cream} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 4 }}>
            <T size={16} weight="heavy">Add a profile photo</T>
            <T size={13} weight="regular" color={colors.brownLight}>Optional - you can add one later</T>
            <Button small variant="secondary" label={uploading ? 'Uploading...' : 'Choose photo'} onPress={choosePhoto} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          </View>
        </View>
        <Field label="Display name" placeholder="Your name" value={name} onChangeText={setName} hint="Shown to people in your circles" />
      </Screen>
    );
  }

  if (step === 3) {
    return (
      <Screen
        footer={
          <>
            <Button label={busy ? 'Saving...' : 'Continue'} onPress={() => saveDiet()} disabled={busy} />
            <View style={{ alignItems: 'center' }}><TextLink label="Skip for now" onPress={() => saveDiet(true)} color={colors.walnut} /></View>
          </>
        }
      >
        <StepBar step={3} />
        <View style={{ gap: 2, marginTop: 8 }}>
          <Title size={34} color={colors.ink}>Dietary preferences</Title>
          <T size={15} weight="regular" color={colors.brownLight}>Used to filter your pantry and suggest meals.</T>
        </View>
        <ChipRow>
          {DIETS.map((d) => (
            <Chip key={d} label={d} icon={DIET_ICONS[d]} selected={diets.includes(d)} onPress={() => setDiets((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))} />
          ))}
        </ChipRow>
        <Field label="Anything to avoid?" placeholder="e.g. peanuts, shellfish" value={avoid} onChangeText={setAvoid} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <>
          <Button label={busy ? 'Finishing...' : 'Finish setup'} onPress={() => finish(circleMode === 'skip')} disabled={busy} />
          <View style={{ alignItems: 'center' }}><TextLink label="Skip for now" onPress={() => finish(true)} color={colors.walnut} /></View>
        </>
      }
    >
      <StepBar step={4} />
      <View style={{ gap: 2, marginTop: 8 }}>
        <Title size={34} color={colors.ink}>Your circle</Title>
        <T size={15} weight="regular" color={colors.brownLight}>Share a pantry with the people you live with.</T>
      </View>
      <Segmented
        tone="brown"
        value={circleMode}
        onChange={setCircleMode}
        options={[{ key: 'join', label: 'Join' }, { key: 'create', label: 'Create' }, { key: 'skip', label: 'Skip' }]}
      />
      {circleMode === 'create' ? (
        <>
          <Field label="Circle name" placeholder="Apt 4B roommates" value={circleName} onChangeText={setCircleName} />
          <T size={14} weight="heavy" color={colors.brownLight}>{"Who's in it?"}</T>
          <ChipRow>
            {CIRCLE_KINDS.map((k) => <Chip key={k.key} label={k.key} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />)}
          </ChipRow>
          <T size={13} weight="regular" color={colors.brownLight}>{"You'll get an invite code to share once you finish."}</T>
        </>
      ) : circleMode === 'join' ? (
        <>
          <Field label="Invite code" placeholder="ABC123" value={code} onChangeText={setCode} autoCapitalize="characters" />
          {preview ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="people" size={22} color={colors.cream} />
              </View>
              <View style={{ flex: 1 }}>
                <T size={16} weight="heavy">{preview.name}</T>
                <T size={13} weight="regular" color={colors.brownLight}>{`${plural(preview.member_count, 'person', 'people')} ${preview.member_count === 1 ? 'is' : 'are'} already in this circle`}</T>
              </View>
            </Card>
          ) : code.trim().length >= 6 ? (
            <T size={13} weight="regular" color={colors.terra}>No circle found with that code yet.</T>
          ) : null}
          <T size={13} weight="regular" color={colors.brownLight}>Tap Finish setup to join. The owner will see your request.</T>
        </>
      ) : (
        <Card tone="input">
          <T size={15} weight="regular" color={colors.brownLight}>You can use ShelfLife on your own and join or create a circle later from your profile.</T>
        </Card>
      )}
    </Screen>
  );
}
