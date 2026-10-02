# Plan de desarrollo – VidaLoca MMORPG

## Filosofía (innegociable)

**Mundo libre estilo calle española.** No es un menú de grindeo: estás en un barrio, eliges movidas (legal / gris / calle), asumes calor policial, reputación y dinero. Las misiones son encargos que avanzan al actuar en la calle.

## Fases

| Fase | Estado | Contenido |
|------|--------|-----------|
| 0–3 | ✅ | Auth, módulos, cliente, realtime |
| **4b Calle viva** | ✅ | `WorldModule`: acciones por barrio, calor, camino, StreetPlay UI |
| 5 | 🔜 | Personajes/avatar, persecuciones, inventario usable en acciones, deploy |

## Loop de juego

1. Entras → pestaña **Calle** (no el mapa)
2. Eliges camino Legal / Gris / Calle
3. Haces movidas en el barrio (riesgo, €, XP, calor)
4. Las misiones activas avanzan al actuar
5. Cobras misiones completadas en Misiones
6. Viajas de barrio en **Mapa** cuando quieras cambiar de zona

## Tras pull

```bash
export DATABASE_URL=...
npx prisma db push
# reinicia API
npm run start:dev
```

Campos nuevos en Player: `heat`, `lifestyle`.
