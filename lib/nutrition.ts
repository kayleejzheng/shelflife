// Nutrition facts per 100 g from Open Food Facts (free, no API key).
export type Nutrition = { product: string; kcal?: number; protein?: number; carbs?: number; sugar?: number; fat?: number; fiber?: number };

export async function lookupNutrition(name: string): Promise<Nutrition | null> {
  const url =
    'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&json=1&page_size=5&fields=product_name,nutriments&search_terms=' +
    encodeURIComponent(name);
  const res = await fetch(url, { headers: { 'User-Agent': 'ShelfLife student app' } });
  if (!res.ok) return null;
  const data = await res.json();
  const hit = (data.products ?? []).find((p: { nutriments?: Record<string, number> }) => p.nutriments?.['energy-kcal_100g'] !== undefined);
  if (!hit) return null;
  const n = hit.nutriments;
  const round = (v: unknown) => (typeof v === 'number' ? Math.round(v * 10) / 10 : undefined);
  return {
    product: hit.product_name || name,
    kcal: round(n['energy-kcal_100g']),
    protein: round(n.proteins_100g),
    carbs: round(n.carbohydrates_100g),
    sugar: round(n.sugars_100g),
    fat: round(n.fat_100g),
    fiber: round(n.fiber_100g),
  };
}
