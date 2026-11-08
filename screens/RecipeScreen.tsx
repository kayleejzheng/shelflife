// Recipe detail: servings stepper, scaled amounts, what's missing, add missing to list, Cook this.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { categorize } from '../lib/categories';
import { colors, plural } from '../lib/theme';
import { cap, loadPantryLite, PantryLite, Recipe, RECIPE_COLUMNS, scaleAmount, score, Scored } from '../lib/recipes';
import { Button, Card, CategoryIcon, Header, Screen, Stepper, T, Tag, TextLink } from '../components/ui';

export default function RecipeScreen() {
  const { userId, circle, params, pop, push } = useApp();
  const [recipe, setRecipe] = useState<Scored | null>(null);
  const [pantry, setPantry] = useState<PantryLite[]>([]);
  const [servings, setServings] = useState(2);
  const [added, setAdded] = useState(false);

  const load = useCallback(async () => {
    const [{ data, error }, p] = await Promise.all([
      supabase.from('recipes').select(RECIPE_COLUMNS).eq('id', params?.id).single(),
      loadPantryLite(),
    ]);
    if (error) return Alert.alert('Load failed', error.message);
    setPantry(p);
    setRecipe(score(data as Recipe, p));
    setServings((data as Recipe).servings ?? 2);
  }, [params?.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!recipe) {
    return (
      <Screen>
        <Header title="Recipe" onBack={pop} />
        <ActivityIndicator color={colors.green} style={{ marginTop: 40 }} />
      </Screen>
    );
  }

  const base = recipe.servings ?? 2;
  const factor = servings / base;
  const fromLabel = recipe.owner_id === null ? 'From the app' : recipe.owner_id === userId ? 'Your recipe' : 'From your circle';

  async function addMissing() {
    if (!recipe) return;
    const { error } = await supabase.from('grocery_items').insert(
      recipe.missing.map((m) => {
        const i = recipe.ingredients.indexOf(m);
        return { name: cap(m), quantity: scaleAmount(recipe.amounts?.[i], factor) || '1', category: categorize(m), circle_id: circle?.id ?? null };
      })
    );
    if (error) return Alert.alert('Could not add', error.message);
    setAdded(true);
  }

  async function deleteRecipe() {
    Alert.alert('Delete recipe?', recipe?.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('recipes').delete().eq('id', recipe!.id);
          pop();
        },
      },
    ]);
  }

  return (
    <Screen
      footer={
        <>
          {recipe.missing.length ? (
            <Button
              variant="secondary"
              label={added ? 'Added to grocery list' : `Add ${recipe.missing.length} missing to grocery list`}
              icon={added ? 'checkmark' : undefined}
              onPress={addMissing}
              disabled={added}
            />
          ) : null}
          <Button label="Cook this" onPress={() => push('cooking', { id: recipe.id, servings })} />
        </>
      }
    >
      <Header title={recipe.name} onBack={pop} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <T size={14} weight="semibold" color={colors.brownLight}>{fromLabel}</T>
        {recipe.usesSoon ? <Tag label={`Uses ${recipe.usesSoon.toLowerCase()}`} tone="amber" /> : null}
        {recipe.diet_tags.slice(0, 2).map((d) => <Tag key={d} label={cap(d)} tone="sage" />)}
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={18} weight="heavy">Servings</T>
        <Stepper value={servings} onChange={setServings} />
      </Card>
      <T size={13} weight="regular" color={colors.brownLight}>Amounts scale as you change servings</T>

      <Card tone="input" style={{ gap: 0 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 8 }}>
          <T size={15} weight="heavy">{`Ingredients · ${recipe.ingredients.length}`}</T>
          <T size={13} weight="bold" color={colors.forest}>{`${recipe.have.length} of ${recipe.ingredients.length} in your pantry`}</T>
        </View>
        {recipe.ingredients.map((ing, i) => {
          const have = recipe.have.includes(ing);
          return (
            <View key={ing + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderColor: colors.linePaper }}>
              <CategoryIcon category={categorize(ing)} size={28} />
              <T size={15} weight="bold" style={{ flex: 1 }}>{cap(ing)}</T>
              <T size={13} weight="regular" color={colors.brownLight}>{scaleAmount(recipe.amounts?.[i], factor)}</T>
              {have ? (
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="checkmark" size={14} color={colors.forest} />
                </View>
              ) : (
                <Tag label="Missing" tone="terra" />
              )}
            </View>
          );
        })}
      </Card>

      {recipe.steps?.length ? (
        <Card tone="input" style={{ gap: 6 }}>
          <T size={15} weight="heavy">{`Instructions · ${plural(recipe.steps.length, 'step')}`}</T>
          {recipe.steps.map((s, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10 }}>
              <T size={14} weight="heavy" color={colors.brown}>{`${i + 1}.`}</T>
              <T size={14} weight="regular" style={{ flex: 1 }}>{s}</T>
            </View>
          ))}
        </Card>
      ) : null}
      {pantry.length === 0 ? <T size={13} weight="regular" color={colors.brownLight}>Your pantry is empty, so everything shows as missing.</T> : null}
      {recipe.owner_id === userId ? (
        <View style={{ alignItems: 'center' }}><TextLink label="Delete recipe" color={colors.terra} onPress={deleteRecipe} /></View>
      ) : null}
    </Screen>
  );
}
