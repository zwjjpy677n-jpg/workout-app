export const ONLINE = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
};

export const isOnlineConfigured = () => ONLINE.url !== '' && ONLINE.anonKey !== '';
