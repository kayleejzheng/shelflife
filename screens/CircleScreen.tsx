// Circle: hero sign, join requests (owner), ingredient requests (Share / Not now), members, activity.
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { matchesIngredient } from '../lib/categories';
import { colors, plural, timeAgo } from '../lib/theme';
import { fraction } from '../lib/items';
import {
  Avatar, Button, Card, Chip, ChipRow, DashedButton, EmptyText, Field, Header, Screen, SectionLabel, Segmented, T, Tag, TextLink,
} from '../components/ui';
import PromptModal from '../components/PromptModal';
import { CIRCLE_KINDS } from './OnboardingScreen';

type JoinRequest = { id: string; user_id: string; created_at: string; name: string };
type IngredientRequest = { id: string; requester_id: string; item_name: string; created_at: string };
type Activity = { id: string; actor_id: string; message: string; created_at: string };

export default function CircleScreen() {
  const { circle, pop, refresh } = useApp();
  if (!circle) return <NoCircle onBack={pop} onDone={refresh} />;
  return <CircleDetail key={circle.id} />;
}

// Shelf scene with the circle's hanging sign
function Hero({ name, count, role }: { name: string; count: number; role: string }) {
  return (
    <View style={{ borderRadius: 24, borderWidth: 2, borderColor: colors.walnut, overflow: 'hidden' }}>
      <Image source={require('../assets/buddy.png')} style={{ width: '100%', aspectRatio: 342 / 204 }} resizeMode="cover" />
      <View style={{ position: 'absolute', top: 10, alignSelf: 'center', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: 70 }}>
          <View style={{ width: 2, height: 10, backgroundColor: colors.walnut }} />
          <View style={{ width: 2, height: 10, backgroundColor: colors.walnut }} />
        </View>
        <View style={{ backgroundColor: colors.kraft, borderWidth: 2, borderColor: colors.walnut, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center', gap: 4 }}>
          <T size={16} weight="heavy">{name}</T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T size={12} weight="semibold" color={colors.brownLight}>{plural(count, 'member')}</T>
            <Tag label={role} tone="green" />
          </View>
        </View>
      </View>
    </View>
  );
}

function CircleDetail() {
  const { userId, circle, members, pop, refresh, nameOf, logActivity } = useApp();
  const c = circle!;
  const isOwner = c.created_by === userId;
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requests, setRequests] = useState<IngredientRequest[]>([]);
  const [hidden, setHidden] = useState<string[]>([]);
  const [myStock, setMyStock] = useState<{ name: string; quantity: number | null; amount_left: number | null }[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [asking, setAsking] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [jr, rq, act, stock] = await Promise.all([
      isOwner
        ? supabase.from('circle_join_requests').select('id, user_id, created_at').eq('circle_id', c.id).eq('status', 'pending')
        : Promise.resolve({ data: [] as { id: string; user_id: string; created_at: string }[] }),
      supabase.from('circle_requests').select('id, requester_id, item_name, created_at').eq('circle_id', c.id).eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('circle_activity').select('id, actor_id, message, created_at').eq('circle_id', c.id).order('created_at', { ascending: false }).limit(10),
      supabase.from('items').select('name, quantity, amount_left').eq('owner_id', userId).eq('status', 'in_stock'),
    ]);
    const pending = jr.data ?? [];
    let names: Record<string, string> = {};
    if (pending.length) {
      const { data: people } = await supabase.from('profiles').select('id, display_name').in('id', pending.map((p) => p.user_id));
      names = Object.fromEntries((people ?? []).map((p) => [p.id, p.display_name ?? 'Someone']));
    }
    setJoinRequests(pending.map((p) => ({ ...p, name: names[p.user_id] ?? 'Someone' })));
    setRequests(rq.data ?? []);
    setActivity(act.data ?? []);
    setMyStock(stock.data ?? []);
    setRefreshing(false);
  }, [isOwner, c.id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(r: JoinRequest) {
    const { error } = await supabase.rpc('approve_join', { request_id: r.id });
    if (error) return Alert.alert('Could not approve', error.message);
    await refresh();
    load();
  }

  async function decline(r: JoinRequest) {
    await supabase.from('circle_join_requests').update({ status: 'declined' }).eq('id', r.id);
    load();
  }

  function removeMember(id: string, name: string) {
    Alert.alert(`Remove ${name}?`, 'They will lose access to the shared pantry and list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('remove_member', { c: c.id, member: id });
          if (error) return Alert.alert('Could not remove', error.message);
          refresh();
        },
      },
    ]);
  }

  async function askFor({ item }: Record<string, string>) {
    if (!item.trim()) return;
    const { error } = await supabase.from('circle_requests').insert({ circle_id: c.id, item_name: item.trim() });
    if (error) return Alert.alert('Request failed', error.message);
    logActivity(`${nameOf(userId)} asked for ${item.trim()}`);
    setAsking(false);
    load();
  }

  async function resolveRequest(r: IngredientRequest, status: 'fulfilled' | 'cancelled') {
    await supabase.from('circle_requests').update({ status, fulfilled_by: status === 'fulfilled' ? userId : null }).eq('id', r.id);
    if (status === 'fulfilled') logActivity(`${nameOf(userId)} shared ${r.item_name} with ${nameOf(r.requester_id)}`);
    load();
  }

  async function rename({ name }: Record<string, string>) {
    if (!name.trim()) return;
    const { error } = await supabase.from('circles').update({ name: name.trim() }).eq('id', c.id);
    if (error) return Alert.alert('Could not rename', error.message);
    setRenaming(false);
    refresh();
  }

  async function setKind(kind: string) {
    await supabase.from('circles').update({ kind }).eq('id', c.id);
    refresh();
  }

  function invite() {
    Share.share({ message: `Join my ShelfLife circle "${c.name}"! In the app, go to Profile > My circles and enter code ${c.invite_code}` });
  }

  function leave() {
    if (isOwner) {
      return Alert.alert('Delete this circle?', 'Everyone will be removed and the shared grocery list will be deleted.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('circles').delete().eq('id', c.id);
            if (error) return Alert.alert('Could not delete', error.message);
            await refresh();
          },
        },
      ]);
    }
    Alert.alert(`Leave ${c.name}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('circle_members').delete().eq('circle_id', c.id).eq('user_id', userId);
          await refresh();
        },
      },
    ]);
  }

  // "you have 8": how much of the requested thing is in your pantry
  function youHave(itemName: string) {
    const word = itemName.replace(/^\d+(\.\d+)?\s*/, '');
    const hits = myStock.filter((s) => matchesIngredient(s.name, word));
    if (!hits.length) return null;
    const n = hits.reduce((sum, h) => sum + (h.quantity ?? 1) * (h.amount_left ?? 1), 0);
    return fraction(n);
  }

  const sortedMembers = [...members].sort((a, b) => (a.id === c.created_by ? -1 : b.id === c.created_by ? 1 : a.id === userId ? -1 : 0));
  const visibleRequests = requests.filter((r) => !hidden.includes(r.id));

  return (
    <>
      <Screen onRefresh={load} refreshing={refreshing}>
        <Header title="Circle" onBack={pop} right={<Button small variant="primary" icon="person-add-outline" label="Invite" onPress={invite} />} />
        <Hero name={c.name} count={members.length} role={isOwner ? 'Owner' : 'Member'} />

        <Card tone="input" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <T size={13} weight="semibold" color={colors.brownLight}>Invite code</T>
            <T size={20} weight="heavy" style={{ letterSpacing: 2 }}>{c.invite_code}</T>
          </View>
          <Button small variant="secondary" icon="share-outline" label="Share" onPress={invite} />
        </Card>

        {joinRequests.map((r) => (
          <Card key={r.id} tone="amber" style={{ gap: 10 }}>
            <T size={16} weight="heavy">{joinRequests.length === 1 ? '1 request to join' : `${joinRequests.length} requests to join`}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar id={r.user_id} name={r.name} size={34} />
              <View>
                <T size={15} weight="heavy">{r.name}</T>
                <T size={12} weight="regular" color={colors.brownLight}>{`Used your invite code · ${timeAgo(r.created_at)}`}</T>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Button small label="Approve" onPress={() => approve(r)} style={{ flex: 1 }} />
              <Button small variant="secondary" label="Decline" onPress={() => decline(r)} style={{ flex: 1 }} />
            </View>
          </Card>
        ))}

        <SectionLabel>Ingredient requests</SectionLabel>
        {visibleRequests.map((r) => {
          const mine = r.requester_id === userId;
          const have = mine ? null : youHave(r.item_name);
          return (
            <Card key={r.id} style={{ gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar id={r.requester_id} name={nameOf(r.requester_id)} url={members.find((m) => m.id === r.requester_id)?.avatar_url} size={34} />
                <View style={{ flex: 1 }}>
                  <T size={15} weight="heavy">{mine ? `You asked for ${r.item_name}` : `${nameOf(r.requester_id)} is asking for ${r.item_name}`}</T>
                  <T size={12} weight="regular" color={colors.brownLight}>{`${timeAgo(r.created_at)}${have ? ` · you have ${have}` : ''}`}</T>
                </View>
              </View>
              {mine ? (
                <View style={{ alignItems: 'flex-end' }}><TextLink label="Cancel request" color={colors.terra} onPress={() => resolveRequest(r, 'cancelled')} /></View>
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button small label="Share" onPress={() => resolveRequest(r, 'fulfilled')} style={{ flex: 1 }} />
                  <Button small variant="secondary" label="Not now" onPress={() => setHidden((h) => [...h, r.id])} style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          );
        })}
        <DashedButton label="Request an ingredient" onPress={() => setAsking(true)} />

        <SectionLabel>{`Members · ${members.length}`}</SectionLabel>
        <Card tone="input" style={{ gap: 0, paddingVertical: 4 }}>
          {sortedMembers.map((m, i) => {
            const owner = m.id === c.created_by;
            return (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderColor: colors.linePaper }}>
                <Avatar id={m.id} name={m.display_name} url={m.avatar_url} size={34} />
                <T size={15} weight="heavy" style={{ flex: 1 }}>{`${m.display_name ?? 'Someone'}${m.id === userId ? ' (you)' : ''}`}</T>
                <Tag label={owner ? 'Owner' : 'Member'} tone={owner ? 'green' : 'kraft'} />
                {isOwner && !owner ? <TextLink label="Remove" color={colors.terra} size={13} onPress={() => removeMember(m.id, m.display_name ?? 'this member')} /> : null}
              </View>
            );
          })}
        </Card>

        {isOwner ? (
          <>
            <SectionLabel right={<TextLink label="Rename" onPress={() => setRenaming(true)} />}>{"Who's in it?"}</SectionLabel>
            <ChipRow>
              {CIRCLE_KINDS.map((k) => <Chip key={k.key} label={k.key} icon={k.icon} selected={(c.kind ?? 'Roommates') === k.key} onPress={() => setKind(k.key)} />)}
            </ChipRow>
          </>
        ) : null}

        <SectionLabel>Recent activity</SectionLabel>
        {activity.length ? (
          <Card tone="input" style={{ gap: 0, paddingVertical: 4 }}>
            {activity.map((a, i) => (
              <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderColor: colors.linePaper }}>
                <Ionicons name="ellipse" size={8} color={colors.sage} />
                <T size={14} weight="semibold" style={{ flex: 1 }}>{a.message}</T>
                <T size={12} weight="regular" color={colors.brownLight}>{timeAgo(a.created_at)}</T>
              </View>
            ))}
          </Card>
        ) : (
          <EmptyText>Nothing yet.</EmptyText>
        )}

        <View style={{ alignItems: 'center', marginTop: 6 }}>
          <TextLink label={isOwner ? 'Delete circle' : 'Leave circle'} color={colors.terra} onPress={leave} />
        </View>
      </Screen>

      <PromptModal
        visible={asking}
        title="Request an ingredient"
        submitLabel="Send request"
        onClose={() => setAsking(false)}
        onSubmit={askFor}
        fields={[{ key: 'item', label: 'What do you need?', placeholder: '2 eggs', hint: 'Everyone in your circle will see it.' }]}
      />
      <PromptModal
        visible={renaming}
        title="Rename circle"
        onClose={() => setRenaming(false)}
        onSubmit={rename}
        fields={[{ key: 'name', label: 'Circle name', initial: c.name }]}
      />
    </>
  );
}

// Shown when you're not in a circle yet (same Join / Create choices as onboarding)
function NoCircle({ onBack, onDone }: { onBack: () => void; onDone: () => Promise<void> }) {
  const [mode, setMode] = useState<'join' | 'create'>('create');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('Roommates');
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<{ name: string; member_count: number } | null>(null);
  const [pending, setPending] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const loadPending = useCallback(async () => {
    const { data } = await supabase.from('circle_join_requests').select('circle_id').eq('status', 'pending');
    setPending((data ?? []).map((d) => d.circle_id));
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const cd = code.trim();
    if (cd.length < 6) return setPreview(null);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('circle_preview', { code: cd });
      setPreview(Array.isArray(data) && data.length ? data[0] : null);
    }, 350);
    return () => clearTimeout(t);
  }, [code]);

  async function create() {
    if (!name.trim()) return Alert.alert('Give your circle a name');
    setBusy(true);
    const { error } = await supabase.from('circles').insert({ name: name.trim(), kind });
    setBusy(false);
    if (error) return Alert.alert('Could not create', error.message);
    await onDone();
  }

  async function join() {
    if (!code.trim()) return Alert.alert('Enter an invite code');
    setBusy(true);
    const { data, error } = await supabase.rpc('request_join', { code: code.trim() });
    setBusy(false);
    if (error) return Alert.alert('Could not join', error.message);
    setCode('');
    loadPending();
    Alert.alert('Request sent', `The owner of ${data} needs to approve you. Pull down here to refresh once they do.`);
  }

  return (
    <Screen onRefresh={() => { loadPending(); onDone(); }}>
      <Header title="Circle" onBack={onBack} subtitle="Share a pantry with the people you live with." />
      {pending.length > 0 && (
        <Card tone="amber">
          <T size={15} weight="semibold">Waiting for the owner to approve your request to join.</T>
        </Card>
      )}
      <Segmented tone="brown" value={mode} onChange={setMode} options={[{ key: 'join', label: 'Join' }, { key: 'create', label: 'Create' }]} />
      {mode === 'create' ? (
        <>
          <Field label="Circle name" placeholder="Apt 4B roommates" value={name} onChangeText={setName} />
          <T size={14} weight="heavy" color={colors.brownLight}>{"Who's in it?"}</T>
          <ChipRow>
            {CIRCLE_KINDS.map((k) => <Chip key={k.key} label={k.key} icon={k.icon} selected={kind === k.key} onPress={() => setKind(k.key)} />)}
          </ChipRow>
          <Button label={busy ? 'Creating...' : 'Create circle'} onPress={create} disabled={busy} />
        </>
      ) : (
        <>
          <Field label="Invite code" placeholder="ABC123" value={code} onChangeText={setCode} autoCapitalize="characters" />
          {preview ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="people" size={24} color={colors.green} />
              <View style={{ flex: 1 }}>
                <T size={16} weight="heavy">{preview.name}</T>
                <T size={13} weight="regular" color={colors.brownLight}>{`${plural(preview.member_count, 'person', 'people')} already in this circle`}</T>
              </View>
            </Card>
          ) : null}
          <Button label={busy ? 'Sending...' : 'Request to join'} onPress={join} disabled={busy} />
        </>
      )}
    </Screen>
  );
}
