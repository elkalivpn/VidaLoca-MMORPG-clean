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
cp .env.example .env   # DATABASE_URL + JWT_SECRET
docker compose up -d
npx prisma generate && npx prisma migrate dev && npx tsx prisma/seed.ts
npm run start:dev
cd client && npm run dev
```

- API: http://localhost:3000/api/docs
- Cliente: http://localhost:3001
- Seed: `admin@vidaloca.com` / `Admin123!`

Este repositorio es la versión **limpia** (sin `node_modules`, sin secretos, sin carpetas de agentes).
