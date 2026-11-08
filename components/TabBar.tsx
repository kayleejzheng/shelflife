// Bottom tab bar (Figma "Nav/Tab bar"): dark brown bar, cream tile on the active tab,
// round sage Scan button in the middle.
import { Image, ImageSourcePropType, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';
import type { Tab } from '../lib/app';

// Icons exported from Figma. scan.png is the receipt-checklist icon, used for Grocery.
const TABS: { key: Tab; icon?: ImageSourcePropType }[] = [
  { key: 'pantry', icon: require('../assets/icons/pantry.png') },
  { key: 'meals', icon: require('../assets/icons/meals.png') },
  { key: 'scan' },
  { key: 'grocery', icon: require('../assets/icons/scan.png') },
  { key: 'profile', icon: require('../assets/icons/profile.png') },
];

export default function TabBar({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.tabBar, height: 90, paddingBottom: 20, paddingHorizontal: 8 }}>
      {TABS.map((t) => {
        const isActive = t.key === active;
        if (t.key === 'scan') {
          return (
            <Pressable key={t.key} onPress={() => onChange('scan')} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: 56, height: 56, borderRadius: 28, backgroundColor: colors.sage, borderWidth: 2,
                  borderColor: isActive ? colors.cream : 'rgba(243,234,219,0.6)', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Ionicons name="scan-outline" size={28} color={colors.cream} />
              </View>
            </Pressable>
          );
        }
        return (
          <Pressable key={t.key} onPress={() => onChange(t.key)} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ width: 64, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: isActive ? colors.cream : 'transparent' }}>
              <Image
                source={t.icon!}
                style={{ width: 30, height: 32, tintColor: isActive ? colors.walnut : colors.cream }}
                resizeMode="contain"
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
