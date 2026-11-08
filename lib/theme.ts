// Design tokens from the ShelfLife Figma (Mockup 2/3 variables).
export const colors = {
  background: '#FBF3E2',  // Surface/Background
  input: '#FFFBF2',       // Surface/Input
  field: '#F6E8C8',       // Surface/Field
  kraft: '#E2C99F',       // Surface/Kraft (cards)
  cream: '#F3EADB',       // Surface/Cream
  linePaper: '#CDB07E',   // Line/Paper
  line: '#B8915F',        // Line/Kraft
  brownLight: '#74624F',  // Brown/Light (secondary text)
  brown: '#8A6A4E',       // Brown/Medium (selected chips)
  walnut: '#5C3C25',      // Brown/Walnut
  ink: '#2B1D14',         // Brown/Ink (main text)
  sage: '#8FB08F',        // Green/Sage (primary buttons)
  forest: '#26462E',      // Green/Forest (text on sage)
  green: '#354A39',       // Dark Green (titles, review stories)
  amberTint: '#F3DDA3',
  amber: '#C98A2B',
  terraTint: '#F4D6C2',
  terra: '#A8431F',
  placeholder: '#9A8468',
  tabBar: '#6E5844',
  sageTint: '#DCE7D6',
};

export const fonts = {
  brand: 'CaveatBrush_400Regular', // titles and the wordmark
  regular: 'Nunito_400Regular',
  semibold: 'Nunito_600SemiBold',
  bold: 'Nunito_700Bold',
  heavy: 'Nunito_800ExtraBold',
};

// Replace with your team's real support address
export const SUPPORT_EMAIL = 'team@example.com';

export const DIETS = ['Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 'Nut-free', 'Pescatarian', 'Halal', 'Kosher'];

export function daysLeft(date: string | null) {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000);
}

export type Freshness = 'soon' | 'week' | 'plenty' | 'none';
export function freshness(days: number | null): Freshness {
  if (days === null) return 'none';
  if (days <= 2) return 'soon';
  if (days <= 7) return 'week';
  return 'plenty';
}
export const FRESHNESS_LABEL: Record<Freshness, string> = {
  soon: 'Use soon',
  week: 'This week',
  plenty: 'Plenty of time',
  none: 'No date',
};
export const FRESHNESS_COLOR: Record<Freshness, string> = {
  soon: colors.terra,
  week: colors.amber,
  plenty: colors.sage,
  none: colors.brownLight,
};

export function daysLabel(days: number | null) {
  if (days === null) return 'No date';
  if (days < 0) return 'Expired';
  if (days === 0) return 'Use today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

// Avatar colors from the Circle and Grocery screens
const AVATAR_COLORS = [colors.sage, colors.terraTint, colors.amberTint, colors.kraft];
export function avatarColor(id: string) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initial(name?: string | null) {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

export function timeAgo(date: string) {
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}
