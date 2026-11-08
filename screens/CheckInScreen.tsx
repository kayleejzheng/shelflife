// The amount sheet sits at the same spot in every view, so it stays open when the last card is answered.
// Weekly stock check-in: swipe right = still have it, left = gone. Ends with "All caught up".
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, PanResponder, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { categorize } from '../lib/categories';
import { colors, freshness, FRESHNESS_LABEL, plural } from '../lib/theme';
import { addedAgo, daysOf, finishItem, fraction, isStale, Item, ITEM_COLUMNS, itemCategory, leftLabel, unitWord } from '../lib/items';
import { Button, Card, CategoryIcon, Checkbox, Header, ProgressBar, Screen, Sheet, T, Tag, TextLink, Title } from '../components/ui';

const SWIPE = 110;
// Which way a swipe counts as "keep". Flip to 1 / -1 if it ever feels backwards on your phone.
const KEEP_DIR = -1;

// Step for the +/- buttons: quarters for small amounts (1 gal milk -> 3/4 -> 1/2), whole units for bigger counts (12 eggs)
function stepFor(item: Item) {
  return (item.quantity ?? 1) >= 4 ? 1 : 0.25;
}

export default function CheckInScreen() {
  const { userId, circle, pop, goTab } = useApp();
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [index, setIndex] = useState(0);
  const [kept, setKept] = useState(0);
  const [gone, setGone] = useState<Item[]>([]);
  const [toList, setToList] = useState<string[]>([]);
  const pos = useRef(new Animated.ValueXY()).current;
  // "How much is left?" sheet shown after "Still have it"
  const [adjust, setAdjust] = useState<{ item: Item; value: number } | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from('items').select(ITEM_COLUMNS).eq('status', 'in_stock').eq('owner_id', userId).order('checked_at');
      if (error) return Alert.alert('Load failed', error.message);
      const all = (data ?? []) as Item[];
      const stale = all.filter(isStale);
      setQueue(stale.length ? stale : all); // nothing stale? check everything
    })();
  }, [userId]);

  const current = queue?.[index];

  async function answer(have: boolean) {
    if (!current) return;
    const item = current;
    Animated.timing(pos, { toValue: { x: (have ? KEEP_DIR : -KEEP_DIR) * 500, y: 0 }, duration: 200, useNativeDriver: false }).start(() => {
      pos.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);
    });
    if (have) {
      setKept((k) => k + 1);
      // default = what's left right now, e.g. 1 gal of milk -> 1
      setAdjust({ item, value: (item.quantity ?? 1) * (item.amount_left ?? 1) });
    } else {
      setGone((g) => [...g, item]);
      setToList((l) => [...l, item.id]);
      await finishItem(item);
    }
  }

  // Save the amount from the sheet. More than before = restocked; 0 = it's gone.
  async function saveAmount(keepAsIs = false) {
    if (!adjust) return;
    const { item, value } = adjust;
    setAdjust(null);
    const now = new Date().toISOString();
    if (keepAsIs) {
      await supabase.from('items').update({ checked_at: now }).eq('id', item.id);
      return;
    }
    if (value <= 0) {
      setKept((k) => k - 1);
      setGone((g) => [...g, item]);
      setToList((l) => [...l, item.id]);
      await finishItem(item);
      return;
    }
    const qty = item.quantity ?? 1;
    const patch = value > qty ? { quantity: value, amount_left: 1, checked_at: now } : { amount_left: value / qty, checked_at: now };
    const { error } = await supabase.from('items').update(patch).eq('id', item.id);
    if (error) Alert.alert('Update failed', error.message);
  }

  function skip() {
    setIndex((i) => i + 1);
  }

  const answerRef = useRef(answer);
  answerRef.current = answer;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8,
      onPanResponderMove: Animated.event([null, { dx: pos.x, dy: pos.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, g) => {
        if (g.dx * KEEP_DIR > SWIPE) answerRef.current(true);
        else if (g.dx * KEEP_DIR < -SWIPE) answerRef.current(false);
        else Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
      },
    })
  ).current;

  async function addToList() {
    const picked = gone.filter((g) => toList.includes(g.id));
    if (picked.length) {
      const { error } = await supabase.from('grocery_items').insert(
        picked.map((p) => ({ name: p.name, quantity: '1', category: p.category ?? categorize(p.name), circle_id: circle?.id ?? null }))
      );
      if (error) return Alert.alert('Could not add', error.message);
    }
    if (picked.length) goTab('grocery');
    else pop();
  }


  const adjustSheet = (
    <Sheet visible={!!adjust} onClose={() => saveAmount(true)}>
      {adjust ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CategoryIcon category={itemCategory(adjust.item)} size={50} />
            <View style={{ flex: 1 }}>
              <Title size={28} color={colors.ink}>{adjust.item.name}</Title>
              <T size={13} weight="semibold" color={colors.brownLight}>{`Before: ${leftLabel(adjust.item)}`}</T>
            </View>
          </View>
          <T size={18} weight="heavy" center>How much is left?</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingVertical: 6 }}>
            <Pressable
              onPress={() => setAdjust((a) => (a ? { ...a, value: Math.max(0, +(a.value - stepFor(a.item)).toFixed(2)) } : a))}
              hitSlop={8}
              style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: colors.walnut, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="remove" size={28} color={colors.walnut} />
            </Pressable>
            <View style={{ minWidth: 120, alignItems: 'center' }}>
              <Title size={44} color={adjust.value <= 0 ? colors.terra : colors.ink}>{adjust.value <= 0 ? '0' : fraction(adjust.value)}</Title>
              <T size={15} weight="bold" color={colors.brownLight}>{unitWord(adjust.item.unit, adjust.value)}</T>
            </View>
            <Pressable
              onPress={() => setAdjust((a) => (a ? { ...a, value: +(a.value + stepFor(a.item)).toFixed(2) } : a))}
              hitSlop={8}
              style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="add" size={28} color={colors.forest} />
            </Pressable>
          </View>
          {adjust.value <= 0 ? (
            <T size={13} weight="semibold" color={colors.terra} center>Saving 0 marks it as used up.</T>
          ) : (
            <T size={13} weight="regular" color={colors.brownLight} center>
              {`Tap - or + to change it by ${stepFor(adjust.item) === 1 ? '1' : '1/4'}. Your roommates see the new amount.`}
            </T>
          )}
          <Button label={adjust.value <= 0 ? 'Mark as used up' : 'Save'} onPress={() => saveAmount()} />
          <View style={{ alignItems: 'center' }}>
            <TextLink label="Same as before" color={colors.walnut} onPress={() => saveAmount(true)} />
          </View>
        </>
      ) : null}
    </Sheet>
  );

  if (!queue) {
    return (
      <>
      <Screen>
        <Header title="Check-in" onBack={pop} />
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      </Screen>
      {adjustSheet}
      </>
    );
  }

  // ---------- All caught up ----------
  if (!current) {
    return (
      <>
      <Screen
        footer={
          gone.length ? (
            <>
              <Button label={toList.length ? `Add ${plural(toList.length, 'item')} to grocery list` : 'Done'} onPress={addToList} />
              {toList.length ? <View style={{ alignItems: 'center' }}><TextLink label="Not now" onPress={pop} color={colors.walnut} /></View> : null}
            </>
          ) : (
            <Button label="Back to pantry" onPress={pop} />
          )
        }
      >
        <Header title="Check-in" onBack={pop} />
        <View style={{ alignItems: 'center', gap: 6, marginTop: 6 }}>
          <View style={{ width: '100%', borderRadius: 24, overflow: 'hidden', borderWidth: 2, borderColor: colors.walnut }}>
            <Image source={require('../assets/buddy.png')} style={{ width: '100%', aspectRatio: 342 / 204 }} />
          </View>
          <Title size={40} center>All caught up!</Title>
          <T size={15} weight="regular" color={colors.brownLight} center>
            {queue.length
              ? `You checked ${plural(kept + gone.length, 'item')}. ${kept} still in your pantry${gone.length ? `, ${gone.length} gone` : ''}.`
              : 'Nothing to check yet. Scan a receipt to fill your pantry.'}
          </T>
        </View>
        {gone.length ? (
          <Card style={{ gap: 4 }}>
            <T size={16} weight="heavy">Restock what ran out?</T>
            <T size={13} weight="regular" color={colors.brownLight}>Pick what to add to your grocery list.</T>
            {gone.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setToList((l) => (l.includes(g.id) ? l.filter((x) => x !== g.id) : [...l, g.id]))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.linePaper }}
              >
                <CategoryIcon category={itemCategory(g)} size={32} />
                <T size={15} weight="bold" style={{ flex: 1 }}>{g.name}</T>
                <Checkbox checked={toList.includes(g.id)} onPress={() => setToList((l) => (l.includes(g.id) ? l.filter((x) => x !== g.id) : [...l, g.id]))} />
              </Pressable>
            ))}
          </Card>
        ) : null}
      </Screen>
      {adjustSheet}
      </>
    );
  }

  // ---------- Swipe card ----------
  const f = freshness(daysOf(current));
  const rotate = pos.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ['-12deg', '0deg', '12deg'] });
  const keepOpacity = Animated.multiply(pos.x, KEEP_DIR).interpolate({ inputRange: [0, SWIPE], outputRange: [0, 1], extrapolate: 'clamp' });
  const goneOpacity = Animated.multiply(pos.x, KEEP_DIR).interpolate({ inputRange: [-SWIPE, 0], outputRange: [1, 0], extrapolate: 'clamp' });

  return (
    <>
    <Screen scroll={false}>
      <Header title="Check-in" onBack={pop} right={<T size={14} weight="heavy" color={colors.brownLight}>{`${index + 1} of ${queue.length}`}</T>} />
      <ProgressBar value={index / queue.length} color={colors.sage} />
      <Title size={38} center style={{ marginTop: 10 }}>Still have it?</Title>
      <T size={14} weight="regular" color={colors.brownLight} center>Swipe left if it's gone, right if you still have it.</T>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {/* stacked paper behind */}
        <View style={{ position: 'absolute', width: '86%', height: 300, backgroundColor: colors.kraft, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, transform: [{ rotate: '4deg' }] }} />
        <View style={{ position: 'absolute', width: '86%', height: 300, backgroundColor: colors.kraft, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, transform: [{ rotate: '-3deg' }] }} />
        <Animated.View
          {...pan.panHandlers}
          style={{
            width: '86%', height: 300, backgroundColor: colors.kraft, borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, padding: 12,
            transform: [{ translateX: pos.x }, { translateY: pos.y }, { rotate }],
          }}
        >
          <View style={{ flex: 1, backgroundColor: colors.field, borderRadius: 12, borderWidth: 1, borderColor: colors.linePaper, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <View style={{ position: 'absolute', top: -18, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.amber, borderWidth: 2, borderColor: colors.walnut }} />
            <CategoryIcon category={itemCategory(current)} size={76} />
            <Title size={32} color={colors.ink} center>{current.name}</Title>
            <T size={16} weight="bold" color={colors.brownLight}>{leftLabel(current)}</T>
            {f !== 'none' ? <Tag label={FRESHNESS_LABEL[f]} tone={f === 'soon' ? 'terra' : f === 'week' ? 'amber' : 'sage'} dot center /> : null}
            <T size={12} weight="regular" color={colors.brownLight}>{addedAgo(current)}</T>
          </View>
          <Animated.View style={{ position: 'absolute', top: 20, right: 20, opacity: keepOpacity, transform: [{ rotate: '10deg' }] }}>
            <Tag label="KEEP" tone="green" />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', top: 20, left: 20, opacity: goneOpacity, transform: [{ rotate: '-10deg' }] }}>
            <Tag label="GONE" tone="terra" />
          </Animated.View>
        </Animated.View>
      </View>

      {/* Always left-to-right so the buttons sit on the same side you swipe: left = gone, right = keep */}
      <View style={{ flexDirection: 'row', direction: 'ltr', justifyContent: 'space-around', paddingBottom: 8 }}>
        <Pressable onPress={() => answer(false)} style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.terraTint, borderWidth: 2, borderColor: colors.terra, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={30} color={colors.terra} />
          </View>
          <T size={13} weight="heavy" color={colors.terra}>{"← Don't have it"}</T>
        </Pressable>
        <Pressable onPress={() => answer(true)} style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={30} color={colors.forest} />
          </View>
          <T size={13} weight="heavy" color={colors.forest}>{'Still have it →'}</T>
        </Pressable>
      </View>
      <View style={{ alignItems: 'center', paddingBottom: 6 }}>
        <Pressable onPress={skip}>
          <T size={13} weight="regular" color={colors.brownLight}>Swipe or tap. You can <T size={13} weight="heavy" color={colors.walnut} style={{ textDecorationLine: 'underline' }}>skip</T> any item.</T>
        </Pressable>
      </View>
    </Screen>
    {adjustSheet}
    </>
  );
}
