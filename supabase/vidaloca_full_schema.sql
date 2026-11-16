-- ============================================================================
-- VIDA LOCA MMORPG — ESQUEMA COMPLETO E IDEMPOTENTE (CREACIÓN + ACTUALIZACIÓN)
-- Proyecto Supabase: raktyjhhvuqebyiozfib
-- Seguro para ejecutar tanto en una BD vacía como sobre un esquema previo.
-- ============================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";
CREATE SCHEMA IF NOT EXISTS "vidaloca_vault";

-- ----------------------------------------------------------------------------
-- 1. ENUMS (seguros ante re-ejecución + nuevos valores)
-- ----------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN', 'MODERATOR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "FactionType" AS ENUM ('CIVILIAN', 'POLICE', 'GUARDIA_CIVIL', 'SYNDICATE', 'ENTREPRENEUR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ItemType" AS ENUM ('WEAPON', 'VEHICLE', 'HOUSE', 'CONSUMABLE', 'SKILL_CARD', 'COSMETIC'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'MANSION', 'WAREHOUSE', 'CLUB', 'GARAGE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER', 'RECRUIT'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MissionMode" AS ENUM ('STORY', 'ONLINE_SOLO', 'ONLINE_COOP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'SUICIDE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "MissionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CLAIMED', 'ABANDONED', 'SKIPPED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "TransactionType" AS ENUM ('EARN', 'SPEND', 'PURCHASE', 'GIFT', 'PENALTY'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Currency" AS ENUM ('EUR', 'VIDACOIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SkillCategory" AS ENUM ('COMBAT', 'DRIVING', 'STEALTH', 'BUSINESS', 'SOCIAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "vidaloca_vault"."VaultRecordType" AS ENUM ('PAYMENT_CARD', 'IDENTITY_KYC', 'RECOVERY_SECRET'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'ABANDONED';
ALTER TYPE "MissionStatus" ADD VALUE IF NOT EXISTS 'SKIPPED';

-- ----------------------------------------------------------------------------
-- 2. TABLAS (CREATE TABLE IF NOT EXISTS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastPasswordChange" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "players" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "reputation" INTEGER NOT NULL DEFAULT 0,
    "euros" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "dirtyEuros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vidaCoins" INTEGER NOT NULL DEFAULT 0,
    "locationId" TEXT DEFAULT 'madrid_centro',
    "heat" INTEGER NOT NULL DEFAULT 0,
    "wantedLevel" INTEGER NOT NULL DEFAULT 0,
    "faction" "FactionType" NOT NULL DEFAULT 'CIVILIAN',
    "factionRank" INTEGER NOT NULL DEFAULT 1,
    "jailUntil" TIMESTAMP(3),
    "lifestyle" TEXT NOT NULL DEFAULT 'GREY',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "item_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "stats" JSONB,
    "priceEuros" DOUBLE PRECISION,
    "priceVida" INTEGER,

    CONSTRAINT "item_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "inventory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vehicle_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "speed" INTEGER NOT NULL,
    "handling" INTEGER NOT NULL,
    "durability" INTEGER NOT NULL,
    "capacity" INTEGER NOT NULL,
    "priceEuros" DOUBLE PRECISION,
    "priceVida" INTEGER,

    CONSTRAINT "vehicle_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_vehicles" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'white',
    "condition" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "property_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "security" INTEGER NOT NULL,
    "priceEuros" DOUBLE PRECISION NOT NULL,
    "priceVida" INTEGER,
    "rentYield" DOUBLE PRECISION,

    CONSTRAINT "property_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_properties" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRentCollectedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "customized" JSONB,

    CONSTRAINT "player_properties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "funds" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clan_members" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "incomeRate" DOUBLE PRECISION NOT NULL,
    "bonusType" TEXT,
    "controllerId" TEXT,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "clan_territories" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_territories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "mission_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "mode" "MissionMode" NOT NULL DEFAULT 'ONLINE_SOLO',
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "city" TEXT,
    "minLevel" INTEGER NOT NULL DEFAULT 1,
    "minPlayers" INTEGER NOT NULL DEFAULT 1,
    "maxPlayers" INTEGER NOT NULL DEFAULT 1,
    "isOptional" BOOLEAN NOT NULL DEFAULT true,
    "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    "cooldownHours" INTEGER NOT NULL DEFAULT 0,
    "requiredSteps" INTEGER NOT NULL DEFAULT 3,
    "rewardEuros" DOUBLE PRECISION NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "rewardVidaCoins" INTEGER NOT NULL DEFAULT 0,
    "rewardReputation" INTEGER NOT NULL DEFAULT 0,
    "rewardItemName" TEXT,
    "unlockBenefit" TEXT,
    "requirement" JSONB,

    CONSTRAINT "mission_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_missions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "squadCode" TEXT,
    "coOpParticipants" JSONB,
    "lastStepAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "player_missions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "completed_missions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "completed_missions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "battle_pass_seasons" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "battle_pass_seasons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "battle_pass_progress" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "rewardsClaimed" INTEGER[],

    CONSTRAINT "battle_pass_progress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "transaction_logs" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" "Currency" NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ipHash" TEXT,
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxLevel" INTEGER NOT NULL DEFAULT 10,
    "category" "SkillCategory" NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_skills" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_skills_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "achievements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "rewardVida" INTEGER NOT NULL DEFAULT 0,
    "rewardEuros" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_achievements" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_achievements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "player_weapons" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "damage" INTEGER NOT NULL,
    "range" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_weapons_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "game_sessions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "sessionData" JSONB,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "security_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "target" TEXT,
    "ipHash" TEXT,
    "details" JSONB,
    "prevHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "anti_cheat_incidents" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "playerId" TEXT,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "strikes" INTEGER NOT NULL DEFAULT 1,
    "blocked" BOOLEAN NOT NULL DEFAULT true,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anti_cheat_incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vidaloca_vault"."vault_records" (
    "id" TEXT NOT NULL,
    "vaultToken" TEXT NOT NULL,
    "ownerUserIdHash" TEXT NOT NULL,
    "recordType" "vidaloca_vault"."VaultRecordType" NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
    "encryptedDek" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "encryptedPayload" TEXT NOT NULL,
    "blindIndex" TEXT NOT NULL,
    "maskedSummary" TEXT NOT NULL,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "expMonth" INTEGER,
    "expYear" INTEGER,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vault_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vidaloca_vault"."vault_access_logs" (
    "id" TEXT NOT NULL,
    "vaultRecordId" TEXT,
    "actorIdHash" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "ipHash" TEXT,
    "reason" TEXT,
    "prevHash" TEXT NOT NULL,
    "entryHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vault_access_logs_pkey" PRIMARY KEY ("id")
);

-- ----------------------------------------------------------------------------
-- 3. COLUMNAS NUEVAS PARA TABLAS PRE-EXISTENTES (ACTUALIZACIÓN SIN PÉRDIDA DE DATOS)
-- ----------------------------------------------------------------------------
ALTER TABLE "users"
    ADD COLUMN IF NOT EXISTS "isBanned" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "banReason" TEXT,
    ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastPasswordChange" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "players"
    ADD COLUMN IF NOT EXISTS "dirtyEuros" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "heat" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "wantedLevel" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "faction" "FactionType" NOT NULL DEFAULT 'CIVILIAN',
    ADD COLUMN IF NOT EXISTS "factionRank" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "jailUntil" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lifestyle" TEXT NOT NULL DEFAULT 'GREY';
ALTER TABLE "players" ALTER COLUMN "locationId" SET DEFAULT 'madrid_centro';

ALTER TABLE "player_properties"
    ADD COLUMN IF NOT EXISTS "lastRentCollectedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

ALTER TABLE "mission_templates"
    ADD COLUMN IF NOT EXISTS "mode" "MissionMode" NOT NULL DEFAULT 'ONLINE_SOLO',
    ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "minLevel" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "minPlayers" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "maxPlayers" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS "isOptional" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "isRepeatable" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "cooldownHours" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "requiredSteps" INTEGER NOT NULL DEFAULT 3,
    ADD COLUMN IF NOT EXISTS "rewardVidaCoins" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "rewardReputation" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "rewardItemName" TEXT,
    ADD COLUMN IF NOT EXISTS "unlockBenefit" TEXT;

ALTER TABLE "player_missions"
    ADD COLUMN IF NOT EXISTS "squadCode" TEXT,
    ADD COLUMN IF NOT EXISTS "coOpParticipants" JSONB,
    ADD COLUMN IF NOT EXISTS "lastStepAt" TIMESTAMP(3);

ALTER TABLE "refresh_tokens"
    ADD COLUMN IF NOT EXISTS "ipHash" TEXT,
    ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

-- ----------------------------------------------------------------------------
-- 4. ÍNDICES (IF NOT EXISTS)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "players_userId_key" ON "players"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "player_vehicles_licensePlate_key" ON "player_vehicles"("licensePlate");
CREATE UNIQUE INDEX IF NOT EXISTS "clans_name_key" ON "clans"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "clans_tag_key" ON "clans"("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "clans_leaderId_key" ON "clans"("leaderId");
CREATE UNIQUE INDEX IF NOT EXISTS "clan_members_playerId_key" ON "clan_members"("playerId");
CREATE UNIQUE INDEX IF NOT EXISTS "clan_territories_territoryId_key" ON "clan_territories"("territoryId");
CREATE UNIQUE INDEX IF NOT EXISTS "battle_pass_progress_playerId_key" ON "battle_pass_progress"("playerId");
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_tokens_token_key" ON "refresh_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "player_skills_playerId_skillId_key" ON "player_skills"("playerId", "skillId");
CREATE UNIQUE INDEX IF NOT EXISTS "player_achievements_playerId_achievementId_key" ON "player_achievements"("playerId", "achievementId");
CREATE UNIQUE INDEX IF NOT EXISTS "security_audit_logs_entryHash_key" ON "security_audit_logs"("entryHash");
CREATE INDEX IF NOT EXISTS "security_audit_logs_actorId_createdAt_idx" ON "security_audit_logs"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "security_audit_logs_eventType_createdAt_idx" ON "security_audit_logs"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "anti_cheat_incidents_playerId_createdAt_idx" ON "anti_cheat_incidents"("playerId", "createdAt");
CREATE INDEX IF NOT EXISTS "anti_cheat_incidents_userId_createdAt_idx" ON "anti_cheat_incidents"("userId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "vault_records_vaultToken_key" ON "vidaloca_vault"."vault_records"("vaultToken");
CREATE INDEX IF NOT EXISTS "vault_records_ownerUserIdHash_recordType_idx" ON "vidaloca_vault"."vault_records"("ownerUserIdHash", "recordType");
CREATE INDEX IF NOT EXISTS "vault_records_blindIndex_idx" ON "vidaloca_vault"."vault_records"("blindIndex");
CREATE UNIQUE INDEX IF NOT EXISTS "vault_access_logs_entryHash_key" ON "vidaloca_vault"."vault_access_logs"("entryHash");
CREATE INDEX IF NOT EXISTS "vault_access_logs_actorIdHash_createdAt_idx" ON "vidaloca_vault"."vault_access_logs"("actorIdHash", "createdAt");

-- ----------------------------------------------------------------------------
-- 5. FOREIGN KEYS (idempotentes)
-- ----------------------------------------------------------------------------
DO $$ BEGIN ALTER TABLE "players" ADD CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory" ADD CONSTRAINT "inventory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "inventory" ADD CONSTRAINT "inventory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "item_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_vehicles" ADD CONSTRAINT "player_vehicles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_vehicles" ADD CONSTRAINT "player_vehicles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "vehicle_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_properties" ADD CONSTRAINT "player_properties_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_properties" ADD CONSTRAINT "player_properties_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "property_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "territories" ADD CONSTRAINT "territories_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "clans"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clan_territories" ADD CONSTRAINT "clan_territories_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "clan_territories" ADD CONSTRAINT "clan_territories_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "mission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "completed_missions" ADD CONSTRAINT "completed_missions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "completed_missions" ADD CONSTRAINT "completed_missions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "mission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "battle_pass_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "transaction_logs" ADD CONSTRAINT "transaction_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "player_weapons" ADD CONSTRAINT "player_weapons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "vidaloca_vault"."vault_access_logs" ADD CONSTRAINT "vault_access_logs_vaultRecordId_fkey" FOREIGN KEY ("vaultRecordId") REFERENCES "vidaloca_vault"."vault_records"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
