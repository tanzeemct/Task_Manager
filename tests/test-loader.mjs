// TEST-ONLY. Not part of the shipped application. This lets Node actually
// execute src/lib/recurring.js (which has a top-level import of the real
// supabaseClient.js, which in turn imports the @supabase/supabase-js
// package that cannot be installed in this offline sandbox) by swapping in
// an in-memory fake for that one import, so the pure date-math function
// living in the same file can be run for real instead of only read.
const stubUrl = new URL('./stub-supabase-client.mjs', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith('/supabaseClient') || specifier.endsWith('/supabaseClient.js')) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
