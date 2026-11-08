// Edit an item: name, quantity + unit, expiry date, food type.
// Used for scanned items (before saving) and for items already in the pantry.
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categorize, FOOD_TYPES } from '../lib/categories';
import { estimateExpiry } from '../lib/shelfLife';
import { colors, daysLabel, daysLeft, freshness, FRESHNESS_LABEL } from '../lib/theme';
import { Button, CategoryIcon, Chip, ChipRow, Field, Sheet, Stepper, T, Tag, TextLink, Title } from './ui';

export type ItemDraft = { name: string; quantity: number; unit: string | null; expires_at: string | null; category: string };

const UNITS = ['pack', 'each', 'lb', 'bag', 'bottle', 'carton', 'jar'];
const QUICK = [
  { days: 3, label: '3 days' },
  { days: 7, label: '1 week' },
  { days: 14, label: '2 weeks' },
  { days: 30, label: '1 month' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromISO(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shift(s: string | null, days: number) {
  const d = s ? fromISO(s) : new Date();
  d.setDate(d.getDate() + days);
  return toISO(d);
}
function inDays(days: number) {
  return shift(toISO(new Date()), days);
}
function pretty(s: string) {
  const d = fromISO(s);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

export default function ItemEditSheet({
  visible, draft, onChange, onDone, onClose, rawName, isNew, removeLabel, onRemove, doneLabel = 'Done',
}: {
  visible: boolean;
  draft: ItemDraft | null;
  onChange: (d: ItemDraft) => void;
  onDone: () => void;
  onClose: () => void;
  rawName?: string | null;
  isNew?: boolean;
  removeLabel?: string;
  onRemove?: () => void;
  doneLabel?: string;
}) {
  const days = draft ? daysLeft(draft.expires_at ? `${draft.expires_at}T23:59:59` : null) : null;
  const f = freshness(days);
  const set = (patch: Partial<ItemDraft>) => draft && onChange({ ...draft, ...patch });

  return (
    <Sheet visible={visible} onClose={onClose}>
      {draft ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <CategoryIcon category={draft.category} size={50} />
            <View style={{ flex: 1, gap: 4 }}>
              <Title size={28} color={colors.ink}>{draft.name || 'New item'}</Title>
              <Tag label={FRESHNESS_LABEL[f]} tone={f === 'soon' ? 'terra' : f === 'week' ? 'amber' : f === 'none' ? 'kraft' : 'sage'} dot />
            </View>
          </View>

          <Field
            label="Name"
            placeholder="e.g. Strawberries"
            value={draft.name}
            autoFocus={isNew}
            onChangeText={(name) => set(isNew ? { name, category: categorize(name), expires_at: name.trim() ? estimateExpiry(name) : draft.expires_at } : { name })}
            hint={rawName ? `Scanned as: ${rawName}` : undefined}
          />

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <T size={16} weight="heavy">Quantity</T>
            <Stepper value={draft.quantity} onChange={(quantity) => set({ quantity })} />
          </View>
          <ChipRow>
            {UNITS.map((u) => (
              <Chip key={u} label={u} selected={(draft.unit ?? 'pack') === u} onPress={() => set({ unit: u === 'pack' ? null : u })} />
            ))}
          </ChipRow>

          <View style={{ gap: 8, paddingVertical: 8, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.linePaper }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <T size={16} weight="heavy">Expires</T>
                <T size={13} weight="semibold" color={colors.brownLight}>{daysLabel(days)}</T>
              </View>
              {draft.expires_at ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <DayButton icon="remove" onPress={() => set({ expires_at: shift(draft.expires_at, -1) })} />
                  <T size={17} weight="heavy" color={colors.green} style={{ minWidth: 62, textAlign: 'center' }}>{pretty(draft.expires_at)}</T>
                  <DayButton icon="add" onPress={() => set({ expires_at: shift(draft.expires_at, 1) })} />
                </View>
              ) : (
                <TextLink label="Add a date" onPress={() => set({ expires_at: inDays(7) })} />
              )}
            </View>
            <ChipRow>
              {QUICK.map((q) => (
                <Chip key={q.days} label={q.label} selected={draft.expires_at === inDays(q.days)} onPress={() => set({ expires_at: inDays(q.days) })} />
              ))}
              <Chip label="No date" selected={!draft.expires_at} onPress={() => set({ expires_at: null })} />
            </ChipRow>
          </View>

          <T size={16} weight="heavy">Food type</T>
          <ChipRow>
            {FOOD_TYPES.map((t) => <Chip key={t} label={t} selected={draft.category === t} onPress={() => set({ category: t })} />)}
          </ChipRow>

          <Button label={doneLabel} onPress={onDone} />
          {onRemove ? (
            <View style={{ alignItems: 'center' }}>
              <TextLink label={removeLabel ?? 'Remove item'} color={colors.terra} onPress={onRemove} />
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

function DayButton({ icon, onPress }: { icon: 'add' | 'remove'; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.walnut, backgroundColor: icon === 'add' ? colors.sage : colors.input, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={18} color={icon === 'add' ? colors.forest : colors.walnut} />
    </Pressable>
  );
}
