import { useState, useEffect } from 'react';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const redirectUrl = makeRedirectUri({ scheme: 'task-tabber', path: 'auth' });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl, skipBrowserRedirect: true },
    });

    if (error || !data.url) return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success') {
      const url = new URL(result.url);
      const accessToken  = url.searchParams.get('access_token')
        ?? new URLSearchParams(url.hash.slice(1)).get('access_token');
      const refreshToken = url.searchParams.get('refresh_token')
        ?? new URLSearchParams(url.hash.slice(1)).get('refresh_token');

      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }
  };

  const signOut = () => supabase.auth.signOut();

  return { session, loading, signInWithGoogle, signOut };
}
