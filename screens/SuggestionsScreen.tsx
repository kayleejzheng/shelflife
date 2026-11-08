// Suggestions: ideas to waste less, based on what went unused this month.
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useApp } from '../lib/app';
import { useEcoStats } from '../lib/useEcoStats';
import { categorize } from '../lib/categories';
import { colors } from '../lib/theme';
import { Button, Card, CategoryIcon, EmptyText, Header, Screen, T } from '../components/ui';

export default function SuggestionsScreen() {
  const { pop, push, circle, goTab } = useApp();
  const { stats } = useEcoStats();
  const [added, setAdded] = useState<string[]>([]);

  async function addToList(name: string) {
    const { error } = await supabase.from('grocery_items').insert({ name, quantity: '1', category: categorize(name), circle_id: circle?.id ?? null });
    if (error) return Alert.alert('Could not add', error.message);
    setAdded((a) => [...a, name]);
  }

  return (
    <Screen>
      <Header
        title="Suggestions"
        onBack={pop}
        subtitle={`Ideas to waste less, based on what went unused in ${stats?.current.name ?? 'this month'}.`}
      />
      {!stats ? <ActivityIndicator color={colors.green} style={{ marginTop: 30 }} /> : null}
      {stats && !stats.suggestions.length ? <EmptyText>No suggestions yet. Keep logging what you use and toss.</EmptyText> : null}
      {stats?.suggestions.map((s) => (
        <Card key={s.title} style={{ flexDirection: 'row', gap: 12, padding: 14 }}>
          <CategoryIcon category={s.category} size={42} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <T size={17} weight="heavy" style={{ flex: 1 }}>{s.title}</T>
              {s.count ? (
                <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
                  <T size={12} weight="heavy" color={colors.forest}>{String(s.count)}</T>
                </View>
              ) : null}
            </View>
            <T size={14} weight="regular" color={colors.brownLight}>{s.body}</T>
            {s.listItem ? (
              <Button
                small
                label={added.includes(s.listItem) ? 'Added' : 'Add to list'}
                icon={added.includes(s.listItem) ? 'checkmark' : undefined}
                disabled={added.includes(s.listItem)}
                onPress={() => addToList(s.listItem)}
                style={{ alignSelf: 'center', marginTop: 4 }}
              />
            ) : s.title.startsWith('Do a weekly') ? (
              <Button small variant="secondary" label="Start a check-in" onPress={() => push('checkin')} style={{ alignSelf: 'center', marginTop: 4 }} />
            ) : s.title.startsWith('Cook') ? (
              <Button small variant="secondary" label="Open Meals" onPress={() => goTab('meals')} style={{ alignSelf: 'center', marginTop: 4 }} />
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
