# 🌆 VidaLoca MMORPG

> **Mundo libre. Tú decides quién eres.**

MMORPG de navegador en las ciudades de España. Economía dual, clanes, territorios, misiones, multijugador en vivo.

**Repo limpio (fuente de verdad):** este.

## Arranque en un comando

```bash
git clone https://github.com/elkalivpn/VidaLoca-MMORPG-clean.git
cd VidaLoca-MMORPG-clean
cp .env.example .env
# Edita .env → DATABASE_URL (PostgreSQL / Supabase) + JWT_SECRET
./scripts/setup.sh
```

Luego:

```bash
npm run dev:api            # API :3000
npm run dev:client         # UI  :3001
```

### Solo instalar dependencias (sin DB)

```bash
npm run setup
```

Si `.env` aún tiene placeholders, el script para y te indica el siguiente paso.

## Stack

NestJS 11 · Prisma 7 · PostgreSQL (Supabase / Neon) · Socket.IO · Next.js 15 · MapLibre GL · Tailwind

## Enlaces

| Recurso | URL |
|---------|-----|
| API / Swagger | http://localhost:3000/api/docs |
| Cliente | http://localhost:3001 |
| WebSocket | `ws://localhost:3000/game` |
| Código | https://github.com/elkalivpn/VidaLoca-MMORPG-clean |

## Seguridad

- Nunca subas `.env`
- Rota `JWT_SECRET` y password de Neon si hubo filtración
- Variables en hosting (Vercel/Railway), no en el repo

## Documentación y Fases

- Guía de arquitectura, escalabilidad e incorporación de equipo: [ARCHITECTURE.md](./ARCHITECTURE.md)
- Plan de desarrollo por fases: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)

## Licencia

UNLICENSED – proyecto privado de desarrollo.
