// Meals tab: "Suggested for you" from your pantry + all recipes with filters.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { categorize } from '../lib/categories';
import { colors } from '../lib/theme';
import { cap, titleCase, loadPantryLite, PantryLite, Recipe, RECIPE_COLUMNS, score, Scored } from '../lib/recipes';
import PromptModal from '../components/PromptModal';
import {
  CategoryIcon, Chip, ChipRow, EmptyText, IconButton, ProgressBar, Screen, SearchBar, SectionLabel, T, Tag, Title,
} from '../components/ui';

type Source = 'all' | 'favorites' | 'mine' | 'circle' | 'app';

export function RecipeCard({ r, fav, onFav, onPress }: { r: Scored; fav: boolean; onFav: () => void; onPress: () => void }) {
  const total = r.ingredients.length || 1;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.kraft, borderWidth: 1.5, borderColor: colors.line, borderRadius: 18, padding: 10 }}>
      <View style={{ width: 84, height: 84, borderRadius: 14, overflow: 'hidden' }}>
        <CategoryIcon category={categorize(r.ingredients[0] ?? r.name)} size={84} />
      </View>
      <View style={{ flex: 1, gap: 6, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
          <T size={16} weight="heavy" style={{ flex: 1 }}>{r.name}</T>
          <Pressable onPress={onFav} hitSlop={10}>
            <Ionicons name={fav ? 'star' : 'star-outline'} size={22} color={fav ? colors.amber : colors.walnut} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 54 }}><ProgressBar value={r.have.length / total} color={colors.sage} height={6} /></View>
          <T size={13} weight="semibold" color={colors.brownLight}>
            {r.missing.length === 0 ? `All ${total} in your pantry` : `${r.have.length} of ${total} in your pantry`}
          </T>
        </View>
        {r.usesSoon ? <Tag label={`Uses ${r.usesSoon.toLowerCase()}`} tone="amber" /> : null}
      </View>
    </Pressable>
  );
}

export default function MealsScreen() {
  const { userId, profile, push } = useApp();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantry, setPantry] = useState<PantryLite[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<Source>('all');
  const [showMore, setShowMore] = useState(false);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    const [r, p, f] = await Promise.all([
      supabase.from('recipes').select(RECIPE_COLUMNS).order('name'),
      loadPantryLite(),
      supabase.from('recipe_favorites').select('recipe_id'),
    ]);
    setRefreshing(false);
    if (r.error) return Alert.alert('Load failed', r.error.message);
    setRecipes((r.data ?? []) as Recipe[]);
    setPantry(p);
    setFavorites(new Set((f.data ?? []).map((x) => x.recipe_id)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const scored = useMemo(() => recipes.map((r) => score(r, pantry)), [recipes, pantry]);
  const diets = (profile?.dietary ?? []).map((d) => d.toLowerCase()).filter((d) => !['halal', 'kosher'].includes(d));
  const avoid = (profile?.avoid ?? '').toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  const fits = (r: Recipe) =>
    diets.every((d) => r.diet_tags.includes(d)) && !avoid.some((a) => r.ingredients.some((i) => i.toLowerCase().includes(a)));

  const suggested = scored
    .filter(fits)
    .filter((r) => r.have.length > 0)
    .sort((a, b) => Number(!!b.usesSoon) - Number(!!a.usesSoon) || b.have.length / b.ingredients.length - a.have.length / a.ingredients.length)
    .slice(0, showMore ? 6 : 2);

  const q = search.trim().toLowerCase();
  const all = scored
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q)))
    .filter((r) => {
      if (source === 'favorites') return favorites.has(r.id);
      if (source === 'mine') return r.owner_id === userId;
      if (source === 'circle') return r.owner_id !== null && r.owner_id !== userId;
      if (source === 'app') return r.owner_id === null;
      return true;
    });

  async function toggleFavorite(id: string) {
    const isFav = favorites.has(id);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(id);
      else next.add(id);
      return next;
    });
    if (isFav) await supabase.from('recipe_favorites').delete().eq('recipe_id', id).eq('user_id', userId);
    else await supabase.from('recipe_favorites').insert({ recipe_id: id });
  }

  async function addRecipe({ name, ingredients, amounts, steps, servings }: Record<string, string>) {
    const list = ingredients.split(',').map((s) => cap(s.trim())).filter(Boolean);
    if (!name.trim() || list.length === 0) return Alert.alert('Add a name and at least one ingredient');
    const { error } = await supabase.from('recipes').insert({
      name: titleCase(name.trim()),
      ingredients: list.map(titleCase),
      amounts: amounts ? amounts.split(',').map((s) => s.trim()) : [],
      steps: steps ? steps.split(/\n|;/).map((s) => s.trim()).filter(Boolean) : [],
      servings: Number(servings) || 2,
    });
    if (error) return Alert.alert('Could not save', error.message);
    setAdding(false);
    load();
  }

  const dietLabel = profile?.dietary?.length ? profile.dietary[0] + (profile.dietary.length > 1 ? ` +${profile.dietary.length - 1}` : '') : null;
  const open = (r: Scored) => push('recipe', { id: r.id });

  return (
    <>
      <Screen onRefresh={load} refreshing={refreshing}>
        <View>
          <Title size={40}>Meals</Title>
          <T size={14} weight="semibold" color={colors.brownLight}>Cook from your pantry</T>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <SearchBar placeholder="Search recipes or ingredients" value={search} onChangeText={setSearch} />
          <IconButton icon="add" variant="brown" onPress={() => setAdding(true)} />
        </View>

        {!q ? (
          <>
            <SectionLabel right={dietLabel ? <Tag label={dietLabel} tone="kraft" /> : undefined}>Suggested for you</SectionLabel>
            {suggested.length ? (
              suggested.map((r) => <RecipeCard key={r.id} r={r} fav={favorites.has(r.id)} onFav={() => toggleFavorite(r.id)} onPress={() => open(r)} />)
            ) : (
              <EmptyText>Add food to your pantry to get suggestions.</EmptyText>
            )}
            {suggested.length >= 2 ? (
              <Pressable onPress={() => setShowMore((s) => !s)} style={{ flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 4 }}>
                <T size={14} weight="bold" color={colors.walnut} style={{ textDecorationLine: 'underline' }}>{showMore ? 'Show fewer' : 'Show more suggestions'}</T>
                <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={16} color={colors.walnut} />
              </Pressable>
            ) : null}
          </>
        ) : null}

        <SectionLabel>{`All recipes  ${all.length}`}</SectionLabel>
        <ChipRow>
          {(['all', 'favorites', 'mine', 'circle', 'app'] as Source[]).map((s) => (
            <Chip key={s} label={cap(s)} selected={source === s} onPress={() => setSource(s)} />
          ))}
        </ChipRow>
        {all.length ? (
          all.map((r) => <RecipeCard key={r.id} r={r} fav={favorites.has(r.id)} onFav={() => toggleFavorite(r.id)} onPress={() => open(r)} />)
        ) : (
          <EmptyText>No recipes here yet.</EmptyText>
        )}
      </Screen>

      <PromptModal
        visible={adding}
        title="New recipe"
        submitLabel="Save recipe"
        onClose={() => setAdding(false)}
        onSubmit={addRecipe}
        fields={[
          { key: 'name', label: 'Name', placeholder: "Mom's tomato soup" },
          { key: 'ingredients', label: 'Ingredients', placeholder: 'Tomatoes, Onion, Garlic', hint: 'Separate with commas' },
          { key: 'amounts', label: 'Amounts (optional)', placeholder: '800 g, 1, 2 cloves', hint: 'Same order as ingredients' },
          { key: 'steps', label: 'Steps (optional)', placeholder: 'Chop the onion; Simmer 20 min', hint: 'Separate steps with ;', inputProps: { multiline: true } },
          { key: 'servings', label: 'Servings', placeholder: '2', initial: '2', inputProps: { keyboardType: 'number-pad' } },
        ]}
      />
    </>
  );
}
