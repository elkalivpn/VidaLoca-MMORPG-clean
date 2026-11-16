# Arquitectura Técnica y Guía de Escalabilidad — VidaLoca MMORPG

Este documento sirve como referencia principal para nuevos desarrolladores que se incorporen al proyecto. Explica la estructura modular, las invariantes de base de datos y economía, el escalado horizontal y cómo añadir nuevas funcionalidades (incluyendo pasarelas de pago como PayPal en el futuro) sin romper producción.

---

## 1. Topología del Repositorio

| Carpeta | Tecnología | Responsabilidad |
|---|---|---|
| `src/` | **NestJS 11 + TypeScript** | API REST (`/api/*`), WebSockets (`/game`), lógica de negocio, economía atómica y seguridad. |
| `client/` | **Next.js 15 + Tailwind + MapLibre GL** | Interfaz web jugable (3D StreetPlay, Mapa interactivo de España, Mercado P2P, Clanes, Chat). |
| `prisma/` | **Prisma 7 + tsx** | Esquema de datos (`schema.prisma`), cliente generado y seed idempotente (`seed.ts`). |
| `supabase/` | **PostgreSQL DDL** | Script SQL completo (`vidaloca_full_schema.sql`) alineado 1:1 con `prisma/schema.prisma`. |
| `game-client/` | **Godot 4** | Cliente nativo multiplataforma (Offline, LAN, Online MMO). |
| `test/` | **Jest + Supertest** | Pruebas End-to-End (`/api/health`, guards JWT, DTO validation). |

---

## 2. Arquitectura Modular del Backend (`src/`)

Cada dominio de juego vive en su propio módulo NestJS aislado con `module.ts`, `controller.ts`, `service.ts`, `dto/` y pruebas unitarias `*.spec.ts`:

- **Core & Infraestructura:**
  - `prisma/` — `PrismaService` conectado al pooler PostgreSQL de Supabase.
  - `health/` — `GET /api/health` verificado por Railway/load balancers.
  - `security/` — `AntiCheatService`, `AntiPromptInjectionService`, `SecurityAuditService`.
  - `common/` — Decoradores (`@CurrentUser`), utilidades compartidas (`level.util.ts`), filtros e interceptores de respuesta estándar (`{ success: true, data, timestamp }`).
- **Identidad y Jugador:**
  - `auth/` — Registro, login JWT + refresh tokens con rotación, **Invitado 1-Clic** (`POST /auth/guest`), conversión de invitado (`POST /auth/convert-guest`) y **referidos**.
  - `players/` — Perfil, inventario equipado, localización actual y flags (`isGuest`, `isVip`, `referralCode`).
- **Mundo y Acción en Tiempo Real:**
  - `world/` — 32 zonas de España, 17 rutas entre ciudades, acciones de calle, controles de Guardia Civil y mercado regional dinámico.
  - `realtime/` — `RealtimeGateway` (Socket.IO `/game`) con adaptador **Redis Pub/Sub** (Upstash) para sincronizar chat, movimiento y alertas de persecución entre múltiples instancias.
- **Sistemas de Progresión y Economía:**
  - `missions/` — Misiones de historia, online solo y co-op en escuadrón.
  - `heists/` — Golpes cooperativos por roles (`Conductor`, `Hacker`, `Asalto`).
  - `factions/` — 9 facciones activas, lista de más buscados, intercepción y fianzas.
  - `clans/` — Clanes, donaciones a fondos (`POST /clans/donate`), conquista de territorios con escudo de 2h y recaudación de impuestos cada 4h (`POST /clans/territories/:id/collect`).
  - `vehicles/`, `properties/`, `inventory/`, `skills/`, `achievements/`, `battle-pass/`, `transactions/`.
- **Retención y Economía Avanzada (Nuevos Módulos):**
  - `engagement/` — Racha diaria de 7 días, 3 retos diarios deterministas por día UTC, códigos de referido y **Leaderboards cacheados 30s en memoria** (`GET /engagement/leaderboards`).
  - `marketplace/` — Mercado Negro P2P jugador-a-jugador con tasa anti-inflación del **5%** y **Tienda Club VIP / VidaCoins** (`vip_7d`, `vip_30d`, `clear_heat`, cosméticos).

---

## 3. Reglas Críticas de Base de Datos y Despliegue Zero-Downtime

### Cómo arranca producción en Railway
El `Dockerfile` ejecuta al iniciar cada contenedor:
```sh
npx tsx prisma/seed.ts --if-needed && exec node dist/main.js
```
No se ejecuta `prisma db push` ni `prisma migrate deploy` contra el pooler PgBouncer en tiempo de arranque para evitar bloqueos de esquema o errores de pgbouncer.

### Regla de los 3 sitios (Obligatoria para cualquier cambio de esquema)
Si añades o modificas una tabla, enum, columna o índice:
1. Actualiza `prisma/schema.prisma` y ejecuta `npx prisma generate`.
2. Actualiza `supabase/vidaloca_full_schema.sql` de forma idempotente (`IF NOT EXISTS`, `DO $$ ... $$`).
3. Actualiza `ensureSchemaUpToDate()` al principio de `prisma/seed.ts` **ANTES** del chequeo `--if-needed`, usando `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`. Así el propio arranque en Railway aplica el DDL automáticamente sin pérdida de datos.

### Índices y Rendimiento
- Todas las consultas de ranking (`euros`, `reputation`, `[level, xp]`, `heat`), listados P2P (`[status, createdAt]`, `[sellerId, status]`) y territorios (`controllerId`) deben tener su índice correspondiente en Prisma y PostgreSQL.
- Endpoints públicos de lectura intensiva (como `GET /engagement/leaderboards`) usan caché TTL en memoria (30s) o Redis para proteger Supabase ante picos de tráfico.

---

## 4. Invariantes de Economía Atómica y Anti-Exploits

1. **Prohibido el patrón leer-y-restar fuera de condición atómica:**
   Para debitar `euros`, `vidaCoins`, fondos de clan o bloquear un anuncio P2P contra compras simultáneas, usa siempre `updateMany` con condición en el `where` dentro de `prisma.$transaction`:
   ```ts
   const debit = await tx.player.updateMany({
     where: { id: player.id, euros: { gte: cost } },
     data: { euros: { decrement: cost } },
   });
   if (debit.count === 0) throw new BadRequestException('Saldo insuficiente');
   ```
2. **Registro inmutable de movimientos (`TransactionLog`):**
   Toda entrada o salida relevante de `EUR` o `VIDACOIN` debe crear un registro en `transaction_logs` dentro de la misma transacción.
3. **Anti-granja en Invitados y Referidos:**
   Las recompensas de referido (`+2.500 €` y `+25 VC`) solo se otorgan en registros reales (`register`) o cuando un invitado convierte su cuenta (`convertGuest`), nunca al pulsar `guestLogin`.
4. **Sinks contra inflación:**
   El Mercado Negro P2P retiene un 5% (`MARKETPLACE_FEE_RATE = 0.05`) de cada venta; las conquistas de clan consumen `2.500 €` de las arcas del clan.

---

## 5. Escalabilidad Horizontal (Multi-Instancia)

- **API Stateless:** El estado de sesión reside en JWT + PostgreSQL (refresh tokens con hash SHA-256). Puedes escalar réplicas en Railway sin afinidad de sesión HTTP.
- **WebSockets Distribuidos:** `RealtimeGateway` usa el adaptador Redis (`@socket.io/redis-adapter`) cuando `REDIS_URL` está configurado (Upstash), propagando salas de ciudad, chat y persecuciones entre instancias.
- **Throttling:** `ThrottlerModule` protege endpoints sensibles (`/auth/login`, `/auth/register`, `/auth/guest`, `/auth/refresh`).

---

## 6. Cómo Integrar PayPal (u otra pasarela) en el Futuro

Cuando el equipo esté listo para activar cobros reales sin tocar la lógica del juego:
1. Crea un módulo aislado `src/payments/` (`PaymentsModule`, `PaymentsController`, `PaymentsService`) que importe `PrismaModule`.
2. Añade un modelo `PaymentOrder` en `prisma/schema.prisma` (con `externalOrderId @unique`, `provider`, `productId`, `amountEur`, `vidaCoinsGranted`, `status`).
3. Flujo recomendado (PayPal Orders v2):
   - `POST /api/payments/paypal/create-order` → crea orden server-side usando catálogo de paquetes fijo en backend (nunca confíes en precios enviados por el cliente) y guarda `PaymentOrder` en estado `CREATED`.
   - `POST /api/payments/paypal/capture-order` y/o Webhook verificado criptográficamente → verifica estado `COMPLETED` con PayPal API, actualiza `PaymentOrder` de `CREATED` a `COMPLETED` con `updateMany` atómico (`count === 1` evita doble acreditación), suma `vidaCoins` o activa `isVip`/`vipExpiresAt`, y escribe en `TransactionLog` (`type: 'PURCHASE'`).

---

## 7. Checklist de Calidad antes de cada Commit / PR

Ejecuta siempre la puerta completa antes de hacer `git push`:

```bash
# Backend
npx prisma generate
npm run typecheck
npm run build
npm test
npm run test:e2e

# Frontend (Next.js exige ESLint + Prettier estrictos)
cd client && npx prettier --write src/
npm run typecheck --prefix client
npm run build --prefix client
```

### Variables de entorno clave
- **Backend (Railway):** `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `REDIS_URL`, `ALLOWED_ORIGINS` (incluir el dominio de Vercel), `PORT`.
- **Frontend (Vercel):** `NEXT_PUBLIC_API_URL` (URL pública de Railway, sin barra final), `NEXT_PUBLIC_WS_URL`.
