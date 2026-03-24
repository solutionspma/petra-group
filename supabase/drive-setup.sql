-- TPG My Drive — Supabase Storage + Auth (run in Supabase SQL editor)
-- Bucket: private, not public. Each authenticated user only sees files under folder {their user uuid}/

-- 1) Create bucket (skip if it already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tpg-private',
  'tpg-private',
  false,
  52428800, -- 50 MB per object; adjust in dashboard if needed
  NULL      -- allow all MIME types; tighten later if you want
)
ON CONFLICT (id) DO NOTHING;

-- 2) RLS policies: first path segment must equal auth.uid()
--    Files are stored as:  {user_uuid}/filename.ext

DROP POLICY IF EXISTS "tpg_private_select_own" ON storage.objects;
DROP POLICY IF EXISTS "tpg_private_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "tpg_private_update_own" ON storage.objects;
DROP POLICY IF EXISTS "tpg_private_delete_own" ON storage.objects;

CREATE POLICY "tpg_private_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tpg-private'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "tpg_private_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tpg-private'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "tpg_private_update_own"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tpg-private'
  AND split_part(name, '/', 1) = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'tpg-private'
  AND split_part(name, '/', 1) = auth.uid()::text
);

CREATE POLICY "tpg_private_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tpg-private'
  AND split_part(name, '/', 1) = auth.uid()::text
);

-- 3) Users
--    In Supabase Dashboard → Authentication → Users: invite users or create them with email + password.
--    Keep "Confirm email" settings aligned with how you onboard staff (you can auto-confirm for internal use).

-- 4) Site URL
--    Authentication → URL configuration: add your production URL (e.g. https://tpgbenefits.netlify.app)
--    and redirect URLs if you use magic links later.

-- 5) Netlify / build
--    Set SUPABASE_URL and SUPABASE_ANON_KEY (Project Settings → API) as environment variables
--    so the static build can inject them (see petra-group build.js).
