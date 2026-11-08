// My profile: photo, monthly eco-score jars, Suggestions, My circles.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, IconButton, ProfilePhoto, Screen, SectionLabel, T, Title } from '../components/ui';
import { useApp } from '../lib/app';
import { MonthStat } from '../lib/stats';
import { colors, plural } from '../lib/theme';
import { useEcoStats } from '../lib/useEcoStats';

// A jar filled to the month's eco score
function Jar({ m, current }: { m: MonthStat; current: boolean }) {
  const fill = (m.score ?? 0) / 100;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={{ width: 40, height: 9, borderRadius: 3, backgroundColor: colors.walnut }} />
      <View style={{ width: 44, height: 62, borderRadius: 10, borderWidth: 2, borderColor: current ? colors.forest : colors.line, backgroundColor: colors.input, overflow: 'hidden', justifyContent: 'flex-end' }}>
        <View style={{ height: `${fill * 100}%`, backgroundColor: current ? colors.sage : 'rgba(143,176,143,0.7)' }} />
        <View style={{ position: 'absolute', left: 6, top: 6, width: 4, height: 22, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.7)' }} />
      </View>
      <T size={15} weight="heavy" color={current ? colors.forest : colors.ink}>{m.score === null ? '-' : String(m.score)}</T>
      <T size={12} weight={current ? 'heavy' : 'semibold'} color={current ? colors.forest : colors.brownLight}>{m.label}</T>
    </View>
  );
}

export default function ProfileScreen() {
  const { profile, email, circle, members, push } = useApp();
  const { stats, reload } = useEcoStats();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }

  const ideas = stats?.suggestions.length ?? 0;

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Title size={40}>My Profile</Title>
        <IconButton icon="settings-outline" onPress={() => push('settings')} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <ProfilePhoto url={profile?.avatar_url} size={110} dashed />
        <View style={{ flex: 1, gap: 4 }}>
          <Title size={28} color={colors.ink}>{profile?.display_name ?? 'You'}</Title>
          <T size={14} weight="regular" color={colors.brownLight} numberOfLines={1}>{email}</T>
          <Button small variant="secondary" label="Edit profile" onPress={() => push('editProfile')} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
        </View>
      </View>

      <SectionLabel>Monthly Review</SectionLabel>
      <Pressable onPress={() => push('review')}>
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Title size={26} color={colors.ink}>{`${stats?.current.name ?? 'This month'} Review`}</Title>
              <T size={13} weight="regular" color={colors.brownLight}>Eco score · How well you avoided food waste</T>
            </View>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="chevron-forward" size={18} color={colors.forest} />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
            {(stats?.months ?? []).map((m, i) => <Jar key={m.label + i} m={m} current={i === 4} />)}
          </View>
          {stats && !stats.current.total ? (
            <T size={12} weight="regular" color={colors.brownLight} center>Mark food used or tossed to fill this month&apos;s jar.</T>
          ) : null}
        </Card>
      </Pressable>

      <Pressable onPress={() => push('suggestions')}>
        <Card tone="amber" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="bulb-outline" size={22} color={colors.cream} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={16} weight="heavy">Suggestions</T>
            <T size={13} weight="regular" color={colors.brownLight}>{`${plural(ideas, 'idea')} for next month`}</T>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.walnut} />
        </Card>
      </Pressable>

      <SectionLabel>My Circles</SectionLabel>
      <Pressable onPress={() => push('circle')}>
        <Card tone="input" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: colors.sage }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: circle ? colors.sage : colors.line }} />
          <T size={16} weight="heavy" style={{ flex: 1 }}>{circle ? circle.name : 'Join or create a circle'}</T>
          <T size={14} weight="regular" color={colors.brownLight}>{circle ? plural(members.length, 'person', 'people') : ''}</T>
          {!circle ? <Ionicons name="add" size={20} color={colors.walnut} /> : null}
        </Card>
      </Pressable>
    </Screen>
  );
}
