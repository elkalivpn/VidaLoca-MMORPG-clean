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
    echo "  EDITA .env y pon DATABASE_URL (Neon) + JWT_SECRET antes de migrar."
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

if grep -q 'USER:PASSWORD\|cambia-este-secreto\|HOST:5432' .env 2>/dev/null; then
  echo ""
  echo "⚠  .env todavía tiene placeholders."
  echo "   Configura DATABASE_URL y JWT_SECRET, luego:"
  echo "   npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts"
  echo "   npm run start:dev"
  echo "   (otro terminal) cd client && npm run dev"
  exit 0
fi

echo "→ Prisma generate + db push + seed…"
npx prisma generate
npx prisma db push --accept-data-loss
npx tsx prisma/seed.ts

echo ""
echo "✓ Listo."
echo "  API:     npm run start:dev     → http://localhost:3000/api/docs"
echo "  Cliente: cd client && npm run dev → http://localhost:3001"
echo "  O todo:  npm run dev:all"
