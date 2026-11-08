// Food types used for icons, grouping (Review / Grocery list) and pantry filters.
import { colors } from './theme';

const CATEGORIES: { name: string; words: string[] }[] = [
  { name: 'Produce', words: ['berr', 'banana', 'apple', 'grape', 'orange', 'lemon', 'lime', 'mango', 'avocado', 'peach', 'pear', 'melon', 'pineapple', 'lettuce', 'spinach', 'kale', 'tomato', 'onion', 'garlic', 'potato', 'carrot', 'broccoli', 'pepper', 'cucumber', 'zucchini', 'mushroom', 'corn', 'cilantro', 'basil', 'herb', 'salad', 'fruit', 'vegetable', 'asparagus', 'pea'] },
  { name: 'Dairy', words: ['milk', 'egg', 'yogurt', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'butter', 'cream', 'creamer'] },
  { name: 'Meat & fish', words: ['chicken', 'beef', 'pork', 'turkey', 'bacon', 'sausage', 'ham', 'fish', 'salmon', 'tuna', 'shrimp', 'steak'] },
  { name: 'Bakery', words: ['bread', 'sourdough', 'bagel', 'muffin', 'croissant', 'tortilla', 'bun', 'roll', 'cake', 'donut'] },
  { name: 'Grains', words: ['rice', 'pasta', 'spaghetti', 'noodle', 'cereal', 'oat', 'flour', 'quinoa', 'granola'] },
  { name: 'Frozen', words: ['frozen', 'pizza', 'ice cream'] },
  { name: 'Snacks', words: ['popcorn', 'chip', 'cracker', 'cookie', 'candy', 'chocolate', 'pretzel', 'bar'] },
  { name: 'Drinks', words: ['juice', 'soda', 'water', 'coffee', 'tea', 'kombucha'] },
  { name: 'Pantry', words: ['bean', 'sugar', 'oil', 'sauce', 'salsa', 'soup', 'peanut butter', 'jam', 'honey', 'spice', 'salt', 'broth', 'can', 'vinegar', 'walnut', 'almond', 'nut'] },
];

export const CATEGORY_ORDER = [...CATEGORIES.map((c) => c.name), 'Other'];
// Chips shown in the edit-item sheet and the pantry filter
export const FOOD_TYPES = ['Produce', 'Dairy', 'Meat & fish', 'Bakery', 'Grains', 'Frozen', 'Snacks', 'Drinks', 'Pantry'];

export function categorize(name: string): string {
  const lower = name.toLowerCase();
  let best: { cat: string; len: number } | null = null;
  for (const c of CATEGORIES) {
    for (const w of c.words) {
      if (lower.includes(w) && (!best || w.length > best.len)) best = { cat: c.name, len: w.length };
    }
  }
  return best?.cat ?? 'Other';
}

export function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), row]);
  }
  return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, rows: map.get(c)! }));
}

// Icon + tile color for each food type (MaterialCommunityIcons names)
export const CATEGORY_ICON: Record<string, { icon: string; bg: string; fg: string }> = {
  Produce: { icon: 'food-apple-outline', bg: colors.terraTint, fg: colors.terra },
  Dairy: { icon: 'cup-outline', bg: colors.amberTint, fg: colors.amber },
  'Meat & fish': { icon: 'fish', bg: colors.terraTint, fg: colors.terra },
  Bakery: { icon: 'baguette', bg: colors.kraft, fg: colors.walnut },
  Grains: { icon: 'grain', bg: colors.amberTint, fg: colors.amber },
  Frozen: { icon: 'snowflake', bg: colors.sageTint, fg: colors.forest },
  Snacks: { icon: 'cookie-outline', bg: colors.amberTint, fg: colors.amber },
  Drinks: { icon: 'bottle-soda-outline', bg: colors.sageTint, fg: colors.forest },
  Pantry: { icon: 'archive-outline', bg: colors.sage, fg: colors.forest },
  Other: { icon: 'basket-outline', bg: colors.kraft, fg: colors.walnut },
};

// Pantry "Dietary" filter: hide foods that don't fit
export function fitsDiet(name: string, category: string, diet: string) {
  const lower = name.toLowerCase();
  if (diet === 'Vegetarian') return category !== 'Meat & fish';
  if (diet === 'Vegan') return category !== 'Meat & fish' && category !== 'Dairy' && !lower.includes('honey');
  if (diet === 'Gluten-free') return !(category === 'Bakery' || /pasta|spaghetti|noodle|cereal|flour|bread|cracker|cookie/.test(lower));
  if (diet === 'Dairy-free') return category !== 'Dairy' || lower.includes('egg');
  return true;
}

// "Strawberries" -> "strawberry", "Tomatoes" -> "tomato"
export function singular(word: string) {
  const w = word.toLowerCase().trim();
  if (w.endsWith('ies')) return `${w.slice(0, -3)}y`;
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

// Does a pantry item name match a recipe ingredient?
export function matchesIngredient(pantryName: string, ingredient: string) {
  const p = pantryName.toLowerCase().split(/\s+/).map(singular);
  const ing = ingredient.toLowerCase().split(/\s+/).map(singular);
  const pJoined = p.join(' ');
  const ingJoined = ing.join(' ');
  if (pJoined.includes(ingJoined)) return true;
  // the ingredient's main word (last word: "Baby spinach" -> spinach) appears in the pantry name
  const main = ing[ing.length - 1];
  return main.length >= 3 && p.includes(main);
}
