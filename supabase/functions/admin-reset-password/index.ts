// @ts-nocheck — Deno Edge Function; see admin-create-user/index.ts for why
// VS Code's default checker doesn't understand this file.
//
// Edge Function: admin-reset-password
//
// Lets an Admin SET a new password for an existing teammate — not reveal
// their current one, which is impossible: Supabase never stores a password
// in reversible form, only a one-way hash. This is the legitimate way to
// give an Admin real control over account access (e.g. someone's locked
// out and email-based reset isn't practical) without ever handling or
// storing plaintext passwords anywhere.
//
// Deploy via the Supabase Dashboard: Edge Functions -> Create a function
// named "admin-reset-password" -> paste this file's contents -> Deploy.
//
// Call it from the frontend with:
//   supabase.functions.invoke('admin-reset-password', { body: { user_id, new_password } })

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

  let body: { user_id?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const targetUserId = (body.user_id || '').trim();
  const newPassword = body.new_password || '';

  if (!targetUserId || newPassword.length < 6) {
    return json({ error: 'Missing user, or password is shorter than 6 characters.' }, 400);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });
  const {
    data: { user: caller },
    error: callerError
  } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: 'Not authenticated.' }, 401);

  const { data: callerProfile } = await callerClient.from('users').select('role, active').eq('id', caller.id).single();
  if (!callerProfile || callerProfile.role !== 'admin' || callerProfile.active === false) {
    return json({ error: 'Only an active Admin can reset a password.' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, { password: newPassword });
  if (updateError) return json({ error: 'Could not update that account’s password.' }, 400);

  return json({ ok: true });
});
