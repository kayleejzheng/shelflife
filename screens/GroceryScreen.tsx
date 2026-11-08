// Grocery tab: shared list, add flow (suggestions -> quantity sheet -> Undo toast),
// "Running low" from pantry stock, swipe left to delete.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { categorize, groupBy } from '../lib/categories';
import { colors, fonts } from '../lib/theme';
import { fraction, Item, ITEM_COLUMNS, unitWord } from '../lib/items';
import {
  Avatar, Button, Card, CategoryIcon, CategoryPill, Checkbox, Chip, ChipRow, EmptyText, IconButton, ProgressBar, Screen, Sheet,
  Stepper, SwipeRow, T, Tag, TextLink, Title, Toast,
} from '../components/ui';

type GroceryItem = { id: string; name: string; quantity: string | null; category: string | null; checked: boolean; added_by: string };

const COMMON = [
  'Apples', 'Avocados', 'Bagels', 'Bananas', 'Basil', 'Baby spinach', 'Bacon', 'Black beans', 'Bread', 'Broccoli', 'Butter', 'Carrots',
  'Cheddar', 'Chicken breast', 'Coffee', 'Cream cheese', 'Eggs', 'Garlic', 'Granola', 'Greek yogurt', 'Ground beef', 'Lemons', 'Lettuce',
  'Limes', 'Milk', 'Oat milk', 'Onions', 'Orange juice', 'Pasta', 'Peanut butter', 'Potatoes', 'Rice', 'Salmon', 'Salsa', 'Strawberries',
  'Tomatoes', 'Tortillas', 'Yogurt',
];
const UNITS = ['each', 'lb', 'bag'];

// "6 each" -> "6", "2 lb" stays
function qtyText(n: number, unit: string) {
  return unit === 'each' ? String(n) : `${n} ${unitWord(unit, n)}`;
}

export default function GroceryScreen() {
  const { userId, circle, members, nameOf, logActivity } = useApp();
  const [rows, setRows] = useState<GroceryItem[]>([]);
  const [low, setLow] = useState<Item[]>([]);
  const [hideLow, setHideLow] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState<{ name: string; count: number; unit: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [list, stock, past] = await Promise.all([
      supabase.from('grocery_items').select('id, name, quantity, category, checked, added_by').order('created_at'),
      supabase.from('items').select(ITEM_COLUMNS).eq('owner_id', userId).eq('status', 'in_stock').lte('amount_left', 0.25),
      supabase.from('items').select('name').eq('owner_id', userId).order('created_at', { ascending: false }).limit(60),
    ]);
    setRefreshing(false);
    if (list.error) return Alert.alert('Load failed', list.error.message);
    setRows(list.data ?? []);
    setLow((stock.data ?? []) as Item[]);
    setHistory([...new Set((past.data ?? []).map((p) => p.name))]);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  function showToast(msg: string, undo: () => void) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ msg, undo });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const onList = useMemo(() => new Set(rows.map((r) => r.name.toLowerCase())), [rows]);
  const lowVisible = hideLow ? [] : low.filter((l) => !onList.has(l.name.toLowerCase()));

  const suggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    const pool = [...new Set([...history, ...COMMON])];
    const starts = pool.filter((p) => p.toLowerCase().startsWith(q));
    const contains = pool.filter((p) => !p.toLowerCase().startsWith(q) && p.toLowerCase().includes(q));
    return [...starts, ...contains].slice(0, 5);
  }, [draft, history]);

  async function insert(entries: { name: string; quantity: string }[]) {
    const { data, error } = await supabase
      .from('grocery_items')
      .insert(entries.map((e) => ({ name: e.name, quantity: e.quantity, category: categorize(e.name), circle_id: circle?.id ?? null })))
      .select('id, name, quantity, category, checked, added_by');
    if (error) {
      Alert.alert('Could not add', error.message);
      return [];
    }
    setRows((prev) => [...prev, ...(data ?? [])]);
    return data ?? [];
  }

  async function confirmAdd() {
    if (!adding) return;
    const name = adding.name.trim();
    setAdding(null);
    setDraft('');
    const added = await insert([{ name, quantity: qtyText(adding.count, adding.unit) }]);
    if (added.length) {
      logActivity(`${nameOf(userId)} added ${name} to the grocery list`);
      showToast(`${name} added`, () => remove(added.map((a) => a.id), false));
    }
  }

  function startAdd(name: string) {
    if (!name.trim()) return;
    const clean = name.trim().replace(/^\w/, (c) => c.toUpperCase());
    setAdding({ name: clean, count: 1, unit: 'each' });
  }

  async function addLow(items: Item[]) {
    const added = await insert(items.map((i) => ({ name: i.name, quantity: String(fraction(i.quantity ?? 1)) })));
    if (added.length) showToast(added.length === 1 ? `${added[0].name} added` : `${added.length} items added`, () => remove(added.map((a) => a.id), false));
  }

  async function toggle(item: GroceryItem) {
    const checked = !item.checked;
    setRows((prev) => prev.map((r) => (r.id === item.id ? { ...r, checked } : r)));
    const { error } = await supabase.from('grocery_items').update({ checked, checked_by: checked ? userId : null }).eq('id', item.id);
    if (error) Alert.alert('Update failed', error.message);
  }

  async function remove(ids: string[], withUndo = true) {
    const removed = rows.filter((r) => ids.includes(r.id));
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    await supabase.from('grocery_items').delete().in('id', ids);
    if (withUndo && removed.length) {
      showToast(removed.length === 1 ? `${removed[0].name} removed` : `${removed.length} items removed`, async () => {
        await insert(removed.map((r) => ({ name: r.name, quantity: r.quantity ?? '1' })));
      });
    }
  }

  const done = rows.filter((r) => r.checked).length;
  const groups = groupBy(rows, (r) => r.category || categorize(r.name));

  return (
    <View style={{ flex: 1 }}>
      <Screen onRefresh={load} refreshing={refreshing}>
        <View>
          <Title size={40}>Grocery List</Title>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="people-outline" size={16} color={colors.brownLight} />
            <T size={14} weight="semibold" color={colors.brownLight}>{circle ? `${circle.name} · shared` : 'Just you'}</T>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <View style={{ flex: 1, height: 48, borderRadius: 16, borderWidth: 1.5, borderColor: focused ? colors.green : colors.line, backgroundColor: colors.input, paddingHorizontal: 16, justifyContent: 'center' }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add an item"
              placeholderTextColor={colors.placeholder}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={() => startAdd(draft)}
              returnKeyType="done"
              style={{ fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}
            />
          </View>
          <Pressable onPress={() => startAdd(draft)} style={{ width: 52, height: 48, borderRadius: 14, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={24} color={colors.forest} />
          </Pressable>
        </View>

        {suggestions.length ? (
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {suggestions.map((s, i) => {
              const already = onList.has(s.toLowerCase());
              const q = draft.trim();
              const startsWith = s.toLowerCase().startsWith(q.toLowerCase());
              return (
                <Pressable
                  key={s}
                  disabled={already}
                  onPress={() => startAdd(s)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderColor: colors.linePaper }}
                >
                  <CategoryIcon category={categorize(s)} size={32} />
                  <T size={16} weight="semibold" style={{ flex: 1 }}>
                    {startsWith ? (
                      <>
                        <T size={16} weight="heavy">{s.slice(0, q.length)}</T>
                        {s.slice(q.length)}
                      </>
                    ) : s}
                  </T>
                  {already ? <Tag label="On list" tone="kraft" /> : <IconButton icon="add" variant="sage" size={30} onPress={() => startAdd(s)} />}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        {lowVisible.length && !draft ? (
          <Card tone="amber" style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trending-down" size={16} color={colors.cream} />
              </View>
              <T size={16} weight="heavy" style={{ flex: 1 }}>Running low</T>
              <TextLink label="Ignore all" onPress={() => setHideLow(true)} color={colors.walnut} size={13} />
              <Button small label="Add all" onPress={() => addLow(lowVisible)} style={{ height: 30, paddingHorizontal: 12 }} />
            </View>
            {lowVisible.map((l) => {
              const left = (l.amount_left ?? 1) * (l.quantity ?? 1);
              return (
                <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderTopWidth: 1, borderColor: colors.amber }}>
                  <CategoryIcon category={l.category || categorize(l.name)} size={30} />
                  <T size={15} weight="bold" style={{ flex: 1 }}>{l.name}</T>
                  <T size={13} weight="regular" color={colors.brownLight}>{(l.amount_left ?? 1) <= 0.1 ? 'Almost out' : `${fraction(left)} ${unitWord(l.unit, left)} left`}</T>
                  <IconButton icon="add" variant="sage" size={28} onPress={() => addLow([l])} />
                </View>
              );
            })}
          </Card>
        ) : null}

        {rows.length ? (
          <Card tone="kraft" style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <T size={14} weight="heavy">{`${done} of ${rows.length}`}</T>
              <View style={{ flex: 1 }}><ProgressBar value={rows.length ? done / rows.length : 0} color={colors.sage} /></View>
              {done ? <TextLink label="Clear checked" size={13} color={colors.walnut} onPress={() => remove(rows.filter((r) => r.checked).map((r) => r.id))} /> : null}
            </View>
            {groups.map((g) => (
              <View key={g.category} style={{ gap: 2 }}>
                <CategoryPill label={g.category} />
                {g.rows.map((r) => {
                  const adder = members.find((m) => m.id === r.added_by);
                  return (
                    <SwipeRow key={r.id} onAction={() => remove([r.id])}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, backgroundColor: colors.kraft }}>
                        <Checkbox checked={r.checked} onPress={() => toggle(r)} />
                        <View style={{ opacity: r.checked ? 0.5 : 1 }}><CategoryIcon category={g.category} size={28} /></View>
                        <Pressable onPress={() => toggle(r)} style={{ flex: 1 }}>
                          <T size={16} weight="bold" color={r.checked ? colors.brownLight : colors.ink} strike={r.checked}>{r.name}</T>
                        </Pressable>
                        {r.quantity && r.quantity !== '1' ? <T size={13} weight="regular" color={colors.brownLight}>{r.quantity}</T> : null}
                        <Avatar id={r.added_by} name={nameOf(r.added_by)} url={adder?.avatar_url} size={22} />
                      </View>
                    </SwipeRow>
                  );
                })}
              </View>
            ))}
            <T size={12} weight="regular" color={colors.brownLight} center>Swipe left on an item to delete it.</T>
          </Card>
        ) : !draft ? (
          <EmptyText>Your list is empty. Type above to add something.</EmptyText>
        ) : null}
        <View style={{ height: 50 }} />
      </Screen>

      {/* Quantity sheet */}
      <Sheet visible={!!adding} onClose={() => setAdding(null)}>
        {adding ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <CategoryIcon category={categorize(adding.name)} size={56} />
              <View style={{ gap: 4 }}>
                <Title size={30} color={colors.ink}>{adding.name}</Title>
                <Tag label={categorize(adding.name)} tone="kraft" />
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <T size={16} weight="heavy">How many?</T>
              <Stepper value={adding.count} onChange={(count) => setAdding((a) => (a ? { ...a, count } : a))} />
            </View>
            <ChipRow>
              {UNITS.map((u) => (
                <Chip key={u} label={u} selected={adding.unit === u} onPress={() => setAdding((a) => (a ? { ...a, unit: u } : a))} />
              ))}
            </ChipRow>
            <Button label="Add to list" onPress={confirmAdd} />
          </>
        ) : null}
      </Sheet>

      <Toast message={toast?.msg ?? null} actionLabel="Undo" onAction={() => { toast?.undo(); setToast(null); }} />
    </View>
  );
}
