// TEST-ONLY stand-in. Records calls so tests can assert what the real code
// tried to do, without ever touching a real network or database — because
// this sandbox cannot reach either. This does NOT verify Supabase/RLS
// behavior; it only lets pure JS logic that happens to sit in the same file
// as a Supabase import run under Node for real.
export const calls = [];

function chain() {
  const state = {};
  const api = {
    select: (...a) => { calls.push(['select', ...a]); return api; },
    eq: (...a) => { calls.push(['eq', ...a]); return api; },
    order: (...a) => { calls.push(['order', ...a]); return api; },
    insert: (row) => { calls.push(['insert', row]); return Promise.resolve({ data: row, error: null }); },
    update: (row) => { calls.push(['update', row]); return api; },
    then: (resolve) => resolve({ data: [], error: null })
  };
  return api;
}

export const supabase = {
  from: (table) => { calls.push(['from', table]); return chain(); },
  auth: { signInWithOtp: async () => ({ error: null }) },
  storage: { from: () => ({ upload: async () => ({ error: null }) }) }
};
