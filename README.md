# 🌆 VidaLoca MMORPG

> **Mundo libre. Tú decides quién eres.**

MMORPG de navegador ambientado en las grandes ciudades de España.

## Stack
NestJS 11 · Prisma · PostgreSQL · Socket.IO · Next.js 15 · Tailwind

## Arranque

```bash
git clone https://github.com/elkalivpn/VidaLoca-MMORPG-clean.git
cd VidaLoca-MMORPG-clean
npm install && cd client && npm install && cd ..
cp .env.example .env
# Rellena SOLO en local: DATABASE_URL (Neon pooled) y JWT_SECRET
# Nunca subas el archivo .env

docker compose up -d   # opcional si usas Postgres/Redis local
npx prisma generate
npx prisma migrate dev
npx tsx prisma/seed.ts
npm run start:dev
cd client && npm run dev
```

| Recurso | URL |
|---------|-----|
| API / Swagger | http://localhost:3000/api/docs |
| Cliente | http://localhost:3001 |
| WebSocket | ws://localhost:3000/game |

## Seguridad

- Solo existe `.env.example` en el repo (placeholders).
- `.env` real queda en tu máquina y está en `.gitignore`.
- Si alguna vez se filtró un `.env`: rota password de Neon y `JWT_SECRET`.

## Filosofía

Mundo libre, ciudades de España, economía dual Euros + VidaCoins, clanes, vehículos, propiedades, misiones y Battle Pass.
