# Plan de desarrollo – VidaLoca MMORPG

## Filosofía (innegociable)

**Mundo libre estilo calle española.** No es un menú de grindeo: recorres las ciudades y barrios de España, eliges tu camino (Legal / Gris / Calle), asumes calor policial, reputación, vehículos, propiedades y control territorial con tu clan. Las misiones avanzan orgánicamente al actuar en la calle.

## Fases

| Fase | Estado | Contenido |
| :--- | :---: | :--- |
| **0 — Estabilización y Seguridad** | ✅ | Auditoría integral, FK `TransactionLog`, operaciones atómicas, `RolesGuard`, cooldown de rentas, unificación de zonas/XP, reparación del cliente y CI/CD en GitHub Actions. |
| **1 — Mapa Real de España** | ✅ | Grafo de carreteras de España (`A-1`, `A-2`, `A-3`, `A-4`, `AP-7`, `A-7`, `A-92`), mapa interactivo con MapLibre GL, rutas y viajes ligados a `PlayerVehicle` con controles de Guardia Civil. |
| **2 — Distritos 3D y Sync Espacial** | 🔜 | Escena 3D navegable por barrio (Three.js / R3F), avatares y vehículos en vivo, spatial chunks y HUD inmersivo. |
| **3 — Facciones y Persecuciones** | 🔜 | Fuerzas del orden jugables, bandas/clanes, empresarios, persecuciones en tiempo real y combate. |
| **4 — Economía Viva y Golpes** | 🔜 | Propiedades funcionales (piso franco, garaje, almacén, club), eventos dinámicos y golpes cooperativos. |
| **5 — Escala MMO y Lanzamiento** | 🔜 | VoIP de proximidad, load testing WebSocket, observabilidad y despliegue en producción. |

## Loop de juego

1. Entras en **Calle** y eliges tu estilo (`LEGAL`, `GREY`, `STREET`).
2. Ejecutas movidas en tu barrio actual (riesgo, €, XP, reputación y calor policial).
3. Las misiones activas progresan automáticamente al actuar y se cobran en **Misiones**.
4. Abres **Mapa** para trazar rutas por las carreteras de España y conducir tu vehículo hacia otra ciudad o distrito.

## Tras pull / actualización de esquema

```bash
npx prisma generate
npx prisma db push
npm run dev:api
npm run dev:client
```
