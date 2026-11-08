// Monthly review stories (eco score ring, what went unused, what went right, your circle).
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../lib/app';
import { useEcoStats } from '../lib/useEcoStats';
import { EcoStats } from '../lib/stats';
import { colors, plural } from '../lib/theme';
import { Avatar, Button, CategoryIcon, Pattern, T, Title } from '../components/ui';

const PANEL = 'rgba(243,234,219,0.10)';
const PANEL_BORDER = 'rgba(243,234,219,0.22)';

function Ring({ score }: { score: number | null }) {
  const size = 210;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = (score ?? 0) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(243,234,219,0.25)" strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2} cy={size / 2} r={r} stroke={colors.cream} strokeWidth={stroke} fill="none"
          strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" rotation={-90} origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Title size={76} color={colors.cream}>{score === null ? '-' : String(score)}</Title>
      <T size={13} weight="semibold" color={colors.cream} style={{ marginTop: -10 }}>eco score</T>
    </View>
  );
}

export default function ReviewScreen() {
  const { pop, push, userId, nameOf, circle, members } = useApp();
  const { stats } = useEcoStats();
  const [page, setPage] = useState(0);
  const pages = circle ? 4 : 3;

  function next() {
    if (page < pages - 1) setPage(page + 1);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.green }}>
      <Pattern tint="#4A6150" />
      <Pressable onPress={next} style={{ flex: 1, paddingHorizontal: 24, paddingTop: 58, paddingBottom: 30 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {Array.from({ length: pages }, (_, i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= page ? colors.cream : 'rgba(243,234,219,0.3)' }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
          <T size={14} weight="bold" color={colors.cream}>{stats?.current.name ?? ''}</T>
          <Pressable onPress={pop} hitSlop={12}>
            <Ionicons name="close" size={28} color={colors.cream} />
          </Pressable>
        </View>
        <View style={{ flex: 1, marginTop: 20 }}>
          {!stats ? <ActivityIndicator color={colors.cream} style={{ marginTop: 80 }} /> : <Story page={page} stats={stats} />}
        </View>
        {page === pages - 1 ? (
          <Button variant="cream" label="See suggestions" onPress={() => { pop(); push('suggestions'); }} />
        ) : (
          <T size={13} weight="semibold" color="rgba(243,234,219,0.7)" center>Tap to continue</T>
        )}
      </Pressable>
    </View>
  );

  function Story({ page: p, stats: s }: { page: number; stats: EcoStats }) {
    if (p === 0) {
      return (
        <View style={{ gap: 18, marginTop: 20 }}>
          <Ring score={s.current.score} />
          <Title size={36} color={colors.cream} style={{ marginTop: 20 }}>{s.headline}</Title>
          <T size={16} weight="regular" color={colors.cream}>{s.detail}</T>
        </View>
      );
    }
    if (p === 1) {
      return (
        <View style={{ gap: 12 }}>
          <Title size={36} color={colors.cream}>What went unused</Title>
          <T size={15} weight="regular" color={colors.cream}>
            {s.unused.length ? `${s.unused.length === 1 ? 'One thing' : `${s.unused.length} things`} didn't get used up this month.` : 'Nothing went to waste this month. Nice!'}
          </T>
          {s.unused.map((u) => (
            <View key={u.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: PANEL, borderWidth: 1, borderColor: PANEL_BORDER, borderRadius: 16, padding: 12 }}>
              <CategoryIcon category={u.category} size={42} />
              <View style={{ flex: 1 }}>
                <T size={16} weight="heavy" color={colors.cream}>{u.name}</T>
                <T size={13} weight="regular" color="rgba(243,234,219,0.75)">{`${plural(u.count, 'time')} it went unused`}</T>
              </View>
              <View style={{ backgroundColor: colors.cream, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 }}>
                <T size={13} weight="heavy" color={colors.green}>{`${u.count}x`}</T>
              </View>
            </View>
          ))}
          {s.unused.length ? <T size={14} weight="regular" color={colors.cream}>Suggestions has ideas for each of these.</T> : null}
        </View>
      );
    }
    if (p === 2) {
      const best = Math.max(s.streak, 14);
      return (
        <View style={{ gap: 10 }}>
          <Title size={36} color={colors.cream}>What went right</Title>
          <Title size={120} color={colors.cream} style={{ marginTop: 10 }}>{String(s.usedBeforeExpiry)}</Title>
          <T size={17} weight="bold" color={colors.cream}>{`${s.usedBeforeExpiry === 1 ? 'item' : 'items'} used up before ${s.usedBeforeExpiry === 1 ? 'it' : 'they'} expired.`}</T>
          <View style={{ backgroundColor: PANEL, borderWidth: 1, borderColor: PANEL_BORDER, borderRadius: 16, padding: 14, gap: 8, marginTop: 20 }}>
            <Title size={26} color={colors.cream}>{`${s.streak}-day streak`}</Title>
            <T size={13} weight="regular" color="rgba(243,234,219,0.8)">
              {s.streak ? `No food wasted.${s.streakIsBest ? ' Your longest yet.' : ''}` : 'Your streak starts the next day nothing gets tossed.'}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
              {Array.from({ length: Math.min(best, 21) }, (_, i) => (
                <View key={i} style={{ width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: colors.cream, backgroundColor: i < s.streak ? colors.cream : 'transparent' }} />
              ))}
            </View>
          </View>
        </View>
      );
    }
    const max = Math.max(1, ...s.circle.map((c) => c.items));
    return (
      <View style={{ gap: 12 }}>
        <Title size={36} color={colors.cream}>Your circle, together</Title>
        <T size={15} weight="regular" color={colors.cream}>{`${circle?.name ?? 'Your circle'} handled ${plural(s.circleTotal, 'item')}.`}</T>
        {s.circle.map((c) => {
          const m = members.find((x) => x.id === c.id);
          return (
            <View key={c.id} style={{ backgroundColor: PANEL, borderWidth: 1, borderColor: PANEL_BORDER, borderRadius: 16, padding: 12, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar id={c.id} name={nameOf(c.id)} url={m?.avatar_url} size={34} />
                <T size={15} weight="heavy" color={colors.cream} style={{ flex: 1 }}>{`${nameOf(c.id)}${c.id === userId ? ' (you)' : ''}`}</T>
                <T size={14} weight="bold" color={colors.cream}>{plural(c.items, 'item')}</T>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(243,234,219,0.2)', marginLeft: 44 }}>
                <View style={{ height: 6, borderRadius: 3, width: `${(c.items / max) * 100}%`, backgroundColor: colors.cream }} />
              </View>
            </View>
          );
        })}
      </View>
    );
  }
}
