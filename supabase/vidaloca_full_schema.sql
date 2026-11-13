-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "FactionType" AS ENUM ('CIVILIAN', 'POLICE', 'GUARDIA_CIVIL', 'SYNDICATE', 'ENTREPRENEUR');

-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('WEAPON', 'VEHICLE', 'HOUSE', 'CONSUMABLE', 'SKILL_CARD', 'COSMETIC');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('APARTMENT', 'MANSION', 'WAREHOUSE', 'CLUB', 'GARAGE');

-- CreateEnum
CREATE TYPE "ClanRole" AS ENUM ('LEADER', 'OFFICER', 'MEMBER', 'RECRUIT');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'SUICIDE');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EARN', 'SPEND', 'PURCHASE', 'GIFT', 'PENALTY');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('EUR', 'VIDACOIN');

-- CreateEnum
CREATE TYPE "SkillCategory" AS ENUM ('COMBAT', 'DRIVING', 'STEALTH', 'BUSINESS', 'SOCIAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PLAYER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "players" (
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

-- CreateTable
CREATE TABLE "item_templates" (
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

-- CreateTable
CREATE TABLE "inventory" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_templates" (
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

-- CreateTable
CREATE TABLE "player_vehicles" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "licensePlate" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'white',
    "condition" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_templates" (
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

-- CreateTable
CREATE TABLE "player_properties" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRentCollectedAt" TIMESTAMP(3),
    "customized" JSONB,

    CONSTRAINT "player_properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clans" (
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

-- CreateTable
CREATE TABLE "clan_members" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "role" "ClanRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "territories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "incomeRate" DOUBLE PRECISION NOT NULL,
    "bonusType" TEXT,
    "controllerId" TEXT,

    CONSTRAINT "territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clan_territories" (
    "id" TEXT NOT NULL,
    "clanId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clan_territories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "rewardEuros" DOUBLE PRECISION NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "requirement" JSONB,

    CONSTRAINT "mission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_missions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "status" "MissionStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "player_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "completed_missions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewardClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "completed_missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_pass_seasons" (
    "id" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "battle_pass_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "battle_pass_progress" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "isPremium" BOOLEAN NOT NULL DEFAULT false,
    "rewardsClaimed" INTEGER[],

    CONSTRAINT "battle_pass_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_logs" (
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

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "maxLevel" INTEGER NOT NULL DEFAULT 10,
    "category" "SkillCategory" NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_skills" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "player_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "rewardVida" INTEGER NOT NULL DEFAULT 0,
    "rewardEuros" DOUBLE PRECISION NOT NULL DEFAULT 0.0,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_achievements" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "player_weapons" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "damage" INTEGER NOT NULL,
    "range" INTEGER NOT NULL,
    "accuracy" INTEGER NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "player_weapons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "sessionData" JSONB,

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "players_userId_key" ON "players"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "player_vehicles_licensePlate_key" ON "player_vehicles"("licensePlate");

-- CreateIndex
CREATE UNIQUE INDEX "clans_name_key" ON "clans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "clans_tag_key" ON "clans"("tag");

-- CreateIndex
CREATE UNIQUE INDEX "clans_leaderId_key" ON "clans"("leaderId");

-- CreateIndex
CREATE UNIQUE INDEX "clan_members_playerId_key" ON "clan_members"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "clan_territories_territoryId_key" ON "clan_territories"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "battle_pass_progress_playerId_key" ON "battle_pass_progress"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "player_skills_playerId_skillId_key" ON "player_skills"("playerId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "player_achievements_playerId_achievementId_key" ON "player_achievements"("playerId", "achievementId");

-- AddForeignKey
ALTER TABLE "players" ADD CONSTRAINT "players_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "item_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_vehicles" ADD CONSTRAINT "player_vehicles_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_vehicles" ADD CONSTRAINT "player_vehicles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "vehicle_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_properties" ADD CONSTRAINT "player_properties_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_properties" ADD CONSTRAINT "player_properties_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "property_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_members" ADD CONSTRAINT "clan_members_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "territories" ADD CONSTRAINT "territories_controllerId_fkey" FOREIGN KEY ("controllerId") REFERENCES "clans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_territories" ADD CONSTRAINT "clan_territories_clanId_fkey" FOREIGN KEY ("clanId") REFERENCES "clans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clan_territories" ADD CONSTRAINT "clan_territories_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "territories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_missions" ADD CONSTRAINT "player_missions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "mission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completed_missions" ADD CONSTRAINT "completed_missions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "completed_missions" ADD CONSTRAINT "completed_missions_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "mission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "battle_pass_progress" ADD CONSTRAINT "battle_pass_progress_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "battle_pass_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_logs" ADD CONSTRAINT "transaction_logs_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_skills" ADD CONSTRAINT "player_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_achievements" ADD CONSTRAINT "player_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_weapons" ADD CONSTRAINT "player_weapons_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

