# VidaLoca — Cliente Nativo Godot 4.3

Cliente 3D nativo de **VidaLoca MMORPG** desarrollado para **Godot 4.3+** con soporte para:

1. **Modo Historia (Offline)**: 5 capítulos ambientados en España con guardado/carga local en `user://vidaloca_save.json`.
2. **Red Local (LAN)**: Multijugador directo mediante `ENetMultiplayerPeer` (Host o Unirse por IP/Puerto) con sincronización RPC de jugadores.
3. **Servidor Online (MMO)**: Autenticación JWT y sincronización de mundo vía `HTTPRequest` contra la API NestJS (`/api/auth/login`, `/api/world/street`, `/api/world/action`, `/api/world/travel`).

---

## Cómo abrir en Godot 4.3+

1. Descarga e inicia **Godot Engine 4.3** (versión estándar).
2. En el Project Manager haz clic en **Import** / **Importar**.
3. Selecciona el archivo `game-client/project.godot` y pulsa **Import & Edit**.
4. Pulsa **F5** (o el botón Play) para ejecutar `res://scenes/MainMenu.tscn`.

---

## Controles

| Acción | Tecla / Entrada |
| :--- | :--- |
| Moverse / Conducir | `W`, `A`, `S`, `D` o Flechas |
| Sprint (a pie) | `Shift` |
| Derrape (en vehículo) | `Space` |
| Subir / Bajar del vehículo | `F` |
| Acción táctica | `Q` o Clic Izquierdo |
| Interactuar | `E` |
| Liberar ratón / Volver al Menú | `ESC` |

---

## Estructura del Proyecto

- `project.godot`: Configuración Godot 4.3, `InputMap` y Autoloads (`GameState`, `NetworkManager`).
- `scripts/autoload/GameState.gd`: Estado global, dinero (`euros`), calor policial (`heat`), facción y guardado JSON offline.
- `scripts/autoload/NetworkManager.gd`: Gestión unificada de Offline, LAN (`ENetMultiplayerPeer`) y Online (`HTTPRequest`).
- `scripts/player/PlayerController.gd`: Controlador `CharacterBody3D` en 3ª persona con cámara suave.
- `scripts/vehicles/VehicleController.gd`: Controlador `VehicleBody3D` con 4 `VehicleWheel3D`, derrape reduciendo `wheel_friction_slip` trasero y cálculo de `km/h`.
- `scenes/MainMenu.tscn` + `scripts/ui/MainMenu.gd`: Menú principal de selección de modo.
- `scenes/MadridCentro.tscn` + `scripts/world/MadridCentro.gd` + `scripts/ui/HUD.gd`: Escena nocturna jugable de Madrid Centro con HUD en vivo.

---

## Exportar a Windows, macOS, Linux, Android e iOS

1. En Godot, ve a **Editor → Manage Export Templates** y descarga las plantillas de exportación para **Godot 4.3**.
2. Abre **Project → Export...** y pulsa **Add...** para añadir el preset de la plataforma deseada:
   - **Windows Desktop**: Exporta como `.exe` (`x86_64`).
   - **Linux / X11**: Exporta como binario `.x86_64`.
   - **macOS**: Exporta como `.dmg` o `.app` universal (`arm64` + `x86_64`).
   - **Android**: Configura el SDK de Android y keystore en **Editor Settings → Export → Android**, usa el renderer `Mobile` (ya configurado en `renderer/rendering_method.mobile="mobile"`) y exporta `.apk` o `.aab`.
   - **iOS**: Exporta el proyecto Xcode desde macOS y compílalo con tu perfil de firma de Apple Developer.
