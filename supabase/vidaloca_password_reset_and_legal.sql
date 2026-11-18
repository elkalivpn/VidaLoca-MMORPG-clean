-- ============================================================================
-- VIDA LOCA MMORPG — RECUPERACIÓN DE CONTRASEÑA Y CONSENTIMIENTO LEGAL +18
-- Proyecto Supabase: raktyjhhvuqebyiozfib
-- Idempotente: seguro para ejecutar en SQL Editor de Supabase.
-- ============================================================================

-- 1. Columnas de auditoría de consentimiento legal y +18 en public.users
ALTER TABLE "public"."users"
  ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ageVerifiedAt" TIMESTAMP(3);

-- 2. Tabla de tokens de recuperación de contraseña (almacena únicamente hash SHA-256)
CREATE TABLE IF NOT EXISTS "public"."password_reset_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "requestedIpHash" TEXT,
  "usedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'password_reset_tokens_userId_fkey'
  ) THEN
    ALTER TABLE "public"."password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_tokenHash_key"
  ON "public"."password_reset_tokens"("tokenHash");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_userId_createdAt_idx"
  ON "public"."password_reset_tokens"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "password_reset_tokens_expiresAt_idx"
  ON "public"."password_reset_tokens"("expiresAt");

-- 3. Blindaje RLS obligatorio (bloqueo total a anon/authenticated de Data API)
ALTER TABLE "public"."password_reset_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."password_reset_tokens" FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  r TEXT;
  has_anon BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  has_auth BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON TABLE "public"."password_reset_tokens" FROM %I', r);
    END IF;
  END LOOP;

  DROP POLICY IF EXISTS "vidaloca_deny_api_roles" ON "public"."password_reset_tokens";
  DROP POLICY IF EXISTS "vidaloca_allow_backend_owner" ON "public"."password_reset_tokens";

  IF has_anon AND has_auth THEN
    CREATE POLICY "vidaloca_deny_api_roles"
      ON "public"."password_reset_tokens"
      AS RESTRICTIVE FOR ALL TO anon, authenticated
      USING (false) WITH CHECK (false);
  ELSIF has_anon THEN
    CREATE POLICY "vidaloca_deny_api_roles"
      ON "public"."password_reset_tokens"
      AS RESTRICTIVE FOR ALL TO anon
      USING (false) WITH CHECK (false);
  END IF;

  EXECUTE format(
    'CREATE POLICY "vidaloca_allow_backend_owner" ON "public"."password_reset_tokens" FOR ALL TO %I USING (true) WITH CHECK (true)',
    current_user
  );
END
$$;
