// Pantry item type + helpers shared by Pantry, Check-in, Grocery and Meals.
import { supabase } from './supabase';
import { categorize } from './categories';
import { daysLeft } from './theme';

export type Item = {
  id: string;
  name: string;
  expires_at: string | null;
  owner_id: string;
  quantity: number | null;
  unit: string | null;
  created_at: string;
  category: string | null;
  amount_left: number | null;
  checked_at: string | null;
};

export const ITEM_COLUMNS = 'id, name, expires_at, owner_id, quantity, unit, created_at, category, amount_left, checked_at';

// Everything in stock that you can see (yours + your circle's)
export async function loadPantry() {
  return supabase.from('items').select(ITEM_COLUMNS).eq('status', 'in_stock');
}

export const itemCategory = (i: { name: string; category: string | null }) => i.category || categorize(i.name);

// 1.5 -> "1 1/2", 0.25 -> "1/4"
export function fraction(n: number) {
  const whole = Math.floor(n + 0.001);
  const rest = n - whole;
  const frac = rest < 0.125 ? '' : rest < 0.375 ? '1/4' : rest < 0.625 ? '1/2' : rest < 0.875 ? '3/4' : '';
  const w = rest >= 0.875 ? whole + 1 : whole;
  if (!frac) return String(w);
  return w ? `${w} ${frac}` : frac;
}

const NO_PLURAL = ['lb', 'oz', 'g', 'kg', 'ml', 'l', 'each'];
export function unitWord(unit: string | null, n: number) {
  const u = unit?.trim() || 'pack';
  if (n <= 1 || NO_PLURAL.includes(u) || u.endsWith('s')) return u;
  if (u.endsWith('x') || u.endsWith('ch') || u.endsWith('sh')) return `${u}es`;
  return `${u}s`;
}

// "1 pack", "2 tubs", "3 lb"
export function qtyLabel(quantity: number | null, unit: string | null) {
  const n = quantity ?? 1;
  return `${fraction(n)} ${unitWord(unit, n)}`;
}

// How much is left right now, e.g. "1 1/2 packs"
export function leftLabel(i: Item) {
  const n = (i.quantity ?? 1) * (i.amount_left ?? 1);
  return `${fraction(n)} ${unitWord(i.unit, n)}`;
}

// Not confirmed in a week -> shows up in the check-in
export function isStale(i: Item) {
  const t = new Date(i.checked_at ?? i.created_at).getTime();
  return Date.now() - t > 7 * 86_400_000;
}

// 1 = just bought, 0 = expired (used for the freshness bar)
export function freshnessFraction(i: Item) {
  if (!i.expires_at) return 1;
  const start = new Date(i.created_at).getTime();
  const end = new Date(`${i.expires_at}T23:59:59`).getTime();
  if (end <= start) return 0;
  return Math.max(0, Math.min(1, (end - Date.now()) / (end - start)));
}

export const daysOf = (i: Item) => daysLeft(i.expires_at);

// "Added 6 days ago"
export function addedAgo(i: Item) {
  const d = Math.floor((Date.now() - new Date(i.created_at).getTime()) / 86_400_000);
  if (d <= 0) return 'Added today';
  if (d === 1) return 'Added yesterday';
  return `Added ${d} days ago`;
}

// Gone from the pantry: count it as used unless it had already expired
export async function finishItem(i: Item, status?: 'used' | 'wasted') {
  const d = daysOf(i);
  const s = status ?? (d !== null && d < 0 ? 'wasted' : 'used');
  return supabase.from('items').update({ status: s, finished_at: new Date().toISOString() }).eq('id', i.id);
}
