extends Node3D
## Controlador de la escena jugable Madrid Centro nocturno.
## Conecta PlayerController, VehicleController, HUD, pausa con [ESC] y avatares remotos en LAN.

const MAIN_MENU_SCENE := "res://scenes/MainMenu.tscn"

@onready var player: PlayerController = $Player
@onready var supercar: VehicleController = $Supercar
@onready var hud: CanvasLayer = $HUD
@onready var remote_players_root: Node3D = $RemotePlayers

var _remote_avatars: Dictionary = {}


func _ready() -> void:
	GameState.current_district = "Madrid Centro"

	if player != null:
		player.near_vehicle_changed.connect(_on_near_vehicle_changed)
		player.tactical_action_triggered.connect(_on_tactical_action)

	if supercar != null:
		supercar.telemetry_updated.connect(_on_vehicle_telemetry)
		supercar.driver_changed.connect(_on_vehicle_driver_changed)

	NetworkManager.remote_player_state_received.connect(_on_remote_player_state)
	NetworkManager.lan_peer_disconnected.connect(_on_remote_peer_disconnected)

	if NetworkManager.current_mode == NetworkManager.ConnectionMode.ONLINE:
		NetworkManager.fetch_street_state()


func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("ui_cancel"):
		if Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
		else:
			_return_to_menu()


func _on_near_vehicle_changed(vehicle: Node3D) -> void:
	if hud == null:
		return
	if vehicle != null and not GameState.is_in_vehicle:
		hud.set_prompt("[F] Subir al superdeportivo | [Q] Acción táctica")
	elif GameState.is_in_vehicle:
		hud.set_prompt("[F] Bajar del vehículo | [Space] Derrape")
	else:
		hud.set_prompt("[Q] Acción táctica | [ESC] Menú")


func _on_vehicle_driver_changed(has_driver: bool) -> void:
	if hud == null:
		return
	if has_driver:
		hud.set_prompt("[F] Bajar del vehículo | [Space] Derrape")
	else:
		hud.update_vehicle_telemetry(0.0, false, false)
		hud.set_prompt("[Q] Acción táctica | [ESC] Menú")


func _on_vehicle_telemetry(speed_kmh: float, is_drifting: bool) -> void:
	if hud != null:
		hud.update_vehicle_telemetry(speed_kmh, is_drifting, true)


func _on_tactical_action(action_name: String) -> void:
	if hud != null:
		hud.set_prompt("Ejecutado: %s (+150 €)" % action_name)


func _on_remote_player_state(peer_id: int, state: Dictionary) -> void:
	if remote_players_root == null:
		return
	var avatar: Node3D = _remote_avatars.get(peer_id, null)
	if avatar == null:
		avatar = _create_remote_avatar(peer_id)
		remote_players_root.add_child(avatar)
		_remote_avatars[peer_id] = avatar

	var pos: Vector3 = state.get("position", Vector3.ZERO)
	var rot_y: float = float(state.get("rotation_y", 0.0))
	avatar.global_position = avatar.global_position.lerp(pos, 0.45)
	avatar.rotation.y = rot_y


func _on_remote_peer_disconnected(peer_id: int) -> void:
	if _remote_avatars.has(peer_id):
		var avatar: Node3D = _remote_avatars[peer_id]
		avatar.queue_free()
		_remote_avatars.erase(peer_id)


func _create_remote_avatar(peer_id: int) -> Node3D:
	var root := Node3D.new()
	root.name = "RemotePeer_%d" % peer_id

	var mesh_inst := MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.radius = 0.35
	cap.height = 1.7
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.2, 0.8, 1.0)
	mat.emission_enabled = true
	mat.emission = Color(0.05, 0.35, 0.5)
	cap.material = mat
	mesh_inst.mesh = cap
	mesh_inst.position.y = 0.9
	root.add_child(mesh_inst)
	return root


func _return_to_menu() -> void:
	if NetworkManager.current_mode == NetworkManager.ConnectionMode.OFFLINE:
		GameState.save_game()
	NetworkManager.disconnect_network()
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	get_tree().change_scene_to_file(MAIN_MENU_SCENE)
