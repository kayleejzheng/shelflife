// Shared building blocks styled to match the ShelfLife Figma (Mockup 2/3).
import { ReactNode, useRef, useState } from 'react';
import {
  Animated, Image, KeyboardAvoidingView, PanResponder, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleProp, Switch, Text,
  TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { avatarColor, colors, fonts, initial } from '../lib/theme';
import { CATEGORY_ICON } from '../lib/categories';

export type IconName = keyof typeof Ionicons.glyphMap;
type Weight = 'regular' | 'semibold' | 'bold' | 'heavy';

// ---------- Text ----------

export function T({
  children, size = 16, weight = 'semibold', color = colors.ink, style, numberOfLines, center, strike,
}: {
  children: ReactNode; size?: number; weight?: Weight; color?: string; style?: StyleProp<TextStyle>;
  numberOfLines?: number; center?: boolean; strike?: boolean;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: fonts[weight], fontSize: size, color, textAlign: center ? 'center' : undefined, textDecorationLine: strike ? 'line-through' : 'none' },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, size = 36, color = colors.green, style, center }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; center?: boolean }) {
  return <Text style={[{ fontFamily: fonts.brand, fontSize: size, color, textAlign: center ? 'center' : undefined }, style]}>{children}</Text>;
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
      <T size={17} weight="heavy">{children}</T>
      {right}
    </View>
  );
}

export function EmptyText({ children }: { children: ReactNode }) {
  return <T color={colors.brownLight} center style={{ marginVertical: 16 }}>{children}</T>;
}

// ---------- Layout ----------

export function Screen({
  children, onRefresh, refreshing = false, footer, contentStyle, scroll = true,
}: {
  children: ReactNode; onRefresh?: () => void; refreshing?: boolean; footer?: ReactNode; contentStyle?: ViewStyle; scroll?: boolean;
}) {
  const content = { paddingHorizontal: 22, paddingTop: 58, paddingBottom: 28, gap: 12 };
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pattern />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[content, contentStyle]}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, gap: 10, backgroundColor: colors.background }}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

// Doodled food pattern behind every screen (exported from the Figma "Food pattern" frame)
export function Pattern({ opacity = 1, tint }: { opacity?: number; tint?: string }) {
  return (
    <Image
      source={require('../assets/pattern.png')}
      resizeMode="cover"
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity, tintColor: tint }}
    />
  );
}

// Back button + Caveat Brush title (+ optional right side)
export function Header({ title, onBack, right, subtitle }: { title: string; onBack?: () => void; right?: ReactNode; subtitle?: ReactNode }) {
  return (
    <View style={{ gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {onBack ? <IconButton icon="chevron-back" onPress={onBack} size={40} /> : null}
        <Title style={{ flex: 1 }} size={onBack ? 32 : 38}>{title}</Title>
        {right}
      </View>
      {subtitle ? <View>{typeof subtitle === 'string' ? <T size={14} color={colors.brownLight}>{subtitle}</T> : subtitle}</View> : null}
    </View>
  );
}

type Tone = 'kraft' | 'input' | 'field' | 'amber' | 'terra' | 'sage' | 'green';
const TONES: Record<Tone, { bg: string; border: string }> = {
  kraft: { bg: colors.kraft, border: colors.line },
  input: { bg: colors.input, border: colors.line },
  field: { bg: colors.field, border: colors.linePaper },
  amber: { bg: colors.amberTint, border: colors.amber },
  terra: { bg: colors.terraTint, border: colors.terra },
  sage: { bg: colors.sageTint, border: colors.sage },
  green: { bg: colors.green, border: colors.green },
};

export function Card({ children, style, tone = 'kraft' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: Tone }) {
  return (
    <View style={[{ borderWidth: 1.5, borderRadius: 18, padding: 14, gap: 8, backgroundColor: TONES[tone].bg, borderColor: TONES[tone].border }, style]}>
      {children}
    </View>
  );
}

export function Divider({ color = colors.linePaper }: { color?: string }) {
  return <View style={{ height: 1, backgroundColor: color }} />;
}

export function Grid({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 }, style]}>{children}</View>;
}

// ---------- Buttons ----------

type ButtonVariant = 'primary' | 'secondary' | 'brown' | 'danger' | 'cream';
const BUTTONS: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
  primary: { bg: colors.sage, border: colors.sage, text: colors.forest },
  secondary: { bg: colors.input, border: colors.brown, text: colors.brownLight },
  brown: { bg: colors.brown, border: colors.brown, text: colors.cream },
  danger: { bg: colors.input, border: colors.terra, text: colors.terra },
  cream: { bg: colors.cream, border: colors.cream, text: colors.green },
};

export function Button({
  label, onPress, variant = 'primary', icon, disabled, small, style,
}: {
  label: string; onPress: () => void; variant?: ButtonVariant; icon?: IconName; disabled?: boolean; small?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const b = BUTTONS[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height: small ? 38 : 52, paddingHorizontal: small ? 16 : 20, borderRadius: 26, borderWidth: 1.5,
          backgroundColor: b.bg, borderColor: b.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={b.text} /> : null}
      <T size={small ? 14 : 17} weight="heavy" color={b.text}>{label}</T>
    </Pressable>
  );
}

type IconVariant = 'kraft' | 'sage' | 'brown' | 'cream';
export function IconButton({
  icon, onPress, variant = 'kraft', size = 46, badge,
}: { icon: IconName; onPress: () => void; variant?: IconVariant; size?: number; badge?: number }) {
  const v = {
    kraft: { bg: colors.kraft, border: colors.line, fg: colors.walnut },
    sage: { bg: colors.sage, border: colors.sage, fg: colors.forest },
    brown: { bg: colors.brown, border: colors.brown, fg: colors.cream },
    cream: { bg: colors.input, border: colors.line, fg: colors.walnut },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: v.border, backgroundColor: v.bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Ionicons name={icon} size={size * 0.46} color={v.fg} />
      {badge ? (
        <View style={{ position: 'absolute', top: -6, right: -4, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, backgroundColor: colors.terra, borderWidth: 2, borderColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
          <T size={11} weight="heavy" color={colors.cream}>{badge}</T>
        </View>
      ) : null}
    </Pressable>
  );
}

export function TextLink({ label, onPress, color = colors.green, size = 14 }: { label: string; onPress: () => void; color?: string; size?: number }) {
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <T size={size} weight="bold" color={color} style={{ textDecorationLine: 'underline' }}>{label}</T>
    </Pressable>
  );
}

export function DashedButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line, borderRadius: 18, paddingVertical: 13 }}
    >
      <Ionicons name="add" size={18} color={colors.brownLight} />
      <T size={15} weight="bold" color={colors.brownLight}>{label}</T>
    </Pressable>
  );
}

// ---------- Inputs ----------

export function Field({ label, hint, right, ...props }: { label?: string; hint?: string; right?: ReactNode } & TextInputProps) {
  return (
    <View style={{ width: '100%', gap: 5 }}>
      {label ? <T size={14} weight="heavy" color={colors.brownLight}>{label}</T> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.input, paddingHorizontal: 18 }}>
        <TextInput
          placeholderTextColor={colors.placeholder}
          {...props}
          style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: colors.ink }}
        />
        {right}
      </View>
      {hint ? <T size={13} weight="regular" color={colors.brownLight}>{hint}</T> : null}
    </View>
  );
}

export function SearchBar({ icon = 'search-outline', ...props }: { icon?: IconName } & TextInputProps) {
  return (
    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: 23, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.input, paddingHorizontal: 14 }}>
      <Ionicons name={icon} size={20} color={colors.walnut} />
      <TextInput placeholderTextColor={colors.placeholder} {...props} style={{ flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink }} />
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, dot }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName; dot?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 7, borderRadius: 18, borderWidth: 1.5,
        borderColor: selected ? colors.brown : colors.line, backgroundColor: selected ? colors.brown : colors.input,
      }}
    >
      {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
      {icon ? <Ionicons name={icon} size={15} color={selected ? colors.cream : colors.walnut} /> : null}
      <T size={14} weight="bold" color={selected ? colors.cream : colors.ink}>{label}</T>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>{children}</View>;
}

// Segmented control. tone "brown" = onboarding Join/Create/Skip; "kraft" = All/Mine/Roommates
export function Segmented<K extends string>({ options, value, onChange, tone = 'kraft' }: { options: { key: K; label: string }[]; value: K; onChange: (v: K) => void; tone?: 'kraft' | 'brown' }) {
  const track = tone === 'brown' ? colors.brown : colors.kraft;
  const idle = tone === 'brown' ? colors.cream : colors.ink;
  return (
    <View style={{ flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: track, borderWidth: tone === 'kraft' ? 1.5 : 0, borderColor: colors.line }}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 20, backgroundColor: active ? colors.sage : 'transparent' }}>
            <T size={14} weight="heavy" color={active ? colors.forest : idle}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.linePaper, true: colors.green }} thumbColor={colors.cream} ios_backgroundColor={colors.linePaper} />;
}

export function Checkbox({ checked, onPress }: { checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, borderColor: checked ? colors.sage : colors.line, backgroundColor: checked ? colors.sage : colors.input, alignItems: 'center', justifyContent: 'center' }}
    >
      {checked ? <Ionicons name="checkmark" size={16} color={colors.forest} /> : null}
    </Pressable>
  );
}

// Round check used on recipe ingredients / cooking steps
export function RoundCheck({ checked, label, onPress }: { checked: boolean; label?: string; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={8}
      style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: checked ? colors.sage : colors.brown, backgroundColor: checked ? colors.sage : 'transparent', alignItems: 'center', justifyContent: 'center' }}
    >
      {checked ? <Ionicons name="checkmark" size={15} color={colors.forest} /> : label ? <T size={12} weight="heavy" color={colors.brown}>{label}</T> : null}
    </Pressable>
  );
}

// − 6 + stepper
export function Stepper({ value, onChange, min = 1, suffix }: { value: number; onChange: (v: number) => void; min?: number; suffix?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <Pressable onPress={() => onChange(Math.max(min, value - 1))} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.walnut, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.input }}>
        <Ionicons name="remove" size={18} color={colors.walnut} />
      </Pressable>
      <Title size={30} color={colors.ink}>{suffix ? `${value} ${suffix}` : value}</Title>
      <Pressable onPress={() => onChange(value + 1)} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.sage, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="add" size={18} color={colors.forest} />
      </Pressable>
    </View>
  );
}

// ---------- People ----------

export function Avatar({ id, name, url, size = 34 }: { id: string; name?: string | null; url?: string | null; size?: number }) {
  if (url) return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.kraft }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id), borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }}>
      <Title size={size * 0.55} color={colors.walnut}>{initial(name)}</Title>
    </View>
  );
}

export function ProfilePhoto({ url, size = 100, dashed }: { url?: string | null; size?: number; dashed?: boolean }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderStyle: dashed ? 'dashed' : 'solid', borderColor: colors.brown, backgroundColor: colors.kraft, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' }}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <>
          <View style={{ width: size * 0.32, height: size * 0.32, borderRadius: size, backgroundColor: colors.brown, marginBottom: size * 0.05 }} />
          <View style={{ width: size * 0.66, height: size * 0.32, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: colors.brown }} />
        </>
      )}
    </View>
  );
}

export function Tag({ label, tone = 'kraft', dot, center }: { label: string; tone?: 'kraft' | 'amber' | 'terra' | 'sage' | 'brown' | 'green'; dot?: boolean; center?: boolean }) {
  const t = {
    kraft: { bg: colors.kraft, border: colors.line, text: colors.brownLight },
    amber: { bg: colors.amberTint, border: colors.amber, text: colors.walnut },
    terra: { bg: colors.terraTint, border: colors.terra, text: colors.terra },
    sage: { bg: colors.sageTint, border: colors.sage, text: colors.forest },
    brown: { bg: colors.brown, border: colors.brown, text: colors.cream },
    green: { bg: colors.sage, border: colors.sage, text: colors.forest },
  }[tone];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 11, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg, alignSelf: center ? 'center' : 'flex-start' }}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.text }} /> : null}
      <T size={12} weight="heavy" color={t.text}>{label}</T>
    </View>
  );
}

// Category pill used as group headers ("Produce", "Dairy")
export function CategoryPill({ label }: { label: string }) {
  return (
    <View style={{ alignSelf: 'flex-start', backgroundColor: colors.brown, paddingHorizontal: 9, paddingVertical: 2, borderRadius: 7 }}>
      <T size={12} weight="heavy" color={colors.cream}>{label}</T>
    </View>
  );
}

// Food icon tile (apple for produce, jar for pantry, ...)
export function CategoryIcon({ category, size = 36 }: { category: string; size?: number }) {
  const c = CATEGORY_ICON[category] ?? CATEGORY_ICON.Other;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name={c.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={size * 0.62} color={c.fg} />
    </View>
  );
}

// ---------- Items ----------

// Two-per-row pantry card with food icon
export function ItemCard({ name, subtitle, category, onPress, faded }: { name: string; subtitle: string; category: string; onPress?: () => void; faded?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: '48.5%', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.kraft, borderWidth: 1.5, borderColor: colors.line, borderRadius: 16, padding: 10, opacity: faded ? 0.6 : 1 }}
    >
      <CategoryIcon category={category} size={34} />
      <View style={{ flex: 1 }}>
        <T size={14} weight="heavy" numberOfLines={1}>{name}</T>
        <T size={12} weight="semibold" color={colors.brownLight} numberOfLines={1}>{subtitle}</T>
      </View>
    </Pressable>
  );
}

export function NavRow({ label, sublabel, onPress, right }: { label: string; sublabel?: string; onPress: () => void; right?: ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12 }}>
      <View style={{ flex: 1 }}>
        <T size={16} weight="bold">{label}</T>
        {sublabel ? <T size={13} weight="regular" color={colors.brownLight}>{sublabel}</T> : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={20} color={colors.walnut} />}
    </Pressable>
  );
}

export function ProgressBar({ value, color = colors.green, height = 8, marker }: { value: number; color?: string; height?: number; marker?: boolean }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: colors.field, overflow: marker ? 'visible' : 'hidden', justifyContent: 'center' }}>
      <View style={{ height: '100%', width: `${pct}%`, backgroundColor: color, borderRadius: height / 2 }} />
      {marker ? <View style={{ position: 'absolute', left: `${pct}%`, marginLeft: -7, width: 14, height: 14, borderRadius: 7, backgroundColor: colors.terra, borderWidth: 2, borderColor: colors.input }} /> : null}
    </View>
  );
}

// ---------- Overlays ----------

// Bottom sheet with grabber (filters, add item, edit item)
export function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(43,29,20,0.35)' }} />
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1.5, borderColor: colors.line, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34, gap: 12, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: 4 }} />
          <ScrollView contentContainerStyle={{ gap: 12 }} keyboardShouldPersistTaps="handled" bounces={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// "Bananas added · Undo"
export function Toast({ message, actionLabel, onAction, bottom = 16 }: { message: string | null; actionLabel?: string; onAction?: () => void; bottom?: number }) {
  if (!message) return null;
  return (
    <View style={{ position: 'absolute', left: 22, right: 22, bottom, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.green, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12 }}>
      <Ionicons name="checkmark-circle" size={20} color={colors.sage} />
      <T size={15} weight="bold" color={colors.cream} style={{ flex: 1 }}>{message}</T>
      {actionLabel && onAction ? <TextLink label={actionLabel} onPress={onAction} color={colors.amberTint} /> : null}
    </View>
  );
}

// Simple yes/no hook for toasts that hide after a few seconds
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  function show(message: string) {
    if (timer) clearTimeout(timer);
    setMsg(message);
    setTimer(setTimeout(() => setMsg(null), 3500));
  }
  return { message: msg, show, hide: () => setMsg(null) };
}

// Row you can swipe to reveal a red action. direction "left" = drag left (Grocery delete),
// "right" = drag right (scan review remove). A long swipe triggers it straight away.
export function SwipeRow({
  children, onAction, direction = 'left', label = 'Delete', bg = colors.kraft,
}: { children: ReactNode; onAction: () => void; direction?: 'left' | 'right'; label?: string; bg?: string }) {
  const sign = direction === 'left' ? -1 : 1;
  const x = useRef(new Animated.Value(0)).current;
  const open = useRef(false);
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        const moved = g.dx * sign + (open.current ? 84 : 0);
        x.setValue(Math.max(0, Math.min(260, moved)) * sign);
      },
      onPanResponderRelease: (_, g) => {
        const moved = g.dx * sign + (open.current ? 84 : 0);
        if (moved > 170) {
          Animated.timing(x, { toValue: 420 * sign, duration: 160, useNativeDriver: true }).start(() => {
            open.current = false;
            x.setValue(0);
            actionRef.current();
          });
          return;
        }
        open.current = moved > 50;
        Animated.spring(x, { toValue: open.current ? 84 * sign : 0, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => Animated.spring(x, { toValue: 0, useNativeDriver: true }).start(),
    })
  ).current;
  return (
    <View style={{ overflow: 'hidden', borderRadius: 8 }}>
      <Pressable
        onPress={() => {
          open.current = false;
          x.setValue(0);
          onAction();
        }}
        style={{
          position: 'absolute', top: 0, bottom: 0, [direction === 'left' ? 'right' : 'left']: 0, width: 84,
          backgroundColor: colors.terra, alignItems: 'center', justifyContent: 'center', gap: 2,
        }}
      >
        <Ionicons name="trash-outline" size={20} color={colors.cream} />
        <T size={12} weight="heavy" color={colors.cream}>{label}</T>
      </Pressable>
      <Animated.View {...pan.panHandlers} style={{ backgroundColor: bg, transform: [{ translateX: x }] }}>
        {children}
      </Animated.View>
    </View>
  );
}
