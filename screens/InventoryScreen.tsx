// Pantry tab: buddy home, check-in banner, search + filters, "Use these first", expandable item cards.
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { CATEGORY_ORDER, fitsDiet, FOOD_TYPES } from '../lib/categories';
import {
  colors, daysLabel, DIETS, Freshness, freshness, FRESHNESS_COLOR, FRESHNESS_LABEL, plural,
} from '../lib/theme';
import {
  addedAgo, daysOf, finishItem, freshnessFraction, isStale, Item, itemCategory, leftLabel, loadPantry, qtyLabel,
} from '../lib/items';
import { lookupNutrition, Nutrition } from '../lib/nutrition';
import ItemEditSheet, { ItemDraft } from '../components/ItemEditSheet';
import {
  Avatar, Button, Card, CategoryIcon, Chip, ChipRow, EmptyText, IconButton, ItemCard, ProgressBar, Screen, SearchBar,
  SectionLabel, Segmented, Sheet, T, Tag, TextLink, Title,
} from '../components/ui';

type Who = 'all' | 'mine' | 'others';
type Sort = 'expiring' | 'az' | 'recent';
type Filters = { sort: Sort; fresh: Freshness[]; types: string[]; diets: string[] };
const NO_FILTERS: Filters = { sort: 'expiring', fresh: [], types: [], diets: [] };
const SORTS: { key: Sort; label: string }[] = [
  { key: 'expiring', label: 'Expiring soonest' },
  { key: 'az', label: 'A to Z' },
  { key: 'recent', label: 'Recently added' },
];
const AMOUNTS = [
  { v: 1, label: 'Full' },
  { v: 0.75, label: '3/4' },
  { v: 0.5, label: '1/2' },
  { v: 0.25, label: '1/4' },
  { v: 0.1, label: 'Almost out' },
];

export default function InventoryScreen() {
  const { userId, circle, profile, push, goTab, nameOf, logActivity, members } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [who, setWho] = useState<Who>('all');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [draft, setDraft] = useState<Filters>(NO_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: Item; draft: ItemDraft } | null>(null);
  const [nutrition, setNutrition] = useState<{ item: Item; data: Nutrition | null; loading: boolean } | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    const { data, error } = await loadPantry();
    setRefreshing(false);
    setLoading(false);
    if (error) return Alert.alert('Load failed', error.message);
    setItems((data ?? []) as Item[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mine = items.filter((i) => i.owner_id === userId);
  const staleCount = mine.filter(isStale).length;
  const othersLabel = circle?.kind || 'Roommates';

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (who === 'mine' && i.owner_id !== userId) return false;
      if (who === 'others' && i.owner_id === userId) return false;
      if (filters.fresh.length && !filters.fresh.includes(freshness(daysOf(i)))) return false;
      if (filters.types.length && !filters.types.includes(itemCategory(i))) return false;
      if (filters.diets.some((d) => !fitsDiet(i.name, itemCategory(i), d))) return false;
      return true;
    });
    const big = Number.MAX_SAFE_INTEGER;
    if (filters.sort === 'az') rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (filters.sort === 'recent') rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    else rows.sort((a, b) => (daysOf(a) ?? big) - (daysOf(b) ?? big) || a.name.localeCompare(b.name));
    return rows;
  }, [items, search, who, filters, userId]);

  const soon = filters.sort === 'expiring' ? visible.filter((i) => freshness(daysOf(i)) === 'soon') : [];
  const rest = filters.sort === 'expiring' ? visible.filter((i) => freshness(daysOf(i)) !== 'soon') : visible;
  // Likely to go unused: yours, expiring soon, and most of it still left
  const atRisk = mine.filter((i) => freshness(daysOf(i)) === 'soon' && (i.amount_left ?? 1) >= 0.5);

  const activeChips = [
    ...(filters.sort !== 'expiring' ? [{ label: SORTS.find((s) => s.key === filters.sort)!.label, clear: () => setFilters((f) => ({ ...f, sort: 'expiring' as Sort })) }] : []),
    ...filters.fresh.map((f) => ({ label: FRESHNESS_LABEL[f], clear: () => setFilters((x) => ({ ...x, fresh: x.fresh.filter((y) => y !== f) })) })),
    ...filters.types.map((t) => ({ label: t, clear: () => setFilters((x) => ({ ...x, types: x.types.filter((y) => y !== t) })) })),
    ...filters.diets.map((d) => ({ label: d, clear: () => setFilters((x) => ({ ...x, diets: x.diets.filter((y) => y !== d) })) })),
  ];

  // Live count for the sheet's "Show N items" button
  const draftCount = items.filter((i) =>
    (!draft.fresh.length || draft.fresh.includes(freshness(daysOf(i)))) &&
    (!draft.types.length || draft.types.includes(itemCategory(i))) &&
    draft.diets.every((d) => fitsDiet(i.name, itemCategory(i), d))
  ).length;

  async function setAmount(item: Item, v: number) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, amount_left: v, checked_at: new Date().toISOString() } : i)));
    const { error } = await supabase.from('items').update({ amount_left: v, checked_at: new Date().toISOString() }).eq('id', item.id);
    if (error) Alert.alert('Update failed', error.message);
  }

  async function finish(item: Item, status: 'used' | 'wasted') {
    const { error } = await finishItem(item, status);
    if (error) return Alert.alert('Update failed', error.message);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    setOpenId(null);
    logActivity(`${nameOf(userId)} ${status === 'used' ? 'used up' : 'tossed'} ${item.name}`);
  }

  function startEdit(item: Item) {
    setEditing({
      item,
      draft: { name: item.name, quantity: item.quantity ?? 1, unit: item.unit, expires_at: item.expires_at, category: itemCategory(item) },
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const { item, draft } = editing;
    if (!draft.name.trim()) return Alert.alert('Give the item a name');
    const patch = {
      name: draft.name.trim(), quantity: draft.quantity, unit: draft.unit, expires_at: draft.expires_at, category: draft.category,
      checked_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('items').update(patch).eq('id', item.id);
    if (error) return Alert.alert('Save failed', error.message);
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
    setEditing(null);
  }

  function deleteItem(item: Item) {
    Alert.alert(`Remove ${item.name}?`, 'Use this for items added by mistake. It will not count toward your eco score.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('items').delete().eq('id', item.id);
          if (error) return Alert.alert('Could not remove', error.message);
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          setEditing(null);
          setOpenId(null);
        },
      },
    ]);
  }

  async function askFor(item: Item) {
    if (!circle) return;
    const { error } = await supabase.from('circle_requests').insert({ circle_id: circle.id, item_name: item.name });
    if (error) return Alert.alert('Request failed', error.message);
    logActivity(`${nameOf(userId)} asked for ${item.name}`);
    Alert.alert('Request sent', `${nameOf(item.owner_id)} will see it in your circle.`);
  }

  async function showNutrition(item: Item) {
    setNutrition({ item, data: null, loading: true });
    try {
      const data = await lookupNutrition(item.name);
      setNutrition({ item, data, loading: false });
    } catch {
      setNutrition({ item, data: null, loading: false });
    }
  }

  function renderRows(rows: Item[]) {
    const out: ReactNode[] = [];
    let pair: Item[] = [];
    const flush = () => {
      if (!pair.length) return;
      out.push(
        <View key={pair[0].id + 'row'} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {pair.map((i) => (
            <ItemCard key={i.id} name={i.name} subtitle={leftLabel(i)} category={itemCategory(i)} onPress={() => setOpenId(i.id)} />
          ))}
        </View>
      );
      pair = [];
    };
    for (const i of rows) {
      if (i.id === openId) {
        flush();
        out.push(<View key={i.id}>{expanded(i)}</View>);
      } else {
        pair.push(i);
        if (pair.length === 2) flush();
      }
    }
    flush();
    return out;
  }

  function expanded(item: Item) {
    const d = daysOf(item);
    const f = freshness(d);
    const isMine = item.owner_id === userId;
    const owner = members.find((m) => m.id === item.owner_id);
    const amount = item.amount_left ?? 1;
    return (
      <Card style={{ gap: 12, padding: 16 }}>
        <Pressable onPress={() => setOpenId(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <CategoryIcon category={itemCategory(item)} size={46} />
          <View style={{ flex: 1 }}>
            <T size={19} weight="heavy">{item.name}</T>
            <T size={13} weight="semibold" color={colors.brownLight}>{`${itemCategory(item)} · ${qtyLabel(item.quantity, item.unit)}`}</T>
          </View>
          <Tag label={f === 'none' ? 'No date' : FRESHNESS_LABEL[f]} tone={f === 'soon' ? 'terra' : f === 'week' ? 'amber' : 'sage'} />
          {isMine ? <IconButton icon="create-outline" variant="cream" size={36} onPress={() => startEdit(item)} /> : null}
        </Pressable>
        <View style={{ height: 1, backgroundColor: colors.linePaper }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T size={14} weight="bold" color={colors.brownLight}>Freshness</T>
          <T size={14} weight="heavy" color={FRESHNESS_COLOR[f]}>{daysLabel(d)}</T>
        </View>
        <ProgressBar value={freshnessFraction(item)} color={FRESHNESS_COLOR[f]} height={10} marker />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar id={item.owner_id} name={nameOf(item.owner_id)} url={owner?.avatar_url} size={24} />
          <T size={14} weight="regular" color={colors.brownLight}>Added by</T>
          <T size={14} weight="heavy">{isMine ? 'You' : nameOf(item.owner_id)}</T>
          <T size={12} weight="regular" color={colors.brownLight} style={{ marginLeft: 'auto' }}>{addedAgo(item)}</T>
        </View>
        <View style={{ gap: 6 }}>
          <T size={14} weight="bold" color={colors.brownLight}>How many left</T>
          <T size={18} weight="heavy">{leftLabel(item)}</T>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {AMOUNTS.map((a) => {
              const on = amount >= a.v - 0.01;
              const exact = Math.abs(amount - a.v) < 0.01;
              return (
                <Pressable
                  key={a.label}
                  disabled={!isMine}
                  onPress={() => setAmount(item, a.v)}
                  style={{ flex: 1, alignItems: 'center', gap: 4 }}
                >
                  <View style={{ alignSelf: 'stretch', height: 10, borderRadius: 5, backgroundColor: on ? colors.brown : colors.field, borderWidth: exact ? 2 : 0, borderColor: colors.walnut }} />
                  <T size={11} weight={exact ? 'heavy' : 'semibold'} color={exact ? colors.ink : colors.brownLight}>{a.label}</T>
                </Pressable>
              );
            })}
          </View>
          {!isMine ? <T size={12} weight="regular" color={colors.brownLight}>{`Only ${nameOf(item.owner_id)} can update this.`}</T> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button small variant="secondary" label="Nutritional info" onPress={() => showNutrition(item)} style={{ flex: 1 }} />
          {isMine ? (
            <Button small variant="brown" label="Used it up" onPress={() => finish(item, 'used')} style={{ flex: 1 }} />
          ) : (
            <Button small variant="brown" label="Ask for this" onPress={() => askFor(item)} style={{ flex: 1 }} />
          )}
        </View>
        {isMine ? (
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 24 }}>
              <TextLink label="Edit details" color={colors.walnut} onPress={() => startEdit(item)} />
              <TextLink label="Tossed it" color={colors.terra} onPress={() => finish(item, 'wasted')} />
            </View>
          </View>
        ) : null}
      </Card>
    );
  }

  const toggle = <K extends 'fresh' | 'types' | 'diets'>(key: K, v: Filters[K][number]) =>
    setDraft((d) => {
      const list = d[key] as string[];
      return { ...d, [key]: list.includes(v as string) ? list.filter((x) => x !== v) : [...list, v] };
    });

  return (
    <Screen onRefresh={load} refreshing={refreshing}>
      <View>
        <Title size={40}>Pantry</Title>
        <Pressable onPress={() => push('circle')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="people-outline" size={16} color={colors.brownLight} />
          <T size={14} weight="semibold" color={colors.brownLight}>{circle?.name ?? 'Just you · start a circle'}</T>
        </Pressable>
      </View>

      {/* Buddy stage + check-in banner */}
      <View style={{ borderRadius: 26, borderWidth: 2, borderColor: colors.walnut, overflow: 'hidden', backgroundColor: '#DCC8A0' }}>
        <Image source={require('../assets/buddy.png')} style={{ width: '100%', aspectRatio: 342 / 204 }} resizeMode="cover" />
        <View style={{ padding: 12, paddingTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.sage, borderRadius: 16, padding: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: colors.terraTint, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={staleCount ? 'swap-horizontal' : 'checkmark'} size={20} color={colors.terra} />
            </View>
            <View style={{ flex: 1 }}>
              <T size={15} weight="heavy" color={colors.forest}>{staleCount ? 'Time for a quick check-in' : 'Pantry is up to date'}</T>
              <T size={12} weight="semibold" color={colors.forest}>
                {staleCount ? `${plural(staleCount, 'item')} not updated in a week` : 'Check in anytime to keep it that way'}
              </T>
            </View>
            <Pressable onPress={() => push('checkin')} style={{ backgroundColor: colors.input, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 7 }}>
              <T size={14} weight="heavy">Start</T>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <SearchBar placeholder="Search your pantry" value={search} onChangeText={setSearch} />
        <IconButton icon="options-outline" variant="brown" badge={activeChips.length || undefined} onPress={() => { setDraft(filters); setShowFilters(true); }} />
      </View>
      {activeChips.length ? (
        <ChipRow>
          {activeChips.map((c) => (
            <Chip key={c.label} label={c.label} selected icon="close" onPress={c.clear} />
          ))}
          <TextLink label="Clear all" onPress={() => setFilters(NO_FILTERS)} color={colors.brownLight} />
        </ChipRow>
      ) : null}
      {circle ? (
        <Segmented value={who} onChange={setWho} options={[{ key: 'all', label: 'All' }, { key: 'mine', label: 'Mine' }, { key: 'others', label: othersLabel }]} />
      ) : null}

      {atRisk.length ? (
        <Card tone="terra" style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Ionicons name="alert-circle-outline" size={26} color={colors.terra} />
          <View style={{ flex: 1 }}>
            <T size={15} weight="heavy" color={colors.terra}>Likely to go unused</T>
            <T size={13} weight="regular" color={colors.walnut}>
              {`${atRisk.slice(0, 3).map((i) => i.name).join(', ')}. Consider using ${atRisk.length === 1 ? 'it' : 'them'} tonight.`}
            </T>
            <View style={{ marginTop: 4 }}><TextLink label="See recipes" onPress={() => goTab('meals')} color={colors.terra} /></View>
          </View>
        </Card>
      ) : null}

      {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 20 }} /> : null}
      {!loading && visible.length === 0 ? (
        <EmptyText>{items.length ? 'Nothing matches. Try another search or filter.' : 'Your pantry is empty. Tap the scan button to add a receipt.'}</EmptyText>
      ) : null}

      {soon.length ? <SectionLabel>Use these first</SectionLabel> : null}
      {renderRows(soon)}
      {rest.length ? <SectionLabel>{soon.length ? 'Everything else' : filters.sort === 'expiring' ? 'Your pantry' : 'All items'}</SectionLabel> : null}
      {renderRows(rest)}

      {/* Filters sheet */}
      <Sheet visible={showFilters} onClose={() => setShowFilters(false)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title size={32}>Filters</Title>
          <TextLink label="Reset" onPress={() => setDraft(NO_FILTERS)} color={colors.brownLight} />
        </View>
        <T size={15} weight="heavy">Sort by</T>
        <ChipRow>
          {SORTS.map((s) => <Chip key={s.key} label={s.label} selected={draft.sort === s.key} onPress={() => setDraft((d) => ({ ...d, sort: s.key }))} />)}
        </ChipRow>
        <T size={15} weight="heavy">Freshness</T>
        <ChipRow>
          {(['soon', 'week', 'plenty'] as Freshness[]).map((f) => (
            <Chip key={f} label={FRESHNESS_LABEL[f]} dot={FRESHNESS_COLOR[f]} selected={draft.fresh.includes(f)} onPress={() => toggle('fresh', f)} />
          ))}
        </ChipRow>
        <T size={15} weight="heavy">Food type</T>
        <ChipRow>
          {FOOD_TYPES.filter((t) => CATEGORY_ORDER.includes(t)).map((t) => (
            <Chip key={t} label={t} selected={draft.types.includes(t)} onPress={() => toggle('types', t)} />
          ))}
        </ChipRow>
        <T size={15} weight="heavy">Dietary</T>
        <ChipRow>
          {DIETS.slice(0, 4).map((d) => (
            <Chip key={d} label={d} selected={draft.diets.includes(d)} onPress={() => toggle('diets', d)} />
          ))}
        </ChipRow>
        {profile?.dietary?.length ? (
          <TextLink label="Use my dietary preferences" onPress={() => setDraft((d) => ({ ...d, diets: (profile.dietary ?? []).filter((x) => DIETS.slice(0, 4).includes(x)) }))} />
        ) : null}
        <Button label={`Show ${plural(draftCount, 'item')}`} onPress={() => { setFilters(draft); setShowFilters(false); }} />
      </Sheet>

      <ItemEditSheet
        visible={!!editing}
        draft={editing?.draft ?? null}
        onChange={(draft) => setEditing((e) => (e ? { ...e, draft } : e))}
        onDone={saveEdit}
        doneLabel="Save changes"
        onClose={() => setEditing(null)}
        removeLabel="Remove from pantry"
        onRemove={editing ? () => deleteItem(editing.item) : undefined}
      />

      {/* Nutrition sheet */}
      <Sheet visible={!!nutrition} onClose={() => setNutrition(null)}>
        <Title size={30}>{nutrition?.item.name ?? ''}</Title>
        <T size={13} weight="regular" color={colors.brownLight}>Per 100 g · from Open Food Facts</T>
        {nutrition?.loading ? (
          <ActivityIndicator color={colors.green} style={{ marginVertical: 20 }} />
        ) : nutrition?.data ? (
          <Card tone="input" style={{ gap: 0, paddingVertical: 4 }}>
            <T size={13} weight="regular" color={colors.brownLight} style={{ paddingVertical: 8 }}>{`Closest match: ${nutrition.data.product}`}</T>
            {(
              [
                ['Calories', nutrition.data.kcal, 'kcal'],
                ['Protein', nutrition.data.protein, 'g'],
                ['Carbs', nutrition.data.carbs, 'g'],
                ['Sugar', nutrition.data.sugar, 'g'],
                ['Fat', nutrition.data.fat, 'g'],
                ['Fiber', nutrition.data.fiber, 'g'],
              ] as [string, number | undefined, string][]
            ).map(([label, v, u]) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1, borderColor: colors.linePaper }}>
                <T size={15} weight="bold">{label}</T>
                <T size={15} weight="regular" color={colors.brownLight}>{v === undefined ? '-' : `${v} ${u}`}</T>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyText>No nutrition info found for this item.</EmptyText>
        )}
        <Button label="Done" variant="secondary" onPress={() => setNutrition(null)} />
      </Sheet>
    </Screen>
  );
}
