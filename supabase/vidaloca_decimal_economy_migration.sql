-- ============================================================================
-- VIDA LOCA MMORPG — MIGRACIÓN ECONÓMICA FLOAT -> NUMERIC(14,2) + CHECK (>= 0)
-- Proyecto Supabase: raktyjhhvuqebyiozfib
-- Idempotente: seguro para ejecutar en SQL Editor de Supabase.
-- ============================================================================

-- 1. Conversión de todas las columnas monetarias a precisión decimal exacta NUMERIC(14,2)
ALTER TABLE "public"."players"
  ALTER COLUMN "euros" TYPE NUMERIC(14, 2) USING ROUND("euros"::numeric, 2),
  ALTER COLUMN "euros" SET DEFAULT 100.00,
  ALTER COLUMN "dirtyEuros" TYPE NUMERIC(14, 2) USING ROUND("dirtyEuros"::numeric, 2),
  ALTER COLUMN "dirtyEuros" SET DEFAULT 0.00;

ALTER TABLE "public"."item_templates"
  ALTER COLUMN "priceEuros" TYPE NUMERIC(14, 2) USING CASE WHEN "priceEuros" IS NULL THEN NULL ELSE ROUND("priceEuros"::numeric, 2) END;

ALTER TABLE "public"."vehicle_templates"
  ALTER COLUMN "priceEuros" TYPE NUMERIC(14, 2) USING CASE WHEN "priceEuros" IS NULL THEN NULL ELSE ROUND("priceEuros"::numeric, 2) END;

ALTER TABLE "public"."property_templates"
  ALTER COLUMN "priceEuros" TYPE NUMERIC(14, 2) USING ROUND("priceEuros"::numeric, 2);

ALTER TABLE "public"."clans"
  ALTER COLUMN "funds" TYPE NUMERIC(14, 2) USING ROUND("funds"::numeric, 2),
  ALTER COLUMN "funds" SET DEFAULT 0.00;

ALTER TABLE "public"."territories"
  ALTER COLUMN "incomeRate" TYPE NUMERIC(14, 2) USING ROUND("incomeRate"::numeric, 2);

ALTER TABLE "public"."mission_templates"
  ALTER COLUMN "rewardEuros" TYPE NUMERIC(14, 2) USING ROUND("rewardEuros"::numeric, 2);

ALTER TABLE "public"."transaction_logs"
  ALTER COLUMN "amount" TYPE NUMERIC(14, 2) USING ROUND("amount"::numeric, 2);

ALTER TABLE "public"."achievements"
  ALTER COLUMN "rewardEuros" TYPE NUMERIC(14, 2) USING ROUND("rewardEuros"::numeric, 2),
  ALTER COLUMN "rewardEuros" SET DEFAULT 0.00;

ALTER TABLE "public"."market_listings"
  ALTER COLUMN "priceEuros" TYPE NUMERIC(14, 2) USING ROUND("priceEuros"::numeric, 2);

-- 2. Saneamiento preventivo y restricciones CHECK de no-negatividad en DB
UPDATE "public"."players"
SET
  "euros" = GREATEST(0, "euros"),
  "dirtyEuros" = GREATEST(0, "dirtyEuros"),
  "vidaCoins" = GREATEST(0, "vidaCoins")
WHERE "euros" < 0 OR "dirtyEuros" < 0 OR "vidaCoins" < 0;

UPDATE "public"."clans"
SET "funds" = GREATEST(0, "funds")
WHERE "funds" < 0;

UPDATE "public"."transaction_logs"
SET "amount" = GREATEST(0, "amount")
WHERE "amount" < 0;

UPDATE "public"."market_listings"
SET "priceEuros" = 1.00
WHERE "priceEuros" <= 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_euros_non_negative') THEN
    ALTER TABLE "public"."players"
      ADD CONSTRAINT "players_euros_non_negative" CHECK ("euros" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_dirty_euros_non_negative') THEN
    ALTER TABLE "public"."players"
      ADD CONSTRAINT "players_dirty_euros_non_negative" CHECK ("dirtyEuros" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_vidacoins_non_negative') THEN
    ALTER TABLE "public"."players"
      ADD CONSTRAINT "players_vidacoins_non_negative" CHECK ("vidaCoins" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clans_funds_non_negative') THEN
    ALTER TABLE "public"."clans"
      ADD CONSTRAINT "clans_funds_non_negative" CHECK ("funds" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transaction_logs_amount_non_negative') THEN
    ALTER TABLE "public"."transaction_logs"
      ADD CONSTRAINT "transaction_logs_amount_non_negative" CHECK ("amount" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'market_listings_price_positive') THEN
    ALTER TABLE "public"."market_listings"
      ADD CONSTRAINT "market_listings_price_positive" CHECK ("priceEuros" > 0);
  END IF;
END
$$;
