import { supabase } from './supabaseClient';

// Shared error handling for the admin-* Edge Functions: "FunctionsFetchError"
// (no error.context at all) means the browser couldn't reach the function
// endpoint over the network — in practice that's almost always because the
// function hasn't been deployed yet in the Supabase project, not a bug in
// the call itself. Non-2xx responses (FunctionsHttpError) DO have a context
// Response, whose body carries the function's own JSON error message.
async function invokeAdminFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    if (!error.context) {
      return {
        error: `Server تک درخواست نہیں پہنچی۔ یقینی بنائیں کہ Supabase Dashboard میں "${name}" Edge Function موجود اور deployed ہے (Edge Functions → نام بالکل "${name}" ہونا چاہیے)۔`
      };
    }
    const message = (await error.context.json?.().catch(() => null))?.error;
    return { error: message || error.message || 'Something went wrong.' };
  }
  if (data?.error) return { error: data.error };
  return { data };
}

// Admin creates a teammate's account directly with a password they choose —
// see supabase/functions/admin-create-user/index.ts.
export async function createUserDirectly({ fullName, email, password, role }) {
  return invokeAdminFunction('admin-create-user', { full_name: fullName, email, password, role });
}

// Admin sets a NEW password for an existing teammate (never reveals the old
// one — that's impossible, Supabase only stores a one-way hash). See
// supabase/functions/admin-reset-password/index.ts.
export async function resetUserPassword(userId, newPassword) {
  return invokeAdminFunction('admin-reset-password', { user_id: userId, new_password: newPassword });
}
