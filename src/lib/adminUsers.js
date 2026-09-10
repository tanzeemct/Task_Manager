import { supabase } from './supabaseClient';

// Admin creates a teammate's account directly with a password they choose —
// calls the admin-create-user Edge Function (server-side, service-role key
// only lives there; see supabase/functions/admin-create-user/index.ts).
export async function createUserDirectly({ fullName, email, password, role }) {
  const { data, error } = await supabase.functions.invoke('admin-create-user', {
    body: { full_name: fullName, email, password, role }
  });
  if (error) {
    // "FunctionsFetchError" (no error.context at all) means the browser
    // couldn't reach the function endpoint over the network — in practice
    // that's almost always because admin-create-user hasn't been deployed
    // yet in the Supabase project (see README section 3A step 6), not a
    // bug in this call. Non-2xx responses (FunctionsHttpError) DO have a
    // context Response, whose body carries the function's own JSON error.
    if (!error.context) {
      return {
        error:
          'Server تک درخواست نہیں پہنچی۔ یقینی بنائیں کہ Supabase Dashboard میں "admin-create-user" Edge Function موجود اور deployed ہے (Edge Functions → نام بالکل "admin-create-user" ہونا چاہیے)۔'
      };
    }
    const message = (await error.context.json?.().catch(() => null))?.error;
    return { error: message || error.message || 'Could not create the account.' };
  }
  if (data?.error) return { error: data.error };
  return { data };
}
