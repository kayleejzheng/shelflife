// Sustainability numbers for My profile, the Review stories and Suggestions.
import { supabase } from './supabase';
import { categorize } from './categories';

export type Finished = {
  name: string;
  status: 'used' | 'wasted';
  finished_at: string;
  expires_at: string | null;
  owner_id: string;
  category: string | null;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type MonthStat = { label: string; name: string; used: number; wasted: number; total: number; score: number | null };
export type Suggestion = { title: string; body: string; category: string; count: number; listItem: string };

export type EcoStats = {
  months: MonthStat[]; // last 5, oldest first; months[4] is this month
  current: MonthStat;
  previous: MonthStat;
  headline: string;      // "18% less waste than September."
  detail: string;        // "Your eco score went up 6 points..."
  unused: { name: string; count: number; category: string }[];
  usedBeforeExpiry: number;
  streak: number;
  streakIsBest: boolean;
  circle: { id: string; items: number }[];
  circleTotal: number;
  suggestions: Suggestion[];
};

// Everything finished (used or tossed) by you and your circle in the last 5 months.
// The "items circle read" policy lets you see your circle-mates' items too.
export async function loadFinished(): Promise<Finished[]> {
  const start = new Date();
  start.setMonth(start.getMonth() - 4, 1);
  start.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('items')
    .select('name, status, finished_at, expires_at, owner_id, category')
    .in('status', ['used', 'wasted'])
    .gte('finished_at', start.toISOString());
  return (data ?? []) as Finished[];
}

function sameMonth(date: string, ref: Date) {
  const d = new Date(date);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

export function computeStats(all: Finished[], userId: string, memberIds: string[]): EcoStats {
  const mine = all.filter((f) => f.owner_id === userId);
  const now = new Date();

  const months: MonthStat[] = Array.from({ length: 5 }, (_, k) => {
    const ref = new Date(now.getFullYear(), now.getMonth() - (4 - k), 1);
    const rows = mine.filter((f) => sameMonth(f.finished_at, ref));
    const used = rows.filter((r) => r.status === 'used').length;
    const wasted = rows.length - used;
    return {
      label: MONTHS[ref.getMonth()],
      name: MONTH_NAMES[ref.getMonth()],
      used,
      wasted,
      total: rows.length,
      score: rows.length ? Math.round((used / rows.length) * 100) : null,
    };
  });
  const current = months[4];
  const previous = months[3];

  // Headline: compare waste rates month over month
  let headline = 'Mark food used or tossed to see your score.';
  let detail = 'Your eco score is the share of food you finished instead of tossing.';
  if (current.total) {
    const rate = current.wasted / current.total;
    if (previous.total) {
      const prevRate = previous.wasted / previous.total;
      const diff = Math.round((prevRate - rate) * 100);
      headline = diff > 0 ? `${diff}% less waste than ${previous.name}.` : diff < 0 ? `${-diff}% more waste than ${previous.name}.` : `Same waste as ${previous.name}.`;
      const pts = (current.score ?? 0) - (previous.score ?? 0);
      const best = months.every((m) => m.score === null || (current.score ?? 0) >= m.score);
      detail = pts > 0
        ? `Your eco score went up ${pts} point${pts === 1 ? '' : 's'}.${best ? ' Best month since you started.' : ''}`
        : pts < 0
          ? `Your eco score dropped ${-pts} point${pts === -1 ? '' : 's'}. Suggestions can help.`
          : 'Your eco score held steady.';
    } else {
      headline = `You finished ${Math.round((1 - rate) * 100)}% of your food.`;
    }
  }

  // What went unused this month
  const tossed = new Map<string, { count: number; category: string }>();
  for (const f of mine) {
    if (f.status !== 'wasted' || !sameMonth(f.finished_at, now)) continue;
    const prev = tossed.get(f.name);
    tossed.set(f.name, { count: (prev?.count ?? 0) + 1, category: f.category ?? categorize(f.name) });
  }
  const unused = [...tossed.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // What went right
  const usedBeforeExpiry = mine.filter(
    (f) => f.status === 'used' && sameMonth(f.finished_at, now) && (!f.expires_at || new Date(f.finished_at) <= new Date(`${f.expires_at}T23:59:59`))
  ).length;

  // Streak: days since you last tossed something (only counts if you've logged anything)
  const lastWaste = mine.filter((f) => f.status === 'wasted').map((f) => new Date(f.finished_at).getTime()).sort((a, b) => b - a)[0];
  const firstLog = mine.map((f) => new Date(f.finished_at).getTime()).sort((a, b) => a - b)[0];
  const since = lastWaste ?? firstLog;
  const streak = since ? Math.max(0, Math.floor((Date.now() - since) / 86_400_000)) : 0;
  // longest previous gap between tosses
  const wasteTimes = mine.filter((f) => f.status === 'wasted').map((f) => new Date(f.finished_at).getTime()).sort((a, b) => a - b);
  let longest = 0;
  for (let i = 1; i < wasteTimes.length; i++) longest = Math.max(longest, Math.floor((wasteTimes[i] - wasteTimes[i - 1]) / 86_400_000));
  const streakIsBest = streak > 0 && streak >= longest;

  // Your circle, together (this month)
  const circle = memberIds
    .map((id) => ({ id, items: all.filter((f) => f.owner_id === id && sameMonth(f.finished_at, now)).length }))
    .sort((a, b) => b.items - a.items);
  const circleTotal = circle.reduce((s, c) => s + c.items, 0);

  return {
    months,
    current,
    previous,
    headline,
    detail,
    unused,
    usedBeforeExpiry,
    streak,
    streakIsBest,
    circle,
    circleTotal,
    suggestions: buildSuggestions(unused, current),
  };
}

function buildSuggestions(unused: EcoStats['unused'], current: MonthStat): Suggestion[] {
  const list: Suggestion[] = unused.map((u) => {
    const lower = u.name.toLowerCase();
    if (u.category === 'Bakery') {
      return {
        title: `Freeze ${lower} early`,
        body: `You tossed ${u.count === 1 ? 'it once' : `it ${u.count} times`}. Frozen slices keep for weeks and toast fine.`,
        category: u.category,
        count: u.count,
        listItem: u.name,
      };
    }
    if (u.category === 'Produce') {
      return {
        title: `Buy ${lower} in smaller amounts`,
        body: `${u.count === 1 ? 'Some went' : `${u.count} went`} unused this month. A smaller pack fits how fast you actually use it.`,
        category: u.category,
        count: u.count,
        listItem: `${u.name} (small)`,
      };
    }
    return {
      title: `Buy ${lower} in a smaller size`,
      body: `${u.count === 1 ? 'One' : u.count} expired this month. A smaller size is cheaper than tossing a big one.`,
      category: u.category,
      count: u.count,
      listItem: `${u.name} (small)`,
    };
  });
  const tips: Suggestion[] = [
    { title: 'Do a weekly check-in', body: 'A 1-minute check-in keeps your pantry accurate, so nothing hides at the back of the fridge.', category: 'Other', count: 0, listItem: '' },
    { title: 'Cook from "Use these first"', body: 'Open Meals for recipes that use whatever expires soonest.', category: 'Produce', count: 0, listItem: '' },
    { title: 'Share before it spoils', body: 'Offer food you will not finish to your circle with an ingredient request.', category: 'Pantry', count: 0, listItem: '' },
  ];
  if (current.total && current.wasted / current.total > 0.3) tips.unshift({ title: 'Shop with a list', body: 'You tossed a lot this month. Shopping from your grocery list cuts impulse buys.', category: 'Other', count: 0, listItem: '' });
  return [...list, ...tips].slice(0, 3);
}
