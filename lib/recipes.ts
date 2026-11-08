// Recipes + "how much of this can I make from my pantry".
import { supabase } from './supabase';
import { matchesIngredient } from './categories';
import { daysLeft } from './theme';
import { fraction } from './items';

export type Recipe = {
  id: string;
  name: string;
  ingredients: string[];
  amounts: string[] | null;
  steps: string[] | null;
  servings: number | null;
  diet_tags: string[];
  owner_id: string | null;
};
export type PantryLite = { id: string; name: string; expires_at: string | null; owner_id: string; amount_left: number | null };
export type Scored = Recipe & { have: string[]; missing: string[]; usesSoon: string | null };

export const RECIPE_COLUMNS = 'id, name, ingredients, amounts, steps, servings, diet_tags, owner_id';

export async function loadPantryLite() {
  const { data } = await supabase.from('items').select('id, name, expires_at, owner_id, amount_left').eq('status', 'in_stock');
  return (data ?? []) as PantryLite[];
}

export function pantryMatch(pantry: PantryLite[], ingredient: string) {
  return pantry.filter((p) => matchesIngredient(p.name, ingredient));
}

// "black bean tacos" -> "Black Bean Tacos"
export function titleCase(s: string) {
  return s.replace(/(^|[\s\-/(])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

export function score(raw: Recipe, pantry: PantryLite[]): Scored {
  const r = { ...raw, name: titleCase(raw.name), ingredients: raw.ingredients.map(titleCase) };
  const have: string[] = [];
  const missing: string[] = [];
  let usesSoon: string | null = null;
  for (const ing of r.ingredients) {
    const hits = pantryMatch(pantry, ing);
    if (hits.length) {
      have.push(ing);
      const soon = hits.find((h) => {
        const d = daysLeft(h.expires_at);
        return d !== null && d <= 3;
      });
      if (soon && !usesSoon) usesSoon = soon.name;
    } else missing.push(ing);
  }
  return { ...r, have, missing, usesSoon };
}

// "250 g" x 2 -> "500 g", "1/2" x 3 -> "1 1/2"
export function scaleAmount(amount: string | undefined, factor: number) {
  if (!amount) return '';
  if (factor === 1) return amount;
  const m = amount.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)(.*)$/);
  if (!m) return amount;
  const num = m[1].trim().split(/\s+/).reduce((sum, part) => {
    if (part.includes('/')) {
      const [a, b] = part.split('/').map(Number);
      return sum + a / b;
    }
    return sum + Number(part);
  }, 0);
  const scaled = num * factor;
  const text = scaled >= 10 ? String(Math.round(scaled)) : fraction(scaled);
  return `${text}${m[2]}`;
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
