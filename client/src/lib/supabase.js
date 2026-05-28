import { createClient } from '@supabase/supabase-js';

// Prefer explicit environment variables. Fall back to the local auth Supabase project so the app boots during dev.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wmjdpctpcfxulozvoqtx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndtamRwY3RwY2Z4dWxvenZvcXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNjU0NTEsImV4cCI6MjA5Mzc0MTQ1MX0.V86WUslacQgGBlxQ5tm-vDIlaTCuCG1fFL9YhZTZHws';
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function createSupabaseFallbackClient() {
  const resolved = { data: { session: null }, error: null };

  return {
    auth: {
      getSession: async () => resolved,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null })
    }
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
  })
  : createSupabaseFallbackClient();

export { isSupabaseConfigured };

// Expose for debugging in development so devtools can access session/token
if (import.meta.env.DEV) {
  try {
    // attach to window for console debugging
    // eslint-disable-next-line no-undef
    window.supabase = supabase;
    // helper to quickly get current session
    // eslint-disable-next-line no-undef
    window.getSupabaseSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { error };
      return data;
    };
    // helper to get access token string
    // eslint-disable-next-line no-undef
    window.getSupabaseAccessToken = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) return { error };
      return data.session?.access_token ?? null;
    };
  } catch (e) {
    // ignore when window is not defined (SSR) or other issues
  }
}