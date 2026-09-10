// @ts-nocheck — this file runs on Deno (Supabase Edge Functions), not
// Node/Vite, so `Deno.*` and the `npm:` import specifier below are correct
// but unknown to VS Code's default TypeScript checker, which would
// otherwise flag 5 false "problems" here. Install the official "Deno" VS
// Code extension and add `"deno.enablePaths": ["supabase/functions"]` to
// .vscode/settings.json (already done) for real Deno-aware IntelliSense
// instead of suppressing checks.
//
// Edge Function: admin-create-user
//
// Lets an Admin create a teammate's account directly, with a password they
// set themselves — no dependency on the person receiving/clicking a magic
// link email. This has to run server-side because creating an auth user
// with a chosen password requires the Supabase service-role key, which
// must never be shipped to the frontend (see README section 8 / the rest
// of this app's "no service-role key in the browser" design).
//
// Deploy via the Supabase Dashboard: Edge Functions -> Create a function
// named "admin-create-user" -> paste this file's contents -> Deploy.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically for every Edge Function — nothing to configure.
//
// Call it from the frontend with:
//   supabase.functions.invoke('admin-create-user', { body: { full_name, email, password, role } })
// The invoking user's session JWT is attached automatically by the client
// library, which is what lets this function verify the caller is really
// an Admin before it does anything privileged.

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

  let body: { full_name?: string; email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const fullName = (body.full_name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const role = body.role === 'admin' ? 'admin' : 'user';

  if (!fullName || !email || password.length < 6) {
    return json({ error: 'Provide a name, a valid email, and a password of at least 6 characters.' }, 400);
  }

  // Verify the caller is a logged-in, active Admin using their OWN session
  // (anon key + their JWT, so this respects RLS same as the rest of the
  // app) — only after this check do we touch the service-role client.
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
    return json({ error: 'Only an active Admin can create user accounts.' }, 403);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Pre-register the invite row first — the handle_new_auth_user trigger
  // (migration_002.sql) matches new auth.users rows against this by email
  // and creates the public.users profile automatically with this name/role,
  // so profile creation itself is reused from the already-tested invite
  // path rather than duplicated here.
  const { error: inviteError } = await admin
    .from('pending_invites')
    .upsert({ email, full_name: fullName, role, invited_by: caller.id });
  if (inviteError) return json({ error: 'Could not prepare the account record.' }, 500);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (createError) {
    await admin.from('pending_invites').delete().eq('email', email);
    const alreadyExists = createError.status === 422 || /already|exists/i.test(createError.message || '');
    return json({ error: alreadyExists ? 'That email is already registered.' : 'Could not create the account.' }, 400);
  }

  return json({ id: created.user?.id, email });
});
