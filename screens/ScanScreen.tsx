// Scan tab: entry card -> camera/photos -> "Reading your receipt..." -> Review items (+ edit sheet) -> save.
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, View } from 'react-native';
import ItemEditSheet from '../components/ItemEditSheet';
import {
  Button, Card, CategoryIcon, CategoryPill, DashedButton, Header, Pattern, Screen, SwipeRow, T, Tag, TextLink, Title, Toast,
} from '../components/ui';
import { useApp } from '../lib/app';
import { categorize, groupBy } from '../lib/categories';
import { qtyLabel } from '../lib/items';
import { estimateExpiry } from '../lib/shelfLife';
import { supabase } from '../lib/supabase';
import { colors, plural } from '../lib/theme';

type ScannedItem = { key: string; name: string; rawName: string | null; quantity: number; unit: string | null; expires_at: string | null; category: string };
type Skipped = { name: string; reason: 'Non-food' | 'Not sure'; suggestion?: string };
type Mode = 'idle' | 'reading' | 'review';

let keyCounter = 0;
function makeItem(name: string, rawName: string | null = null): ScannedItem {
  return { key: String(keyCounter++), name, rawName, quantity: 1, unit: null, expires_at: estimateExpiry(name), category: categorize(name) };
}

export default function ScanScreen({ onSaved }: { onSaved: () => void }) {
  const { userId, nameOf, logActivity } = useApp();
  const [mode, setMode] = useState<Mode>('idle');
  const [step, setStep] = useState(0); // 0 reading text, 1 finding items, 2 matching
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [found, setFound] = useState<ScannedItem[]>([]); // revealed one by one while "reading"
  const [skipped, setSkipped] = useState<Skipped[]>([]);
  const [showSkipped, setShowSkipped] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<ScannedItem | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [removed, setRemoved] = useState<{ item: ScannedItem; index: number } | null>(null);
  const scanLine = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode !== 'reading') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [mode, scanLine]);

  async function pickImage(source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return Alert.alert('Camera permission is needed to scan receipts');
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ quality: 1, mediaTypes: ['images'] });
    if (result.canceled) return;

    setMode('reading');
    setStep(0);
    setFound([]);
    const small = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    const timer = setTimeout(() => setStep(1), 1200);
    const { data, error } = await supabase.functions.invoke('scan-receipt', { body: { imageBase64: small.base64 } });
    clearTimeout(timer);

    if (error) {
      setMode('idle');
      let details = error.message;
      try {
        const body = await error.context.json();
        details = body.error ?? JSON.stringify(body);
      } catch {}
      return Alert.alert('Scan failed', `${error.context?.status ?? ''} ${details}`);
    }

    const scanned: ScannedItem[] = (data.items ?? []).map((it: { name: string; rawName?: string }) => makeItem(it.name, it.rawName ?? null));
    setStep(1);
    // reveal found items one at a time, like the Figma "Reading" frame
    for (let i = 0; i < scanned.length; i++) {
      await new Promise((r) => setTimeout(r, 220));
      setFound(scanned.slice(0, i + 1));
    }
    setStep(2);
    setItems(scanned);
    setSkipped(data.skipped ?? []);
    setTimeout(() => setMode('review'), 600);
  }

  function addSkipped(index: number) {
    const s = skipped[index];
    setItems((prev) => [...prev, makeItem(s.suggestion || s.name, s.name)]);
    setSkipped((prev) => prev.filter((_, i) => i !== index));
  }

  function openNew() {
    setIsNew(true);
    setEdit(makeItem(''));
  }

  function saveEdit() {
    if (!edit) return;
    if (!edit.name.trim()) return Alert.alert('Give the item a name');
    const clean = { ...edit, name: edit.name.trim() };
    setItems((prev) => (isNew ? [...prev, clean] : prev.map((p) => (p.key === clean.key ? clean : p))));
    setEdit(null);
    setIsNew(false);
  }

  // Swipe right on a review row to remove a wrongly scanned item (with Undo)
  function removeItem(key: string) {
    const index = items.findIndex((x) => x.key === key);
    if (index < 0) return;
    setRemoved({ item: items[index], index });
    setItems((prev) => prev.filter((x) => x.key !== key));
    setTimeout(() => setRemoved((r) => (r?.item.key === key ? null : r)), 4000);
  }

  function undoRemove() {
    if (!removed) return;
    const { item, index } = removed;
    setItems((prev) => [...prev.slice(0, index), item, ...prev.slice(index)]);
    setRemoved(null);
  }

  async function saveAll() {
    if (!items.length) return;
    setSaving(true);
    const { error } = await supabase.from('items').insert(
      items.map((it) => ({ name: it.name, quantity: it.quantity, unit: it.unit, expires_at: it.expires_at, category: it.category }))
    );
    setSaving(false);
    if (error) return Alert.alert('Save failed', error.message);
    logActivity(`${nameOf(userId)} added ${plural(items.length, 'item')}`);
    setItems([]);
    setSkipped([]);
    setMode('idle');
    onSaved();
  }

  // ---------- Entry ----------
  if (mode === 'idle') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.kraft, justifyContent: 'center', paddingHorizontal: 26, gap: 16 }}>
        <Pattern opacity={0.6} />
        <View style={{ alignItems: 'center', gap: 4 }}>
          <Ionicons name="receipt-outline" size={56} color={colors.walnut} />
          <Title size={40} color={colors.ink}>Scan a Receipt</Title>
          <T size={15} weight="regular" color={colors.walnut} center>Lay it flat in good light so every line shows.</T>
        </View>
        <View style={{ backgroundColor: colors.kraft, borderRadius: 22, borderWidth: 2, borderColor: colors.line, padding: 12, gap: 10 }}>
          <Pressable onPress={() => pickImage('camera')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.input, borderRadius: 16, borderWidth: 1.5, borderColor: colors.line, padding: 16 }}>
            <Ionicons name="scan-outline" size={22} color={colors.walnut} />
            <T size={17} weight="heavy" color={colors.walnut}>Scan receipt</T>
          </Pressable>
          <Pressable onPress={() => pickImage('library')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.sage, borderRadius: 16, padding: 16 }}>
            <Ionicons name="image-outline" size={22} color={colors.forest} />
            <T size={17} weight="heavy" color={colors.forest}>Upload from photos</T>
          </Pressable>
        </View>
        <View style={{ alignItems: 'center' }}>
          <TextLink label="Or add items by hand" onPress={() => { setItems([]); setSkipped([]); setMode('review'); openNew(); }} color={colors.walnut} />
        </View>
      </View>
    );
  }

  // ---------- Reading ----------
  if (mode === 'reading') {
    const steps = ['Reading text', 'Finding items', 'Matching to your pantry'];
    return (
      <Screen>
        <Header title="" onBack={() => setMode('idle')} />
        <Title size={34} color={colors.green} center>Reading your receipt...</Title>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 150, height: 250, backgroundColor: colors.cream, borderRadius: 6, borderWidth: 1, borderColor: colors.linePaper, padding: 12, gap: 9, overflow: 'hidden' }}>
            {Array.from({ length: 12 }, (_, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: `${45 + ((i * 17) % 35)}%`, height: 5, borderRadius: 3, backgroundColor: colors.linePaper }} />
                <View style={{ width: 18, height: 5, borderRadius: 3, backgroundColor: colors.linePaper }} />
              </View>
            ))}
            <Animated.View
              style={{
                position: 'absolute', left: 0, right: 0, height: 22, backgroundColor: 'rgba(143,176,143,0.45)',
                transform: [{ translateY: scanLine.interpolate({ inputRange: [0, 1], outputRange: [0, 228] }) }],
              }}
            />
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            {found.slice(-6).map((f) => (
              <View key={f.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.kraft, borderRadius: 10, borderWidth: 1, borderColor: colors.line, padding: 6 }}>
                <CategoryIcon category={f.category} size={24} />
                <T size={13} weight="bold" numberOfLines={1} style={{ flex: 1 }}>{f.name}</T>
              </View>
            ))}
          </View>
        </View>
        <View style={{ alignSelf: 'center' }}>
          <Tag label={`${plural(found.length, 'item')} found so far`} tone="amber" dot />
        </View>
        <Card style={{ gap: 0 }}>
          {steps.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.linePaper }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: i <= step ? colors.green : colors.line, backgroundColor: i < step ? colors.green : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {i < step ? <Ionicons name="checkmark" size={14} color={colors.cream} /> : null}
              </View>
              <T size={16} weight={i <= step ? 'heavy' : 'semibold'} color={i <= step ? colors.ink : colors.brownLight}>{s}</T>
            </View>
          ))}
        </Card>
      </Screen>
    );
  }

  // ---------- Review ----------
  const groups = groupBy(items, (i) => i.category);
  return (
    <View style={{ flex: 1 }}>
    <Screen
      footer={
        <Button
          label={saving ? 'Saving...' : items.length ? `Add ${plural(items.length, 'item')} to pantry` : 'Add items to pantry'}
          onPress={saveAll}
          disabled={saving || !items.length}
        />
      }
    >
      <Header title="Review items" onBack={() => setMode('idle')} subtitle="Tap an item to edit it. Swipe right to remove it." />
      {items.length ? (
        <Card style={{ gap: 4 }}>
          {groups.map((g) => (
            <View key={g.category} style={{ gap: 2 }}>
              <CategoryPill label={g.category} />
              {g.rows.map((it, idx) => (
                <SwipeRow key={it.key} direction="right" label="Remove" onAction={() => removeItem(it.key)}>
                <Pressable
                  onPress={() => { setIsNew(false); setEdit(it); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 2, borderTopWidth: idx ? 1 : 0, borderColor: colors.linePaper }}
                >
                  <CategoryIcon category={it.category} size={30} />
                  <T size={16} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{it.name}</T>
                  <T size={13} weight="regular" color={colors.brownLight}>{qtyLabel(it.quantity, it.unit)}</T>
                  <Ionicons name="chevron-forward" size={18} color={colors.walnut} />
                </Pressable>
                </SwipeRow>
              ))}
            </View>
          ))}
        </Card>
      ) : (
        <Card tone="input"><T size={15} weight="regular" color={colors.brownLight}>No food found yet. Add items by hand below.</T></Card>
      )}
      <DashedButton label="Add a missing item" onPress={openNew} />

      {skipped.length ? (
        <Card style={{ gap: 6 }}>
          <Pressable onPress={() => setShowSkipped((s) => !s)} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T size={16} weight="heavy">{`Skipped (${skipped.length})`}</T>
              <T size={13} weight="regular" color={colors.brownLight}>Non-food or unclear lines on the receipt</T>
            </View>
            <Ionicons name={showSkipped ? 'chevron-up' : 'chevron-down'} size={20} color={colors.walnut} />
          </Pressable>
          {showSkipped
            ? skipped.map((s, i) => (
                <View key={`${s.name}${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <T size={15} weight="bold" style={{ flex: 1 }} numberOfLines={1}>{s.name}</T>
                  {s.reason === 'Not sure' ? <TextLink label="Add" onPress={() => addSkipped(i)} /> : null}
                  <Tag label={s.reason} tone={s.reason === 'Not sure' ? 'amber' : 'kraft'} />
                </View>
              ))
            : null}
        </Card>
      ) : null}

      <ItemEditSheet
        visible={!!edit}
        draft={edit}
        rawName={edit?.rawName}
        isNew={isNew}
        onChange={(d) => setEdit((e) => (e ? { ...e, ...d } : e))}
        onDone={saveEdit}
        onClose={() => { setEdit(null); setIsNew(false); }}
        onRemove={!isNew && edit ? () => { removeItem(edit.key); setEdit(null); } : undefined}
      />
    </Screen>
    <Toast message={removed ? `${removed.item.name} removed` : null} actionLabel="Undo" onAction={undoRemove} bottom={100} />
    </View>
  );
}
