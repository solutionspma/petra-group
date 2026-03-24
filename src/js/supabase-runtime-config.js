/**
 * Filled at build time on Netlify/CI when SUPABASE_URL and SUPABASE_ANON_KEY are set.
 * See build.js — local dev leaves these empty until you export env vars and run npm run build.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';
export const DRIVE_BUCKET = 'tpg-private';

export function isDriveConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}
