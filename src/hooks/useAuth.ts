'use client';

import { useContext, useCallback } from 'react';
import { AuthContext } from '@/components/Providers';
import { getSupabaseBrowser } from '@/lib/db/supabase-browser';

export function useAuth() {
  const { user, isLoading } = useContext(AuthContext);
  const supabase = getSupabaseBrowser();

  const signInWithMagicLink = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }, [supabase]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    signInWithMagicLink,
    signOut,
  };
}
