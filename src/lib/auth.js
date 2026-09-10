import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

/**
 * useSession — tracks the logged-in auth user AND their profile row
 * (role, active flag, name) from the public.users table.
 * Every screen that needs "who is this and are they an admin" uses this.
 */
export function useSession() {
  const [authUser, setAuthUser] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Set when the user arrived via a "reset password" email link — Supabase
  // signs them in automatically for this, but they should be forced through
  // a "set new password" screen first, not dropped straight into the app.
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setAuthUser(session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (authUser === undefined) return; // still loading initial session
    if (authUser === null) {
      setProfile(null);
      setLoading(false);
      return;
    }
    supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('Failed to load profile', error);
        setProfile(data ?? null);
        setLoading(false);
      });
  }, [authUser]);

  return {
    authUser,
    profile,
    loading,
    isAdmin: profile?.role === 'admin',
    isActive: profile?.active !== false,
    passwordRecovery,
    clearPasswordRecovery: () => setPasswordRecovery(false)
  };
}

export async function signOut() {
  await supabase.auth.signOut();
}

// Changes the password for the currently signed-in user (works for Admin
// and regular Users alike — Supabase re-validates the active session, no
// separate "current password" round trip needed).
export async function changePassword(newPassword) {
  return supabase.auth.updateUser({ password: newPassword });
}

// Sends a "reset your password" email. Clicking the link in it signs the
// person in and fires a PASSWORD_RECOVERY auth event (see useSession above),
// which routes them to the "set new password" screen regardless of what
// page they land on.
export async function requestPasswordReset(email) {
  return supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
}
