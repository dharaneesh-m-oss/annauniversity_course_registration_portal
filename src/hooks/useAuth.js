import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../supabase';

function mapSupabaseUser(session) {
  const user = session?.user;
  if (!user) return null;
  return {
    id: user.id,
    uid: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.user_metadata?.name || user.email
  };
}

function getRedirectUrl() {
  return import.meta.env.VITE_APP_URL || window.location.origin;
}

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(mapSupabaseUser(data.session));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSupabaseUser(session));
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    user,
    loading,
    signIn: () =>
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getRedirectUrl()
        }
      }),
    signOut: () => supabase.auth.signOut()
  };
}
