import { createClient } from '@supabase/supabase-js';

// These come from your Supabase project settings (Project Settings > API).
// Set them in a .env file at the project root:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=your-anon-public-key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly and clearly instead of silently breaking every screen —
  // this is the #1 setup mistake, so surface it immediately.
  // eslint-disable-next-line no-console
  console.error(
    'Missing Supabase config. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
