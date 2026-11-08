// Cooking mode: ingredient checklist + step checklist, then "Done cooking" updates your pantry.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { categorize } from '../lib/categories';
import { colors } from '../lib/theme';
import { cap, loadPantryLite, pantryMatch, PantryLite, Recipe, RECIPE_COLUMNS, scaleAmount, score, Scored } from '../lib/recipes';
import { Button, CategoryIcon, IconButton, Pattern, RoundCheck, T, Title } from '../components/ui';

export default function CookingScreen() {
  const { userId, params, pop, nameOf, logActivity } = useApp();
  const [recipe, setRecipe] = useState<Scored | null>(null);
  const [pantry, setPantry] = useState<PantryLite[]>([]);
  const [ready, setReady] = useState<number[]>([]);
  const [doneSteps, setDoneSteps] = useState<number[]>([]);
  const servings: number = params?.servings ?? 2;

  useEffect(() => {
    (async () => {
      const [{ data }, p] = await Promise.all([supabase.from('recipes').select(RECIPE_COLUMNS).eq('id', params?.id).single(), loadPantryLite()]);
      if (!data) return;
      const scored = score(data as Recipe, p);
      setPantry(p);
      setRecipe(scored);
    })();
  }, [params?.id]);

  if (!recipe) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.green} />
      </View>
    );
  }

  const factor = servings / (recipe.servings ?? 2);
  const toggle = (list: number[], set: (v: number[]) => void, i: number) => set(list.includes(i) ? list.filter((x) => x !== i) : [...list, i]);

  // Your pantry items this recipe used
  const used = recipe.ingredients.flatMap((ing) => pantryMatch(pantry, ing)).filter((p, i, arr) => p.owner_id === userId && arr.findIndex((x) => x.id === p.id) === i);

  async function updatePantry(mode: 'all' | 'some') {
    const now = new Date().toISOString();
    for (const p of used) {
      if (mode === 'all') await supabase.from('items').update({ status: 'used', finished_at: now }).eq('id', p.id);
      else await supabase.from('items').update({ amount_left: Math.max(0.1, (p.amount_left ?? 1) - 0.5), checked_at: now }).eq('id', p.id);
    }
  }

  function doneCooking() {
    logActivity(`${nameOf(userId)} cooked ${recipe!.name}`);
    if (!used.length) {
      Alert.alert('Nice cooking!', 'Enjoy your meal.');
      return pop();
    }
    Alert.alert('Update your pantry?', `This used ${used.map((u) => u.name).join(', ')}.`, [
      { text: 'Used it all', onPress: async () => { await updatePantry('all'); pop(); } },
      { text: 'Some is left', onPress: async () => { await updatePantry('some'); pop(); } },
      { text: 'Skip', style: 'cancel', onPress: pop },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Pattern />
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Photo area: tinted food tile in place of a recipe photo */}
        <View style={{ height: 230, backgroundColor: colors.sageTint, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderColor: colors.line }}>
          <CategoryIcon category={categorize(recipe.ingredients[0] ?? recipe.name)} size={130} />
          <View style={{ position: 'absolute', top: 54, left: 20 }}>
            <IconButton icon="chevron-back" onPress={pop} size={40} />
          </View>
        </View>
        <View style={{ padding: 22, gap: 10 }}>
          <Title size={34}>{recipe.name}</Title>
          <T size={14} weight="semibold" color={colors.brownLight}>
            {`Serves ${servings}${recipe.usesSoon ? ` · Uses ${recipe.usesSoon.toLowerCase()}` : ''}`}
          </T>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
            <T size={15} weight="heavy">{`Ingredients · ${recipe.ingredients.length}`}</T>
            <T size={13} weight="bold" color={colors.forest}>{`${ready.length} of ${recipe.ingredients.length} ready`}</T>
          </View>
          {recipe.ingredients.map((ing, i) => {
            const on = ready.includes(i);
            return (
              <Pressable key={ing + i} onPress={() => toggle(ready, setReady, i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderColor: colors.linePaper }}>
                <RoundCheck checked={on} onPress={() => toggle(ready, setReady, i)} />
                <T size={16} weight="bold" color={on ? colors.brownLight : colors.ink} strike={on} style={{ flex: 1 }}>{cap(ing)}</T>
                <T size={13} weight="regular" color={colors.brownLight}>{scaleAmount(recipe.amounts?.[i], factor)}</T>
              </Pressable>
            );
          })}

          {recipe.steps?.length ? (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                <T size={15} weight="heavy">{`Instructions · ${recipe.steps.length}`}</T>
                <T size={13} weight="bold" color={colors.forest}>{`${doneSteps.length} of ${recipe.steps.length} done`}</T>
              </View>
              {recipe.steps.map((s, i) => {
                const on = doneSteps.includes(i);
                return (
                  <Pressable key={i} onPress={() => toggle(doneSteps, setDoneSteps, i)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderColor: colors.linePaper }}>
                    <RoundCheck checked={on} label={String(i + 1)} onPress={() => toggle(doneSteps, setDoneSteps, i)} />
                    <T size={15} weight="regular" color={on ? colors.brownLight : colors.ink} strike={on} style={{ flex: 1 }}>{s}</T>
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 30, backgroundColor: colors.tabBar }}>
        <Button label="Done cooking" onPress={doneCooking} />
      </View>
    </View>
  );
}
