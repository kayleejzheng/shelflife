// Shared app state: who's logged in, their profile, their circle, and simple navigation.
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  dietary: string[] | null;
  avoid: string | null;
  notifications: boolean | null;
  onboarded: boolean | null;
};
export type Circle = { id: string; name: string; invite_code: string; created_by: string; kind: string | null };
export type Member = { id: string; display_name: string | null; avatar_url: string | null };
export type Tab = 'pantry' | 'meals' | 'scan' | 'grocery' | 'profile';
export type RouteName = 'circle' | 'settings' | 'editProfile' | 'checkin' | 'review' | 'suggestions' | 'recipe' | 'cooking';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Route = { name: RouteName; params?: any };

type AppState = {
  session: Session;
  userId: string;
  email: string;
  profile: Profile | null;
  circle: Circle | null;
  members: Member[];
  refresh: () => Promise<void>;
  loaded: boolean;
  push: (name: RouteName, params?: unknown) => void;
  pop: () => void;
  goTab: (tab: Tab) => void;
  params: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  logActivity: (message: string) => Promise<void>;
  nameOf: (userId: string) => string;
};

const AppContext = createContext<AppState | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

export function AppProvider({
  session,
  push,
  pop,
  goTab,
  params,
  children,
}: {
  session: Session;
  push: (name: RouteName, params?: unknown) => void;
  pop: () => void;
  goTab: (tab: Tab) => void;
  params: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  children: ReactNode;
}) {
  const userId = session.user.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    // Profile (create it if the signup trigger didn't)
    let { data: p } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (!p) {
      const { data: created } = await supabase
        .from('profiles')
        .upsert({ id: userId, display_name: session.user.email?.split('@')[0] ?? 'Me' })
        .select()
        .single();
      p = created;
    }
    setProfile(p);

    // First circle the user belongs to
    const { data: membership } = await supabase
      .from('circle_members')
      .select('circle_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      setCircle(null);
      setMembers(p ? [{ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url }] : []);
      setLoaded(true);
      return;
    }

    const { data: c } = await supabase.from('circles').select('*').eq('id', membership.circle_id).single();
    setCircle(c);

    const { data: rows } = await supabase.from('circle_members').select('user_id').eq('circle_id', membership.circle_id);
    const ids = (rows ?? []).map((r) => r.user_id);
    const { data: people } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', ids);
    setMembers(people ?? []);
    setLoaded(true);
  }, [userId, session.user.email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logActivity = useCallback(
    async (message: string) => {
      if (!circle) return;
      await supabase.from('circle_activity').insert({ circle_id: circle.id, message });
    },
    [circle]
  );

  const nameOf = useCallback(
    (id: string) => {
      if (id === userId) return profile?.display_name ?? 'You';
      return members.find((m) => m.id === id)?.display_name ?? 'Someone';
    },
    [members, profile, userId]
  );

  return (
    <AppContext.Provider
      value={{
        session,
        userId,
        email: session.user.email ?? '',
        profile,
        circle,
        members,
        refresh,
        loaded,
        push,
        pop,
        goTab,
        params,
        logActivity,
        nameOf,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
