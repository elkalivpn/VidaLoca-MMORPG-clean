#!/usr/bin/env bash
# Sync local project → GitHub clean (sin secrets / node_modules / dist)
# Uso (desde la raíz de tu copia completa, p.ej. Desktop/VidaLoca-source):
#   bash scripts/sync-to-github.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

REPO_URL="https://github.com/elkalivpn/VidaLoca-MMORPG-clean.git"
BRANCH="main"

echo "═══════════════════════════════════════"
echo "  VIDA LOCA – Sync → GitHub clean"
echo "  Root: $ROOT"
echo "═══════════════════════════════════════"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  :
else
  echo "No es un repo git. Inicializando y apuntando al clean…"
  git init
  git remote add origin "$REPO_URL" 2>/dev/null || git remote set-url origin "$REPO_URL"
fi

git remote set-url origin "$REPO_URL" 2>/dev/null || git remote add origin "$REPO_URL"

if ! grep -q '^\.env$' .gitignore 2>/dev/null; then
  cat >> .gitignore << 'EOF'

# secrets & deps (sync script)
.env
.env.local
.env.*.local
node_modules/
client/node_modules/
dist/
client/.next/
*.log
.DS_Store
EOF
fi

if [[ -f .env ]]; then
  git check-ignore -q .env && echo "✓ .env ignorado" || {
    echo "ERROR: .env no está en .gitignore — abortando"
    exit 1
  }
fi

echo "→ git add (respetando .gitignore)…"
git add -A

if git diff --cached --name-only | grep -E '(^|/)\.env($|\.)' >/dev/null; then
  echo "ERROR: se intentó stagear un .env — abortando"
  git reset HEAD
  exit 1
fi

if git diff --cached --quiet; then
  echo "Nada nuevo que commitear."
else
  git status --short | head -40
  git commit -m "sync: full source from local (no secrets, no node_modules)"
fi

echo "→ push origin $BRANCH…"
git branch -M "$BRANCH"
git push -u origin "$BRANCH"

echo ""
echo "✓ Subido a $REPO_URL ($BRANCH)"
echo "  Comprueba: https://github.com/elkalivpn/VidaLoca-MMORPG-clean"
