import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { CaveatBrush_400Regular } from '@expo-google-fonts/caveat-brush';
import { Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { supabase } from '../../lib/supabase';
import { AppProvider, Route, RouteName, Tab, useApp } from '../../lib/app';
import { onReminderTap } from '../../lib/notifications';
import { colors } from '../../lib/theme';
import TabBar from '../../components/TabBar';
import LoginScreen from '../../screens/LoginScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';
import InventoryScreen from '../../screens/InventoryScreen';
import CheckInScreen from '../../screens/CheckInScreen';
import ScanScreen from '../../screens/ScanScreen';
import MealsScreen from '../../screens/MealsScreen';
import RecipeScreen from '../../screens/RecipeScreen';
import CookingScreen from '../../screens/CookingScreen';
import GroceryScreen from '../../screens/GroceryScreen';
import ProfileScreen from '../../screens/ProfileScreen';
import ReviewScreen from '../../screens/ReviewScreen';
import SuggestionsScreen from '../../screens/SuggestionsScreen';
import CircleScreen from '../../screens/CircleScreen';
import SettingsScreen from '../../screens/SettingsScreen';
import EditProfileScreen from '../../screens/EditProfileScreen';

// Screens that cover the tab bar (matches the Figma frames)
const FULL_SCREEN: RouteName[] = ['settings', 'editProfile', 'checkin', 'review', 'recipe', 'cooking'];

function Loading() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState<Tab>('pantry');
  const [stack, setStack] = useState<Route[]>([]);
  const [fontsLoaded] = useFonts({ CaveatBrush_400Regular, Nunito_400Regular, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setStack([]);
        setTab('pantry');
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const push = useCallback((name: RouteName, params?: unknown) => setStack((s) => [...s, { name, params }]), []);
  const pop = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const goTab = useCallback((t: Tab) => {
    setStack([]);
    setTab(t);
  }, []);

  // Tapping a reminder notification opens the right screen
  useEffect(
    () =>
      onReminderTap((screen) => {
        if (screen === 'checkin') {
          setTab('pantry');
          setStack([{ name: 'checkin' }]);
        } else goTab('pantry');
      }),
    [goTab]
  );

  if (!fontsLoaded || !authReady) return <Loading />;
  if (!session) return <LoginScreen />;

  const top = stack[stack.length - 1];
  return (
    <AppProvider session={session} push={push} pop={pop} goTab={goTab} params={top?.params}>
      <Main tab={tab} top={top} goTab={goTab} />
    </AppProvider>
  );
}

function Main({ tab, top, goTab }: { tab: Tab; top?: Route; goTab: (t: Tab) => void }) {
  const { loaded, profile } = useApp();
  if (!loaded) return <Loading />;
  if (profile && !profile.onboarded) return <OnboardingScreen />;

  let content;
  if (top?.name === 'circle') content = <CircleScreen />;
  else if (top?.name === 'settings') content = <SettingsScreen />;
  else if (top?.name === 'editProfile') content = <EditProfileScreen />;
  else if (top?.name === 'checkin') content = <CheckInScreen />;
  else if (top?.name === 'review') content = <ReviewScreen />;
  else if (top?.name === 'suggestions') content = <SuggestionsScreen />;
  else if (top?.name === 'recipe') content = <RecipeScreen key={JSON.stringify(top.params)} />;
  else if (top?.name === 'cooking') content = <CookingScreen />;
  else if (tab === 'scan') content = <ScanScreen onSaved={() => goTab('pantry')} />;
  else if (tab === 'meals') content = <MealsScreen />;
  else if (tab === 'grocery') content = <GroceryScreen />;
  else if (tab === 'profile') content = <ProfileScreen />;
  else content = <InventoryScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>{content}</View>
      {!(top && FULL_SCREEN.includes(top.name)) && <TabBar active={tab} onChange={goTab} />}
    </View>
  );
}
