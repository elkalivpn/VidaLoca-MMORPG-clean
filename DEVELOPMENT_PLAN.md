# Plan de desarrollo – VidaLoca MMORPG

Filosofía: mundo libre, ciudades de España, Euros + VidaCoins, clanes, vehículos, propiedades, misiones, Battle Pass.

| Fase | Estado | Contenido |
|------|--------|-----------|
| **0** Fundación | ✅ | Seguridad, Docker, filters, throttling, health, Swagger |
| **1** Backend gameplay | ✅ | Missions, Vehicles, Properties, Skills, Achievements, BattlePass, RolesGuard |
| **2** Cliente jugable | ✅ | Next.js: mapa, misiones, vehículos, propiedades, skills/BP |
| **3** Realtime | ✅ | Socket.IO `/game`, JWT, presencia, chat zona/global, world events |
| **4** Contenido & poder | ✅ | UI clanes + territorios reclamables, inventario, misiones narrativas, scheduler de eventos de mundo |
| **5** Producción | 🕛 | CI/CD, monitoring, anti-cheat, Redis adapter WS, E2E, deploy |

### Fase 4 – detalle

- Clanes: crear / unirse / abandonar / ranking
- Territorios: listado + claim (líder/oficial, coste 2.500 € fondos)
- Inventario visual + equipar
- Misiones narrativas ampliadas en seed
- Eventos de mundo periódicos vía WebSocket (`world:event`) + banner en dashboard

### Arranque

```bash
npm install && cd client && npm install && cd ..
cp .env.example .env   # DATABASE_URL + JWT_SECRET
npx prisma generate && npx prisma db push && npx tsx prisma/seed.ts
npm run start:dev
cd client && npm run dev
```
