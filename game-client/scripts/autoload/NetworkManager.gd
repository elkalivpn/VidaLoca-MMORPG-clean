extends Node
## Autoload que gestiona los 3 modos de red de VidaLoca:
## 1) Offline (Modo Historia)
## 2) Red Local LAN (ENetMultiplayerPeer)
## 3) Online MMO (HTTPRequest contra API NestJS)

enum ConnectionMode {
	OFFLINE,
	LAN,
	ONLINE
}

signal mode_changed(new_mode: ConnectionMode)
signal lan_connection_succeeded
signal lan_connection_failed(reason: String)
signal lan_peer_connected(peer_id: int)
signal lan_peer_disconnected(peer_id: int)
signal remote_player_state_received(peer_id: int, state: Dictionary)
signal online_login_completed(success: bool, data: Dictionary)
signal online_api_response(endpoint: String, success: bool, data: Dictionary)

var current_mode: ConnectionMode = ConnectionMode.OFFLINE
var api_base_url: String = "http://localhost:3000/api"
var jwt_token: String = ""
var online_player_id: String = ""
var enet_peer: ENetMultiplayerPeer = null


func _ready() -> void:
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.connected_to_server.connect(_on_connected_to_server)
	multiplayer.connection_failed.connect(_on_connection_failed)
	multiplayer.server_disconnected.connect(_on_server_disconnected)


func get_mode_label() -> String:
	match current_mode:
		ConnectionMode.OFFLINE:
			return "OFFLINE (HISTORIA)"
		ConnectionMode.LAN:
			if multiplayer.is_server():
				return "LAN (HOST)"
			return "LAN (CLIENTE)"
		ConnectionMode.ONLINE:
			return "ONLINE (MMO)"
	return "DESCONOCIDO"


# ============================================================================
# 1. MODO OFFLINE (HISTORIA)
# ============================================================================

func start_offline_story(load_existing: bool = true) -> void:
	disconnect_network()
	current_mode = ConnectionMode.OFFLINE
	if load_existing and GameState.has_save_file():
		GameState.load_game()
	else:
		GameState.reset_story()
	mode_changed.emit(current_mode)


# ============================================================================
# 2. RED LOCAL LAN (ENetMultiplayerPeer)
# ============================================================================

func host_lan_server(port: int = 7777, max_clients: int = 16) -> Error:
	disconnect_network()
	enet_peer = ENetMultiplayerPeer.new()
	var err := enet_peer.create_server(port, max_clients)
	if err != OK:
		enet_peer = null
		lan_connection_failed.emit("No se pudo iniciar servidor LAN en puerto %d (error %d)" % [port, err])
		return err
	multiplayer.multiplayer_peer = enet_peer
	current_mode = ConnectionMode.LAN
	mode_changed.emit(current_mode)
	lan_connection_succeeded.emit()
	return OK


func join_lan_server(ip: String, port: int = 7777) -> Error:
	disconnect_network()
	enet_peer = ENetMultiplayerPeer.new()
	var err := enet_peer.create_client(ip, port)
	if err != OK:
		enet_peer = null
		lan_connection_failed.emit("No se pudo conectar a %s:%d (error %d)" % [ip, port, err])
		return err
	multiplayer.multiplayer_peer = enet_peer
	current_mode = ConnectionMode.LAN
	mode_changed.emit(current_mode)
	return OK


func disconnect_network() -> void:
	if multiplayer.multiplayer_peer != null:
		multiplayer.multiplayer_peer.close()
		multiplayer.multiplayer_peer = null
	enet_peer = null
	jwt_token = ""


@rpc("any_peer", "unreliable_ordered")
func sync_player_transform(pos: Vector3, rot_y: float, in_vehicle: bool, speed: float) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	if sender_id == 0:
		return
	var state := {
		"position": pos,
		"rotation_y": rot_y,
		"in_vehicle": in_vehicle,
		"speed": speed
	}
	remote_player_state_received.emit(sender_id, state)


func broadcast_local_transform(pos: Vector3, rot_y: float, in_vehicle: bool, speed: float) -> void:
	if current_mode != ConnectionMode.LAN or multiplayer.multiplayer_peer == null:
		return
	sync_player_transform.rpc(pos, rot_y, in_vehicle, speed)


func _on_peer_connected(id: int) -> void:
	lan_peer_connected.emit(id)


func _on_peer_disconnected(id: int) -> void:
	lan_peer_disconnected.emit(id)


func _on_connected_to_server() -> void:
	lan_connection_succeeded.emit()


func _on_connection_failed() -> void:
	disconnect_network()
	current_mode = ConnectionMode.OFFLINE
	mode_changed.emit(current_mode)
	lan_connection_failed.emit("Tiempo de espera agotado al conectar al host LAN.")


func _on_server_disconnected() -> void:
	disconnect_network()
	current_mode = ConnectionMode.OFFLINE
	mode_changed.emit(current_mode)
	lan_connection_failed.emit("El host LAN cerró la sesión.")


# ============================================================================
# 3. ONLINE MMO (API NestJS vía HTTPRequest)
# ============================================================================

func set_api_base_url(url: String) -> void:
	api_base_url = url.strip_edges().trim_suffix("/")


func login_online(username: String, password: String) -> void:
	disconnect_network()
	var body := {
		"username": username,
		"password": password
	}
	_send_http_request("/auth/login", HTTPClient.METHOD_POST, body, func(success: bool, data: Dictionary) -> void:
		if success and data.has("access_token"):
			jwt_token = str(data.get("access_token", ""))
			online_player_id = str(data.get("player_id", username))
			current_mode = ConnectionMode.ONLINE
			mode_changed.emit(current_mode)
			if data.has("player"):
				var p: Dictionary = data["player"]
				GameState.player_name = str(p.get("username", username))
				if p.has("euros"):
					GameState.set_euros(int(p["euros"]))
				if p.has("heat"):
					GameState.set_heat(int(p["heat"]))
			online_login_completed.emit(true, data)
		else:
			online_login_completed.emit(false, data)
	)


func fetch_street_state() -> void:
	_send_http_request("/world/street", HTTPClient.METHOD_GET, {}, func(success: bool, data: Dictionary) -> void:
		if success:
			if data.has("district"):
				GameState.current_district = str(data["district"])
			if data.has("euros"):
				GameState.set_euros(int(data["euros"]))
			if data.has("heat"):
				GameState.set_heat(int(data["heat"]))
		online_api_response.emit("/world/street", success, data)
	)


func send_world_action(action_type: String, payload: Dictionary = {}) -> void:
	var body := {
		"action": action_type,
		"payload": payload
	}
	_send_http_request("/world/action", HTTPClient.METHOD_POST, body, func(success: bool, data: Dictionary) -> void:
		if success:
			if data.has("euros"):
				GameState.set_euros(int(data["euros"]))
			if data.has("heat"):
				GameState.set_heat(int(data["heat"]))
		online_api_response.emit("/world/action", success, data)
	)


func travel_to_district(district_id: String) -> void:
	var body := {
		"district": district_id
	}
	_send_http_request("/world/travel", HTTPClient.METHOD_POST, body, func(success: bool, data: Dictionary) -> void:
		if success and data.has("district"):
			GameState.current_district = str(data["district"])
		online_api_response.emit("/world/travel", success, data)
	)


func _send_http_request(endpoint: String, method: int, body_dict: Dictionary, callback: Callable) -> void:
	var req := HTTPRequest.new()
	add_child(req)
	var url := "%s%s" % [api_base_url, endpoint]
	var headers := PackedStringArray([
		"Content-Type: application/json",
		"Accept: application/json"
	])
	if not jwt_token.is_empty():
		headers.append("Authorization: Bearer %s" % jwt_token)

	var body_str := ""
	if method != HTTPClient.METHOD_GET and not body_dict.is_empty():
		body_str = JSON.stringify(body_dict)

	req.request_completed.connect(func(result: int, response_code: int, _resp_headers: PackedStringArray, resp_body: PackedByteArray) -> void:
		req.queue_free()
		var raw := resp_body.get_string_from_utf8()
		var parsed: Variant = JSON.parse_string(raw) if not raw.is_empty() else {}
		var data: Dictionary = parsed if typeof(parsed) == TYPE_DICTIONARY else {"raw": raw}
		var ok := result == HTTPRequest.RESULT_SUCCESS and response_code >= 200 and response_code < 300
		if not ok and not data.has("error"):
			data["error"] = "HTTP %d (result %d)" % [response_code, result]
		callback.call(ok, data)
	)

	var err := req.request(url, headers, method, body_str)
	if err != OK:
		req.queue_free()
		callback.call(false, {"error": "Error al iniciar petición HTTP (%d)" % err})
