-- ============================================================================
-- VIDA LOCA MMORPG — BLINDAJE TOTAL DE BASE DE DATOS (CAJA BLINDADA + VAULT)
-- Proyecto Supabase: raktyjhhvuqebyiozfib
-- Idempotente: seguro para re-ejecutar en SQL Editor de Supabase o PostgreSQL.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS "public";
CREATE SCHEMA IF NOT EXISTS "vidaloca_vault";

-- ----------------------------------------------------------------------------
-- 1. AISLAMIENTO ESTRICTO DEL ESQUEMA "vidaloca_vault" (CAJA MÁS BLINDADA - TARJETAS/KYC)
-- ----------------------------------------------------------------------------
REVOKE ALL ON SCHEMA "vidaloca_vault" FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA "vidaloca_vault" FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA "vidaloca_vault" FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "vidaloca_vault" FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA "vidaloca_vault"
  REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "vidaloca_vault"
  REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA "vidaloca_vault"
  REVOKE ALL ON FUNCTIONS FROM PUBLIC;

DO $$
DECLARE
  r TEXT;
BEGIN
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA "vidaloca_vault" FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "vidaloca_vault" FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "vidaloca_vault" FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "vidaloca_vault" FROM %I', r);
      EXECUTE format('REVOKE USAGE ON SCHEMA "public" FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "public" FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA "public" FROM %I', r);
    END IF;
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 2. ACTIVAR RLS Y FORCE RLS EN TODAS LAS TABLAS DE "public" Y "vidaloca_vault"
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'vidaloca_vault')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      tbl.schemaname,
      tbl.tablename
    );
    EXECUTE format(
      'ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',
      tbl.schemaname,
      tbl.tablename
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 3. POLÍTICAS DENY-ALL PARA ROLES DE DATA API (anon / authenticated)
--    Todo el acceso pasa obligatoriamente por la API NestJS autorizada.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl RECORD;
  has_anon BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon');
  has_auth BOOLEAN := EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated');
BEGIN
  FOR tbl IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname IN ('public', 'vidaloca_vault')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "vidaloca_deny_api_roles" ON %I.%I',
      tbl.schemaname,
      tbl.tablename
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS "vidaloca_allow_backend_owner" ON %I.%I',
      tbl.schemaname,
      tbl.tablename
    );

    IF has_anon AND has_auth THEN
      EXECUTE format(
        'CREATE POLICY "vidaloca_deny_api_roles" ON %I.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        tbl.schemaname,
        tbl.tablename
      );
    ELSIF has_anon THEN
      EXECUTE format(
        'CREATE POLICY "vidaloca_deny_api_roles" ON %I.%I AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false)',
        tbl.schemaname,
        tbl.tablename
      );
    END IF;

    -- Permite únicamente al rol propietario actual de la base de datos (backend Prisma)
    EXECUTE format(
      'CREATE POLICY "vidaloca_allow_backend_owner" ON %I.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
      tbl.schemaname,
      tbl.tablename,
      current_user
    );
  END LOOP;
END
$$;

-- ----------------------------------------------------------------------------
-- 4. POLÍTICAS EXPLÍCITAS DE CERO EXPOSICIÓN EN TABLAS ULTRA-SENSIBLES
--    (Evita cualquier lectura o escritura accidental incluso con nuevas concesiones)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "vault_records_never_delete" ON "vidaloca_vault"."vault_records";
CREATE POLICY "vault_records_never_delete"
  ON "vidaloca_vault"."vault_records"
  AS RESTRICTIVE
  FOR DELETE
  TO PUBLIC
  USING (false);

-- ----------------------------------------------------------------------------
-- 5. CADENA FORENSE INMUTABLE (APPEND-ONLY) PARA AUDITORÍA, ANTI-CHEAT Y VAULT LOGS
--    Impide UPDATE o DELETE sobre registros de auditoría incluso a nivel SQL.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."vidaloca_prevent_audit_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'VIDALOCA_SECURITY: Los logs forenses (%) son inmutables (append-only)', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS "trg_immutable_security_audit_logs" ON "public"."security_audit_logs";
CREATE TRIGGER "trg_immutable_security_audit_logs"
  BEFORE UPDATE OR DELETE ON "public"."security_audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."vidaloca_prevent_audit_mutation"();

DROP TRIGGER IF EXISTS "trg_immutable_anti_cheat_incidents" ON "public"."anti_cheat_incidents";
CREATE TRIGGER "trg_immutable_anti_cheat_incidents"
  BEFORE UPDATE OR DELETE ON "public"."anti_cheat_incidents"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."vidaloca_prevent_audit_mutation"();

DROP TRIGGER IF EXISTS "trg_immutable_vault_access_logs" ON "vidaloca_vault"."vault_access_logs";
CREATE TRIGGER "trg_immutable_vault_access_logs"
  BEFORE UPDATE OR DELETE ON "vidaloca_vault"."vault_access_logs"
  FOR EACH ROW
  EXECUTE FUNCTION "public"."vidaloca_prevent_audit_mutation"();
