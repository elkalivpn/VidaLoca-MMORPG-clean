#!/usr/bin/env bash
# VidaLoca MMORPG – arranque en un comando
# Uso: ./scripts/setup.sh
#      bash <(curl -fsSL https://raw.githubusercontent.com/elkalivpn/VidaLoca-MMORPG-clean/main/scripts/setup.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." 2>/dev/null && pwd || pwd)"
cd "$ROOT"

echo "═══════════════════════════════════════"
echo "  VIDA LOCA – Setup"
echo "═══════════════════════════════════════"

need() { command -v "$1" >/dev/null 2>&1 || { echo "Falta: $1"; exit 1; }; }
need node
need npm

NODE_MAJOR=$(node -v | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Se recomienda Node 20+. Actual: $(node -v)"
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "→ Creado .env desde .env.example"
    echo "  EDITA .env y pon DATABASE_URL (PostgreSQL/Supabase) + JWT_SECRET antes de migrar."
  else
    echo "No hay .env ni .env.example"
    exit 1
  fi
fi

echo "→ npm install (backend)…"
npm install --no-fund --no-audit

if [ -d client ]; then
  echo "→ npm install (client)…"
  (cd client && npm install --no-fund --no-audit)
fi

if grep -q 'USER:PASSWORD\|change-me-to-a-long-random-string\|TU-PASSWORD-SUPABASE' .env 2>/dev/null; then
  echo ""
  echo "⚠  .env todavía tiene placeholders."
  echo "   Configura DATABASE_URL y JWT_SECRET, luego:"
  echo "   npx prisma generate && npx prisma db push && npm run db:seed"
  echo "   npm run dev:api"
  echo "   (otro terminal) npm run dev:client"
  exit 0
fi

echo "→ Prisma generate + db push + seed…"
npx prisma generate
npx prisma db push
npm run db:seed

echo ""
echo "✓ Listo."
echo "  API:     npm run dev:api     → http://localhost:3000/api/docs"
echo "  Cliente: npm run dev:client  → http://localhost:3001"
